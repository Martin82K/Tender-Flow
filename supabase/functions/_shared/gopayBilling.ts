import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type BillingPeriod = "monthly" | "yearly";
export type Tier = "starter" | "pro" | "enterprise";

// --- OAuth2 Token Management ---

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

export const getGopayAccessToken = async (
  scope: "payment-create" | "payment-all" = "payment-all",
): Promise<string> => {
  // Return cached token if still valid (with 2-minute buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 120_000) {
    return cachedToken.accessToken;
  }

  const clientId = Deno.env.get("GOPAY_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("GOPAY_CLIENT_SECRET") || "";
  const apiUrl = Deno.env.get("GOPAY_API_URL") || "https://gw.sandbox.gopay.com/api";

  if (!clientId || !clientSecret) {
    throw new Error("Missing GOPAY_CLIENT_ID or GOPAY_CLIENT_SECRET");
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);

  const response = await fetch(`${apiUrl}/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: `grant_type=client_credentials&scope=${scope}`,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GoPay OAuth2 failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 1800) * 1000,
  };

  return cachedToken.accessToken;
};

// --- GoPay API Client ---

export const gopayFetch = async <T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> => {
  const apiUrl = Deno.env.get("GOPAY_API_URL") || "https://gw.sandbox.gopay.com/api";
  const token = await getGopayAccessToken();

  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Handle 401 — token expired, retry once with fresh token
  if (response.status === 401) {
    cachedToken = null;
    const freshToken = await getGopayAccessToken();
    const retry = await fetch(`${apiUrl}${path}`, {
      method,
      headers: {
        "Authorization": `Bearer ${freshToken}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!retry.ok) {
      const text = await retry.text();
      throw new Error(`GoPay API error (${retry.status}): ${text}`);
    }
    return retry.json();
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GoPay API error (${response.status}): ${text}`);
  }

  return response.json();
};

// --- Payment API Methods ---

export interface GopayPaymentRequest {
  amount: number;
  currency: string;
  order_number: string;
  order_description?: string;
  payer: {
    email?: string;
    allowed_payment_instruments?: string[];
    contact?: {
      first_name?: string;
      last_name?: string;
      email?: string;
    };
  };
  target: {
    type: "ACCOUNT";
    goid: number;
  };
  callback: {
    return_url: string;
    notification_url: string;
  };
  recurrence?: {
    recurrence_cycle: "DAY" | "WEEK" | "MONTH";
    recurrence_period: number;
    recurrence_date_to: string; // yyyy-MM-dd
  };
  additional_params?: Array<{ name: string; value: string }>;
  items: Array<{
    type?: string;
    name: string;
    amount: number;
    count?: number;
  }>;
  lang?: string;
}

export interface GopayPaymentResponse {
  id: number;
  order_number: string;
  state: string;
  amount: number;
  currency: string;
  payer?: {
    payment_instrument?: string;
    email?: string;
  };
  target?: { type: string; goid: number };
  additional_params?: Array<{ name: string; value: string }>;
  recurrence?: {
    recurrence_cycle: string;
    recurrence_period: number;
    recurrence_date_to: string;
    recurrence_state: string;
  };
  gw_url?: string;
  parent_id?: number;
}

export const createPayment = (
  request: GopayPaymentRequest,
): Promise<GopayPaymentResponse> =>
  gopayFetch<GopayPaymentResponse>("POST", "/payments/payment", request);

export const getPaymentStatus = (
  paymentId: string | number,
): Promise<GopayPaymentResponse> =>
  gopayFetch<GopayPaymentResponse>("GET", `/payments/payment/${paymentId}`);

export const voidRecurrence = (
  paymentId: string | number,
): Promise<unknown> =>
  gopayFetch("POST", `/payments/payment/${paymentId}/void-recurrence`);

export const createRecurrence = (
  parentPaymentId: string | number,
  body: { amount: number; currency: string; order_number: string; items: Array<{ name: string; amount: number; count: number }> },
): Promise<GopayPaymentResponse> =>
  gopayFetch<GopayPaymentResponse>("POST", `/payments/payment/${parentPaymentId}/create-recurrence`, body);

export const refundPayment = (
  paymentId: string | number,
  amount: number,
): Promise<unknown> =>
  gopayFetch("POST", `/payments/payment/${paymentId}/refund`, { amount });

// --- Plan Configuration ---

const PLAN_PRICES: Record<Tier, { monthly: number; yearly: number }> = {
  starter: { monthly: 39900, yearly: 383040 }, // In hellers: 399 CZK / 3830.40 CZK
  pro: { monthly: 49900, yearly: 479000 },     // 499 CZK / 4790 CZK
  enterprise: { monthly: 0, yearly: 0 },        // Custom pricing
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

export const getRecurrenceCycle = (period: BillingPeriod): "MONTH" | "MONTH" =>
  "MONTH"; // GoPay doesn't have YEAR cycle, so yearly = 12 months

export const getRecurrencePeriod = (period: BillingPeriod): number =>
  period === "yearly" ? 12 : 1;

export const getRecurrenceEndDate = (): string => "2030-12-31";

// --- URL Validation (ported from stripeBilling.ts) ---

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

// --- Billing Profile Helpers ---

type BillingProfile = {
  billing_customer_id: string | null;
  billing_subscription_id: string | null;
  display_name: string | null;
};

export const loadBillingProfile = async (
  service: SupabaseClient,
  userId: string,
): Promise<BillingProfile | null> => {
  const { data, error } = await service
    .from("user_profiles")
    .select("billing_customer_id, billing_subscription_id, display_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to load user profile");
  }

  return (data ?? null) as BillingProfile | null;
};

export const persistBillingIds = async (
  service: SupabaseClient,
  userId: string,
  paymentId: string | number,
) => {
  const { error } = await service
    .from("user_profiles")
    .update({
      billing_subscription_id: String(paymentId),
      billing_provider: "gopay",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    throw new Error("Failed to store GoPay payment ID");
  }
};

// --- Notification URL Helper ---

export const getNotificationUrl = (): string => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  return `${supabaseUrl}/functions/v1/gopay-webhook`;
};

// --- GoPay additional_params helpers ---

export const getAdditionalParam = (
  params: Array<{ name: string; value: string }> | undefined,
  name: string,
): string | undefined =>
  params?.find((p) => p.name === name)?.value;
