import { describe, expect, it } from "vitest";
import {
  calculateExpiresAtFromPeriod,
  calculateStripeAmount,
  getStripePlanLabel,
  getStripePriceId,
  mapStripeSubscriptionStatusToInternal,
  parseStripeMetadata,
  stripePeriodEndToDate,
  validateStripeId,
} from "../supabase/functions/_shared/stripeHelpers.ts";

describe("stripeHelpers — calculateStripeAmount", () => {
  it("starter monthly × 1 = 39900 haléřů (399 Kč)", () => {
    expect(calculateStripeAmount("starter", "monthly")).toBe(39900);
  });

  it("pro yearly × 1 = 479000 haléřů (4790 Kč)", () => {
    expect(calculateStripeAmount("pro", "yearly")).toBe(479000);
  });

  it("starter monthly × 5 = 199500 (5 seats)", () => {
    expect(calculateStripeAmount("starter", "monthly", 5)).toBe(199500);
  });

  it("enterprise vrací 0 (custom pricing)", () => {
    expect(calculateStripeAmount("enterprise", "monthly")).toBe(0);
  });

  it("zaokrouhluje quantity dolů", () => {
    expect(calculateStripeAmount("pro", "monthly", 2.7)).toBe(49900 * 2);
  });

  it("nevalidní quantity (0, NaN, záporné) vrací 0", () => {
    expect(calculateStripeAmount("pro", "monthly", 0)).toBe(0);
    expect(calculateStripeAmount("pro", "monthly", -3)).toBe(0);
    expect(calculateStripeAmount("pro", "monthly", Number.NaN)).toBe(0);
  });
});

describe("stripeHelpers — getStripePlanLabel", () => {
  it("monthly = 'měsíční'", () => {
    expect(getStripePlanLabel("starter", "monthly")).toBe(
      "Tender Flow Starter (měsíční)",
    );
  });

  it("yearly = 'roční'", () => {
    expect(getStripePlanLabel("pro", "yearly")).toBe(
      "Tender Flow Pro (roční)",
    );
  });
});

describe("stripeHelpers — getStripePriceId", () => {
  const env: Record<string, string | undefined> = {
    STRIPE_PRICE_STARTER_MONTHLY: "price_starter_monthly_123",
    STRIPE_PRICE_STARTER_YEARLY: "price_starter_yearly_456",
    STRIPE_PRICE_PRO_MONTHLY: "price_pro_monthly_789",
    STRIPE_PRICE_PRO_YEARLY: "price_pro_yearly_000",
  };
  const getter = (key: string) => env[key];

  it("vrací price ID pro starter monthly", () => {
    expect(getStripePriceId("starter", "monthly", getter)).toBe(
      "price_starter_monthly_123",
    );
  });

  it("vrací price ID pro pro yearly", () => {
    expect(getStripePriceId("pro", "yearly", getter)).toBe("price_pro_yearly_000");
  });

  it("trimuje whitespace v env hodnotě", () => {
    expect(
      getStripePriceId("starter", "monthly", () => "  price_with_spaces  "),
    ).toBe("price_with_spaces");
  });

  it("vrací null když env var chybí", () => {
    expect(getStripePriceId("pro", "monthly", () => undefined)).toBeNull();
  });

  it("vrací null když hodnota nemá price_ prefix (defenzivní)", () => {
    expect(getStripePriceId("pro", "monthly", () => "sk_live_evil")).toBeNull();
  });

  it("enterprise vrací null nezávisle na env", () => {
    expect(getStripePriceId("enterprise", "monthly", () => "price_enterprise")).toBeNull();
    expect(getStripePriceId("enterprise", "yearly", () => "price_enterprise")).toBeNull();
  });

  it("default getter nepadá v Vitest prostředí (Deno.env neexistuje)", () => {
    // V Vitest běží Node, Deno globální není definován. Bez explicit env vars:
    // metoda musí vrátit null (process.env nedefinuje STRIPE_PRICE_*).
    expect(getStripePriceId("starter", "monthly")).toBeNull();
  });
});

describe("stripeHelpers — mapStripeSubscriptionStatusToInternal", () => {
  it.each([
    ["active", "active"],
    ["trialing", "trial"],
    ["past_due", "pending"],
    ["incomplete", "pending"],
    ["canceled", "cancelled"],
    ["paused", "cancelled"],
    ["unpaid", "expired"],
    ["incomplete_expired", "expired"],
    ["", "expired"],
    ["unknown_future_status", "expired"],
  ])("mapuje '%s' → '%s'", (stripeStatus, expected) => {
    expect(mapStripeSubscriptionStatusToInternal(stripeStatus)).toBe(expected);
  });

  it("toleruje case-insensitive vstup", () => {
    expect(mapStripeSubscriptionStatusToInternal("ACTIVE")).toBe("active");
    expect(mapStripeSubscriptionStatusToInternal("Trialing")).toBe("trial");
  });

  it("toleruje null/undefined → expired", () => {
    expect(mapStripeSubscriptionStatusToInternal(null)).toBe("expired");
    expect(mapStripeSubscriptionStatusToInternal(undefined)).toBe("expired");
  });
});

