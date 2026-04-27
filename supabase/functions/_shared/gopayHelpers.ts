/**
 * Čisté helpery pro GoPay integraci — bez závislosti na Deno/Supabase, takže jdou
 * importovat ze synchronních test runnerů (Vitest) i z Deno Edge Functions.
 *
 * Plán platby a runtime API jsou v `gopayBilling.ts`.
 */

export type BillingPeriod = "monthly" | "yearly";
export type Tier = "starter" | "pro" | "enterprise";

// --- Plan Configuration ---

const PLAN_PRICES: Record<Tier, { monthly: number; yearly: number }> = {
  starter: { monthly: 39900, yearly: 383040 }, // V haléřích: 399 CZK / 3830.40 CZK
  pro: { monthly: 49900, yearly: 479000 }, // 499 CZK / 4790 CZK
  enterprise: { monthly: 0, yearly: 0 }, // Custom pricing
};

const PLAN_LABELS: Record<Tier, string> = {
  starter: "Tender Flow Starter",
  pro: "Tender Flow Pro",
  enterprise: "Tender Flow Enterprise",
};

export const getPlanAmount = (tier: Tier, period: BillingPeriod): number =>
  PLAN_PRICES[tier]?.[period] ?? 0;

export const getPlanDescription = (tier: Tier, period: BillingPeriod): string =>
  `${PLAN_LABELS[tier] ?? tier} (${period === "yearly" ? "roční" : "měsíční"})`;

// --- Recurrence Helpers ---

export const getRecurrencePeriod = (period: BillingPeriod): number =>
  period === "yearly" ? 12 : 1;

/**
 * GoPay vyžaduje konkrétní `recurrence_date_to` (yyyy-MM-dd), kdy systém ukončí strhávání.
 * Vracíme `now + 10 let` v UTC; GoPay omezuje horní hranici na 2099-12-31, do té doby je rezerva.
 */
export const getRecurrenceEndDate = (now: Date = new Date()): string => {
  const date = new Date(now.getTime());
  date.setUTCFullYear(date.getUTCFullYear() + 10);
  return date.toISOString().slice(0, 10);
};

// --- Order Number ---

/**
 * Generuje unikátní `order_number` pro GoPay platbu.
 * Formát: `<prefix>-<idHint8>-<tier>-<random12>`. Random suffix je 12 hex znaků z UUID
 * (96 bitů entropie) — kolize prakticky nemožná, narozdíl od Date.now() který může
 * při dvojkliku vytvořit identický string.
 */
export const generateOrderNumber = (
  prefix: "TF" | "TF-ORG",
  idHint: string,
  tier: string,
  uuidSource: () => string = () => crypto.randomUUID(),
): string => {
  const random = uuidSource().replace(/-/g, "").slice(0, 12);
  const safeHint = (idHint || "").slice(0, 8);
  return `${prefix}-${safeHint}-${tier}-${random}`;
};

// --- Payment ID Validation ---

/**
 * GoPay payment ID je 64-bit integer (decimální). Validujeme jako 1–20 cifer
 * (max signed int64 má 19 cifer, bezpečně pokrýváme i unsigned).
 */
export const isValidPaymentId = (
  value: string | null | undefined,
): value is string =>
  typeof value === "string" && /^\d{1,20}$/.test(value);

// --- additional_params Helpers ---

export const getAdditionalParam = (
  params: Array<{ name: string; value: string }> | undefined,
  name: string,
): string | undefined => params?.find((p) => p.name === name)?.value;

// --- Subscription Lifecycle Helpers ---

/**
 * Spočítá nové datum vypršení subscription od `now` podle billing period.
 * Monthly = +1 měsíc, yearly = +1 rok. Mutuje vlastní kopii, ne vstup.
 */
export const calculateExpiresAt = (
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
 * Rozhoduje, zda nastavit `subscription_started_at` na DB řádku.
 * Logika: nastavit jen pokud nový status je "active" a v DB ještě hodnota chybí
 * (zachovat datum prvního ever předplatného přes recurring renewals).
 */
export const shouldInitializeStartedAt = (
  newStatus: string,
  existingStartedAt: string | null | undefined,
): boolean => newStatus === "active" && !existingStartedAt;
