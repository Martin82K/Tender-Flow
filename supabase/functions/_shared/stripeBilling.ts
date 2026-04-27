/**
 * Stripe API client + webhook signature verification (Deno Edge Functions).
 *
 * Pure helpery (mapping, validace, ceník) jsou v `stripeHelpers.ts` a re-exportujeme
 * je tady, aby Edge funkce stačil jeden import z `_shared/stripeBilling.ts` (mirror
 * struktury `gopayBilling.ts`).
 */

export * from "./stripeHelpers.ts";

import type { Tier } from "./stripeHelpers.ts";

// --- Konfigurace ---

const DEFAULT_API_URL = "https://api.stripe.com/v1";
// Stripe API verze. `2025-04-30.acacia` neexistuje (acacia skončila před 2025);
// aktuální named releases jsou basil → clover → dahlia. Override přes env, jinak
// pinujeme na poslední dahlia (2026-04-22), ke které je kód testován. Account API
// version v Stripe Dashboardu nemusí být stejná — Stripe-Version header má vždy
// přednost před account default.
const DEFAULT_API_VERSION = "2026-04-22.dahlia";
const MAX_FETCH_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 250;

const getStripeSecretKey = (): string => {
  const key = Deno.env.get("STRIPE_SECRET_KEY") || "";
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  if (!key.startsWith("sk_")) {
    throw new Error("Invalid STRIPE_SECRET_KEY (expected sk_… prefix)");
  }
  return key;
};

const getApiUrl = (): string =>
  (Deno.env.get("STRIPE_API_URL") || DEFAULT_API_URL).replace(/\/$/, "");

const getApiVersion = (): string =>
  Deno.env.get("STRIPE_API_VERSION") || DEFAULT_API_VERSION;

// --- Form-urlencoded serializace pro Stripe API (nested params) ---

function* flattenStripeParams(
  value: unknown,
  prefix: string,
): Generator<[string, string]> {
  if (value === null || value === undefined) return;

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const itemPrefix = prefix ? `${prefix}[${i}]` : `${i}`;
      yield* flattenStripeParams(value[i], itemPrefix);
    }
    return;
  }

  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const itemPrefix = prefix ? `${prefix}[${k}]` : k;
      yield* flattenStripeParams(v, itemPrefix);
    }
    return;
  }

  if (typeof value === "boolean") {
    yield [prefix, value ? "true" : "false"];
    return;
  }

  yield [prefix, String(value)];
}

/**
 * Serializuje JS objekt do Stripe-style form-urlencoded řetězce.
 * Příklad: `{ metadata: { userId: "u-1" }, line_items: [{ price: "price_x", quantity: 2 }] }`
 *   → `metadata[userId]=u-1&line_items[0][price]=price_x&line_items[0][quantity]=2`
 */
export const stripeStringify = (params: Record<string, unknown>): string => {
  const search = new URLSearchParams();
  for (const [k, v] of flattenStripeParams(params, "")) {
    search.append(k, v);
  }
  return search.toString();
};

// --- API client ---

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isRetryable = (status: number): boolean =>
  status === 429 || (status >= 500 && status < 600);

const buildHeaders = (idempotencyKey?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${getStripeSecretKey()}`,
    "Content-Type": "application/x-www-form-urlencoded",
    "Accept": "application/json",
    "Stripe-Version": getApiVersion(),
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  return headers;
};

export const stripeFetch = async <T = unknown>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<T> => {
  const url = `${getApiUrl()}${path}`;
  const encodedBody = body ? stripeStringify(body) : undefined;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_FETCH_RETRIES; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: buildHeaders(idempotencyKey),
        body: encodedBody,
      });
    } catch (err) {
      // Network error (DNS, TCP reset). Retry s backoff.
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_FETCH_RETRIES - 1) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
        continue;
      }
      throw lastError;
    }

    if (response.ok) {
      return response.json() as Promise<T>;
    }

    const text = await response.text();

    if (isRetryable(response.status) && attempt < MAX_FETCH_RETRIES - 1) {
      lastError = new Error(`Stripe API ${response.status}: ${text.slice(0, 200)}`);
      const retryAfter = Number(response.headers.get("Retry-After")) || 0;
      const delay = retryAfter > 0
        ? Math.min(retryAfter * 1000, 5000)
        : RETRY_BASE_DELAY_MS * 2 ** attempt;
      await sleep(delay);
      continue;
    }

    throw new Error(
      `Stripe API error (${response.status}): ${text.slice(0, 500)}`,
    );
  }

  throw lastError ?? new Error("Stripe API: unknown failure");
};

// --- API wrappery ---

export interface StripeCheckoutSessionLineItem {
  price: string;
  quantity: number;
}

export interface CreateCheckoutSessionInput {
  mode: "subscription";
  line_items: StripeCheckoutSessionLineItem[];
  success_url: string;
  cancel_url: string;
  customer?: string;
  customer_email?: string;
  client_reference_id?: string;
  metadata?: Record<string, string>;
  subscription_data?: {
    metadata?: Record<string, string>;
    trial_period_days?: number;
  };
  allow_promotion_codes?: boolean;
  locale?: string;
}

export interface StripeCheckoutSession {
  id: string;
  url: string | null;
  mode: string;
  status: string | null;
  customer: string | null;
  customer_email: string | null;
  client_reference_id: string | null;
  subscription: string | null;
  metadata: Record<string, string> | null;
  payment_status: string | null;
}

export const createCheckoutSession = (
  input: CreateCheckoutSessionInput,
  idempotencyKey?: string,
): Promise<StripeCheckoutSession> =>
  stripeFetch<StripeCheckoutSession>(
    "POST",
    "/checkout/sessions",
    input as unknown as Record<string, unknown>,
    idempotencyKey,
  );

export const retrieveCheckoutSession = (
  sessionId: string,
): Promise<StripeCheckoutSession> =>
  stripeFetch<StripeCheckoutSession>("GET", `/checkout/sessions/${encodeURIComponent(sessionId)}`);

export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  trial_end: number | null;
  items: {
    data: Array<{
      price: { id: string; recurring?: { interval: string; interval_count: number } };
      quantity: number;
    }>;
  };
  metadata: Record<string, string> | null;
}

export const retrieveSubscription = (
  subscriptionId: string,
): Promise<StripeSubscription> =>
  stripeFetch<StripeSubscription>(
    "GET",
    `/subscriptions/${encodeURIComponent(subscriptionId)}`,
  );

export const cancelSubscriptionAtPeriodEnd = (
  subscriptionId: string,
  idempotencyKey?: string,
): Promise<StripeSubscription> =>
  stripeFetch<StripeSubscription>(
    "POST",
    `/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { cancel_at_period_end: true },
    idempotencyKey,
  );

