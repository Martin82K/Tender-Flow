/**
 * Čisté helpery pro Stripe integraci — bez závislosti na Deno/Supabase, takže jdou
 * importovat ze synchronních test runnerů (Vitest) i z Deno Edge Functions.
 *
 * Runtime API client (fetch wrapper, webhook signature verify) je v `stripeBilling.ts`.
 *
 * Pricing zachováván v souladu s GoPay (jediný source of truth pro ceník je v
 * `gopayHelpers.ts`); tady jen mapujeme tier+period → Stripe Price ID env var.
 */

export type BillingPeriod = "monthly" | "yearly";
export type Tier = "starter" | "pro" | "enterprise";

/** Interní subscription status — kopíruje typ z `types.ts`. */
export type InternalSubscriptionStatus =
  | "active"
  | "trial"
  | "cancelled"
  | "expired"
  | "pending";

// --- Plan Configuration (mirror gopayHelpers, jeden zdroj pravdy pro částky) ---

const PLAN_PRICES: Record<Tier, { monthly: number; yearly: number }> = {
  starter: { monthly: 39900, yearly: 383040 }, // V haléřích: 399 CZK / 3830.40 CZK
  pro: { monthly: 49900, yearly: 479000 }, // 499 CZK / 4790 CZK
  enterprise: { monthly: 0, yearly: 0 }, // Custom pricing (žádný self-checkout)
};

const PLAN_LABELS: Record<Tier, string> = {
  starter: "Tender Flow Starter",
  pro: "Tender Flow Pro",
  enterprise: "Tender Flow Enterprise",
};

/**
 * Vrátí celkovou částku v haléřích pro daný tier a period × quantity.
 * Stripe pracuje s nejmenší jednotkou měny (haléř pro CZK), stejně jako GoPay.
 *
 * @param quantity počet seats (1 pro user-level, N pro org-level)
 */
export const calculateStripeAmount = (
  tier: Tier,
  period: BillingPeriod,
  quantity = 1,
): number => {
  const unit = PLAN_PRICES[tier]?.[period] ?? 0;
  const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 0;
  return unit * safeQuantity;
};

export const getStripePlanLabel = (tier: Tier, period: BillingPeriod): string =>
  `${PLAN_LABELS[tier] ?? tier} (${period === "yearly" ? "roční" : "měsíční"})`;

// --- Price ID lookup ---

type EnvGetter = (key: string) => string | undefined;

/**
 * Default reader pro Stripe ENV — preferuje Deno.env (Edge Functions runtime),
 * fallback na process.env (Node testy / SSR build) a nakonec undefined.
 */