describe("stripeHelpers — validateStripeId", () => {
  it.each([
    ["cus_ABC123", "customer", true],
    ["cus_", "customer", false], // empty after prefix
    ["cust_abc", "customer", false], // wrong prefix
    ["sub_1Abc234Def", "subscription", true],
    ["cs_test_abc123", "checkoutSession", true], // test mode ID — underscore validní v rest části
    ["evt_1234567890", "event", true],
    ["price_1Q123abc", "price", true],
    ["", "customer", false],
    [null, "customer", false],
    [undefined, "subscription", false],
    ["cus_special!", "customer", false], // special char
    ["cus_abc def", "customer", false], // whitespace
  ])("validateStripeId(%p, %p) === %p", (value, kind, expected) => {
    expect(
      validateStripeId(value as string | null | undefined, kind as never),
    ).toBe(expected);
  });

  it("odmítá ID delší než 255 znaků", () => {
    const longId = `cus_${"a".repeat(300)}`;
    expect(validateStripeId(longId, "customer")).toBe(false);
  });

  it("akceptuje ID na hraně 255 znaků", () => {
    const limitId = `cus_${"a".repeat(251)}`; // 4 + 251 = 255
    expect(limitId.length).toBe(255);
    expect(validateStripeId(limitId, "customer")).toBe(true);
  });
});

describe("stripeHelpers — parseStripeMetadata", () => {
  it("parsuje validní metadata kompletně", () => {
    expect(
      parseStripeMetadata({
        userId: "u-123",
        orgId: "org-456",
        tier: "pro",
        billingPeriod: "yearly",
        seats: "10",
      }),
    ).toEqual({
      userId: "u-123",
      orgId: "org-456",
      tier: "pro",
      billingPeriod: "yearly",
      seats: 10,
    });
  });

  it("vrací prázdný objekt pro null/undefined", () => {
    expect(parseStripeMetadata(null)).toEqual({});
    expect(parseStripeMetadata(undefined)).toEqual({});
  });

  it("ignoruje neznámý tier", () => {
    expect(parseStripeMetadata({ tier: "ultra" })).toEqual({});
  });

  it("ignoruje neznámý billingPeriod", () => {
    expect(parseStripeMetadata({ billingPeriod: "weekly" })).toEqual({});
  });

  it("ignoruje nečíselné seats", () => {
    expect(parseStripeMetadata({ seats: "abc" })).toEqual({});
  });

  it("ignoruje seats <= 0", () => {
    expect(parseStripeMetadata({ seats: "0" })).toEqual({});
    expect(parseStripeMetadata({ seats: "-5" })).toEqual({});
  });

  it("ignoruje prázdné string hodnoty", () => {
    expect(parseStripeMetadata({ userId: "", orgId: "" })).toEqual({});
  });

  it("toleruje null/undefined hodnoty v jednotlivých klíčích", () => {
    expect(
      parseStripeMetadata({ userId: "u-1", orgId: null, tier: undefined }),
    ).toEqual({ userId: "u-1" });
  });
});

describe("stripeHelpers — calculateExpiresAtFromPeriod", () => {
  it("monthly = +1 měsíc od now", () => {
    const result = calculateExpiresAtFromPeriod(
      "monthly",
      new Date("2026-04-27T12:00:00Z"),
    );
    expect(result.toISOString()).toBe("2026-05-27T12:00:00.000Z");
  });

  it("yearly = +1 rok od now", () => {
    const result = calculateExpiresAtFromPeriod(
      "yearly",
      new Date("2026-04-27T12:00:00Z"),
    );
    expect(result.toISOString()).toBe("2027-04-27T12:00:00.000Z");
  });

  it("nemutuje vstupní now Date", () => {
    const now = new Date("2026-04-27T12:00:00Z");
    calculateExpiresAtFromPeriod("monthly", now);
    expect(now.toISOString()).toBe("2026-04-27T12:00:00.000Z");
  });

  it("neznámý period defaultuje na monthly", () => {
    const result = calculateExpiresAtFromPeriod(
      "weird" as never,
      new Date("2026-04-27T12:00:00Z"),
    );
    expect(result.toISOString()).toBe("2026-05-27T12:00:00.000Z");
  });
});

describe("stripeHelpers — stripePeriodEndToDate", () => {
  it("převádí UNIX seconds na Date (UTC)", () => {
    // 1777723200 = 2026-05-02T12:00:00Z
    const result = stripePeriodEndToDate(1777723200);
    expect(result).not.toBeNull();
    expect(result?.toISOString()).toBe("2026-05-02T12:00:00.000Z");
  });

  it("vrací null pro 0, záporné, NaN, null, undefined", () => {
    expect(stripePeriodEndToDate(0)).toBeNull();
    expect(stripePeriodEndToDate(-1)).toBeNull();
    expect(stripePeriodEndToDate(Number.NaN)).toBeNull();
    expect(stripePeriodEndToDate(null)).toBeNull();
    expect(stripePeriodEndToDate(undefined)).toBeNull();
  });
});