export interface StripeCustomer {
  id: string;
  email: string | null;
  metadata: Record<string, string> | null;
  invoice_settings?: {
    default_payment_method?: string | null;
  };
}

export const retrieveCustomer = (
  customerId: string,
): Promise<StripeCustomer> =>
  stripeFetch<StripeCustomer>(
    "GET",
    `/customers/${encodeURIComponent(customerId)}`,
  );

// --- Webhook signature verification (HMAC SHA-256) ---

/**
 * Stripe `Stripe-Signature` header format:
 *   `t=1492774577,v1=5257a869e7…,v0=…`
 *
 * Ověření:
 *  1. Parse `t` (timestamp) a všechny `v1` hodnoty.
 *  2. signed_payload = `t + "." + raw_body`.
 *  3. HMAC-SHA256(signed_payload, secret).
 *  4. Constant-time porovnání s každou v1.
 *  5. Tolerance: timestamp ne starší než `toleranceSeconds` (default 300s = 5 min).
 *
 * Reference: https://docs.stripe.com/webhooks/signatures#verify-manually
 */
export interface StripeWebhookVerifyResult {
  valid: boolean;
  reason?: string;
  timestamp?: number;
}

const parseSignatureHeader = (
  header: string,
): { timestamp: number; signatures: string[] } | null => {
  const parts = header.split(",").map((p) => p.trim()).filter(Boolean);
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (key === "t") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed > 0) timestamp = parsed;
    } else if (key === "v1") {
      signatures.push(value);
    }
  }

  if (timestamp === null || signatures.length === 0) return null;
  return { timestamp, signatures };
};

const constantTimeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};

const computeHmacHex = async (
  payload: string,
  secret: string,
): Promise<string> => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export const verifyStripeWebhookSignature = async (
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
  toleranceSeconds = 300,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<StripeWebhookVerifyResult> => {
  if (!signatureHeader) {
    return { valid: false, reason: "Missing Stripe-Signature header" };
  }
  if (!secret) {
    return { valid: false, reason: "Missing webhook secret" };
  }

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) {
    return { valid: false, reason: "Malformed Stripe-Signature header" };
  }

  const { timestamp, signatures } = parsed;

  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return {
      valid: false,
      reason: "Timestamp outside tolerance window",
      timestamp,
    };
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = await computeHmacHex(signedPayload, secret);

  for (const sig of signatures) {
    if (constantTimeEqual(expected, sig)) {
      return { valid: true, timestamp };
    }
  }

  return { valid: false, reason: "Signature mismatch", timestamp };
};

// --- Redirect URL allowlist (sdílené chování s gopayBilling) ---

const DEV_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const normalizeOrigin = (value: string): string => {
  try {
    const parsed = new URL(value.trim());
    return parsed.origin;
  } catch {
    return "";
  }
};

const getAllowedOrigins = (): Set<string> => {
  const siteUrl = Deno.env.get("SITE_URL") || "";
  const rawAllowlist = Deno.env.get("ALLOWED_CHECKOUT_ORIGINS") || "";
  const configuredOrigins = rawAllowlist
    .split(",")
    .map((entry) => normalizeOrigin(entry))
    .filter(Boolean);
  const siteOrigin = normalizeOrigin(siteUrl);

  return new Set([
    ...DEV_ALLOWED_ORIGINS,
    ...(siteOrigin ? [siteOrigin] : []),
    ...configuredOrigins,
  ]);
};

const isLocalOrigin = (origin: string): boolean =>
  origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");

export const validateAllowedRedirectUrl = (candidateUrl: string): boolean => {
  if (!candidateUrl) return false;

  let parsed: URL;
  try {
    parsed = new URL(candidateUrl);
  } catch {
    return false;
  }

  const isHttpLocal = parsed.protocol === "http:" && isLocalOrigin(parsed.origin);
  const isHttps = parsed.protocol === "https:";
  if (!isHttpLocal && !isHttps) return false;

  return getAllowedOrigins().has(parsed.origin);
};

// --- Webhook URL builders ---

export const getStripeUserWebhookUrl = (): string => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  return `${supabaseUrl}/functions/v1/stripe-webhook`;
};

export const getStripeOrgWebhookUrl = (): string => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  return `${supabaseUrl}/functions/v1/stripe-org-webhook`;
};

// --- Helpers pro line items ---

export interface BuildLineItemInput {
  priceId: string;
  quantity: number;
}

export const buildLineItems = (
  inputs: BuildLineItemInput[],
): StripeCheckoutSessionLineItem[] =>
  inputs.map(({ priceId, quantity }) => ({
    price: priceId,
    quantity: Math.max(1, Math.floor(quantity)),
  }));

// Re-export Tier type pro pohodlí v Edge Functions
export type { Tier };