const defaultEnvGetter: EnvGetter = (key) => {
  // deno-lint-ignore no-explicit-any
  const denoEnv = (globalThis as any)?.Deno?.env;
  if (denoEnv && typeof denoEnv.get === "function") {
    return denoEnv.get(key) ?? undefined;
  }
  // deno-lint-ignore no-explicit-any
  const nodeEnv = (globalThis as any)?.process?.env;
  if (nodeEnv && typeof nodeEnv === "object") {
    const value = nodeEnv[key];
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
};

const PRICE_ENV_MAP: Record<Tier, Record<BillingPeriod, string | null>> = {
  starter: {
    monthly: "STRIPE_PRICE_ID_STARTER_MONTHLY",
    yearly: "STRIPE_PRICE_ID_STARTER_YEARLY",
  },
  pro: {
    monthly: "STRIPE_PRICE_ID_PRO_MONTHLY",
    yearly: "STRIPE_PRICE_ID_PRO_YEARLY",
  },
  enterprise: { monthly: null, yearly: null }, // enterprise nemá self-checkout
};

/**
 * Mapuje (tier, period) → Stripe Price ID. ID načítá ze zadaného env getteru,
 * default čte z Deno.env / process.env.
 *
 * Vrací `null` pokud:
 *  - tier je `enterprise` (custom pricing, žádný self-checkout)
 *  - env var není nastaven nebo nemá platný `price_…` prefix
 */
export const getStripePriceId = (
  tier: Tier,
  period: BillingPeriod,
  envGetter: EnvGetter = defaultEnvGetter,
): string | null => {
  const envKey = PRICE_ENV_MAP[tier]?.[period];
  if (!envKey) return null;
  const raw = envGetter(envKey);
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.startsWith("price_") ? trimmed : null;
};

// --- Stripe → Internal status mapping ---

/**
 * Mapuje Stripe subscription status na interní status uložený v `user_profiles.subscription_status`.
 *
 * Stripe statusy (https://docs.stripe.com/api/subscriptions/object#subscription_object-status):
 *   trialing, active, past_due, canceled, unpaid, incomplete, incomplete_expired, paused
 *
 * Interní statusy (typy.ts): "active" | "trial" | "cancelled" | "expired" | "pending"
 *
 * Logika:
 *  - `active` → `active`
 *  - `trialing` → `trial`
 *  - `past_due` → `pending` (Stripe stále zkouší strhávat — uživatel má "grace period")
 *  - `incomplete` → `pending` (čeká na potvrzení první platby/3DS)
 *  - `canceled`, `paused` → `cancelled`
 *  - `unpaid`, `incomplete_expired` → `expired`
 *  - cokoliv neznámého → `expired` (defenzivní: defaultujeme na "ne aktivní")
 */
export const mapStripeSubscriptionStatusToInternal = (
  stripeStatus: string | null | undefined,
): InternalSubscriptionStatus => {
  switch ((stripeStatus ?? "").toLowerCase()) {
    case "active":
      return "active";
    case "trialing":
      return "trial";
    case "past_due":
    case "incomplete":
      return "pending";
    case "canceled":
    case "paused":
      return "cancelled";
    case "unpaid":
    case "incomplete_expired":
      return "expired";
    default:
      return "expired";
  }
};

// --- Stripe ID validation ---

const STRIPE_ID_PREFIXES = {
  customer: "cus_",
  subscription: "sub_",
  checkoutSession: "cs_",
  event: "evt_",
  price: "price_",
  invoice: "in_",
  paymentIntent: "pi_",
} as const;

export type StripeIdKind = keyof typeof STRIPE_ID_PREFIXES;

/**
 * Validuje, že hodnota odpovídá Stripe ID daného typu.
 *
 * Stripe ID = `<prefix>` + alfanumerika a podtržítka (test/live módy mají
 * `_test_`/`_live_` segment uvnitř ID, např. `cs_test_a1B2c3`). Max 255 znaků.
 * Defenzivně omezujeme délku na 1–255 a požadujeme alespoň 1 znak za prefixem.
 */
export const validateStripeId = (
  value: string | null | undefined,
  kind: StripeIdKind,
): value is string => {
  if (typeof value !== "string") return false;
  const prefix = STRIPE_ID_PREFIXES[kind];
  if (!value.startsWith(prefix)) return false;
  const rest = value.slice(prefix.length);
  if (rest.length === 0 || value.length > 255) return false;
  return /^[A-Za-z0-9_]+$/.test(rest);
};

// --- Metadata helpers ---

export interface ParsedStripeMetadata {
  userId?: string;
  orgId?: string;
  tier?: Tier;
  billingPeriod?: BillingPeriod;
  seats?: number;
}

const isTier = (value: unknown): value is Tier =>
  value === "starter" || value === "pro" || value === "enterprise";

const isBillingPeriod = (value: unknown): value is BillingPeriod =>
  value === "monthly" || value === "yearly";

/**
 * Bezpečně parsuje Stripe metadata (flat object string→string) do typovaného objektu.
 * Neznámé klíče ignoruje, špatné formáty (např. seats="abc") převádí na undefined.
 *
 * Stripe omezuje metadata: max 50 klíčů, klíč ≤ 40 znaků, hodnota ≤ 500 znaků.
 * Tady ale jen čteme — limity vynucuje Stripe sám při zápisu.
 */
export const parseStripeMetadata = (
  metadata: Record<string, string | null | undefined> | null | undefined,
): ParsedStripeMetadata => {
  if (!metadata || typeof metadata !== "object") return {};

  const result: ParsedStripeMetadata = {};

  const userId = metadata.userId;
  if (typeof userId === "string" && userId.length > 0) result.userId = userId;

  const orgId = metadata.orgId;
  if (typeof orgId === "string" && orgId.length > 0) result.orgId = orgId;

  const tier = metadata.tier;
  if (isTier(tier)) result.tier = tier;

  const billingPeriod = metadata.billingPeriod;
  if (isBillingPeriod(billingPeriod)) result.billingPeriod = billingPeriod;

  const seats = metadata.seats;
  if (typeof seats === "string" && seats.length > 0) {
    const parsed = Number.parseInt(seats, 10);
    if (Number.isFinite(parsed) && parsed > 0) result.seats = parsed;
  }

  return result;
};

// --- Subscription Lifecycle Helpers (sdílené s gopayHelpers) ---

/**
 * Spočítá nové datum vypršení subscription od `now` podle billing period.
 * Stripe poskytuje `current_period_end` přímo, ale tato funkce slouží jako
 * fallback pro případ, kdy Stripe response chybí (např. test fixtures).
 */
export const calculateExpiresAtFromPeriod = (
  billingPeriod: BillingPeriod | string,
  now: Date = new Date(),
): Date => {
  const result = new Date(now.getTime());
  if (billingPeriod === "yearly") {
    result.setFullYear(result.getFullYear() + 1);
  } else {
    result.setMonth(result.getMonth() + 1);
  }
  return result;
};

/**
 * Konvertuje Stripe `current_period_end` (UNIX timestamp v sekundách) na Date.
 * Vrací `null` pokud vstup není kladné číslo.
 */
export const stripePeriodEndToDate = (
  unixSeconds: number | null | undefined,
): Date | null => {
  if (typeof unixSeconds !== "number" || !Number.isFinite(unixSeconds) || unixSeconds <= 0) {
    return null;
  }
  return new Date(unixSeconds * 1000);
};
