import Stripe from "npm:stripe@14.21.0";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type BillingPeriod = "monthly" | "yearly";
export type Tier = "starter" | "pro" | "enterprise";
export type PaymentMethodPreference = "auto" | "wallet_first";

const DEV_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

export const getStripeClient = () => {
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  return new Stripe(secretKey, {
    apiVersion: "2023-10-16",
    httpClient: Stripe.createFetchHttpClient(),
  });
};

export const getPriceId = (tier: Tier, billingPeriod: BillingPeriod) => {
  const starterMonthly = Deno.env.get("STRIPE_PRICE_ID_STARTER_MONTHLY") || "";
  const starterYearly = Deno.env.get("STRIPE_PRICE_ID_STARTER_YEARLY") || "";
  const proMonthly = Deno.env.get("STRIPE_PRICE_ID_PRO_MONTHLY") || "";
  const proYearly = Deno.env.get("STRIPE_PRICE_ID_PRO_YEARLY") || "";
  const enterpriseMonthly = Deno.env.get("STRIPE_PRICE_ID_ENTERPRISE_MONTHLY") || "";
  const enterpriseYearly = Deno.env.get("STRIPE_PRICE_ID_ENTERPRISE_YEARLY") || "";

  if (tier === "starter" && billingPeriod === "monthly") return starterMonthly;
  if (tier === "starter" && billingPeriod === "yearly") return starterYearly;
  if (tier === "pro" && billingPeriod === "monthly") return proMonthly;
  if (tier === "pro" && billingPeriod === "yearly") return proYearly;
  if (tier === "enterprise" && billingPeriod === "monthly") return enterpriseMonthly;
  if (tier === "enterprise" && billingPeriod === "yearly") return enterpriseYearly;
  return "";
};

export const getPriceToTierMap = () => {
  return {
    [Deno.env.get("STRIPE_PRICE_ID_STARTER_MONTHLY") || ""]: "starter",
    [Deno.env.get("STRIPE_PRICE_ID_STARTER_YEARLY") || ""]: "starter",
    [Deno.env.get("STRIPE_PRICE_ID_PRO_MONTHLY") || ""]: "pro",
    [Deno.env.get("STRIPE_PRICE_ID_PRO_YEARLY") || ""]: "pro",
    [Deno.env.get("STRIPE_PRICE_ID_ENTERPRISE_MONTHLY") || ""]: "enterprise",
    [Deno.env.get("STRIPE_PRICE_ID_ENTERPRISE_YEARLY") || ""]: "enterprise",
  };
};

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

type BillingProfile = {
  stripe_customer_id: string | null;
  billing_customer_id: string | null;
  display_name: string | null;
};

export const resolveBillingCustomerId = (
  profile: BillingProfile | null | undefined,
): string =>
  profile?.billing_customer_id || profile?.stripe_customer_id || "";

export const loadBillingProfile = async (
  service: SupabaseClient,
  userId: string,
): Promise<BillingProfile | null> => {
  const { data, error } = await service
    .from("user_profiles")
    .select("stripe_customer_id, billing_customer_id, display_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to load user profile");
  }

  return (data ?? null) as BillingProfile | null;
};

export const persistBillingCustomerId = async (
  service: SupabaseClient,
  userId: string,
  customerId: string,
) => {
  const { error } = await service
    .from("user_profiles")
    .update({
      stripe_customer_id: customerId,
      billing_customer_id: customerId,
      billing_provider: "stripe",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    throw new Error("Failed to store Stripe customer");
  }
};

export const getOrCreateBillingCustomer = async (args: {
  service: SupabaseClient;
  stripe: Stripe;
  userId: string;
  email?: string | null;
  fullName?: string | null;
}): Promise<string> => {
  const profile = await loadBillingProfile(args.service, args.userId);
  const existingCustomerId = resolveBillingCustomerId(profile);
  const normalizedFullName =
    (args.fullName || profile?.display_name || "")
      .trim()
      .replace(/\s+/g, " ") || undefined;

  if (existingCustomerId) {
    if (profile?.stripe_customer_id !== existingCustomerId || profile?.billing_customer_id !== existingCustomerId) {
      await persistBillingCustomerId(args.service, args.userId, existingCustomerId);
    }

    if (normalizedFullName) {
      try {
        await args.stripe.customers.update(existingCustomerId, {
          name: normalizedFullName,
        });
      } catch (error) {
        console.warn("Failed to sync Stripe customer name", error);
      }
    }

    return existingCustomerId;
  }

  const customer = await args.stripe.customers.create({
    email: args.email || undefined,
    name: normalizedFullName,
    metadata: { userId: args.userId },
  });

  await persistBillingCustomerId(args.service, args.userId, customer.id);
  return customer.id;
};
