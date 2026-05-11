import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { invokeAuthedFunction } from "../services/functionsClient";
import {
  paymentProviderService,
  getActiveBillingProvider,
} from "../services/paymentProviderService";

vi.mock("../services/functionsClient", () => ({
  invokeAuthedFunction: vi.fn(),
}));

describe("paymentProviderService — Stripe-only routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("vrací stripe jako jediného aktivního providera", () => {
    vi.stubEnv("VITE_BILLING_PROVIDER", "paddle");
    expect(getActiveBillingProvider()).toBe("stripe");
  });

  it("createUserCheckoutSession volá stripe-create-payment a normalizuje sessionId", async () => {
    vi.mocked(invokeAuthedFunction).mockResolvedValueOnce({
      success: true,
      paymentUrl: "https://checkout.stripe.com/c/cs_test_abc",
      sessionId: "cs_test_abc",
    });

    const result = await paymentProviderService.createUserCheckoutSession({
      tier: "starter",
      billingPeriod: "yearly",
      successUrl: "http://localhost:3000/ok",
      cancelUrl: "http://localhost:3000/cancel",
    });

    expect(invokeAuthedFunction).toHaveBeenCalledWith(
      "stripe-create-payment",
      expect.objectContaining({
        body: expect.objectContaining({ tier: "starter", billingPeriod: "yearly" }),
      }),
    );
    expect(result.success).toBe(true);
    expect(result.paymentId).toBe("cs_test_abc");
    expect(result.checkoutUrl).toBe("https://checkout.stripe.com/c/cs_test_abc");
  });

  it("cancelUserSubscription volá stripe-cancel-subscription", async () => {
    vi.mocked(invokeAuthedFunction).mockResolvedValueOnce({ success: true });
    await paymentProviderService.cancelUserSubscription();
    expect(invokeAuthedFunction).toHaveBeenCalledWith(
      "stripe-cancel-subscription",
      expect.objectContaining({ body: {} }),
    );
  });

  it("syncUserSubscription volá stripe-sync-subscription", async () => {
    vi.mocked(invokeAuthedFunction).mockResolvedValueOnce({ success: true });
    await paymentProviderService.syncUserSubscription();
    expect(invokeAuthedFunction).toHaveBeenCalledWith(
      "stripe-sync-subscription",
      expect.objectContaining({ body: {} }),
    );
  });

  it("createOrgCheckoutSession volá stripe-create-org-payment", async () => {
    vi.mocked(invokeAuthedFunction).mockResolvedValueOnce({
      success: true,
      paymentUrl: "https://checkout.stripe.com/c/cs_org",
      sessionId: "cs_org",
    });

    const result = await paymentProviderService.createOrgCheckoutSession({
      orgId: "org-123",
      tier: "pro",
      billingPeriod: "monthly",
      seats: 5,
      successUrl: "http://localhost:3000/ok",
      cancelUrl: "http://localhost:3000/cancel",
    });

    expect(invokeAuthedFunction).toHaveBeenCalledWith(
      "stripe-create-org-payment",
      expect.objectContaining({
        body: expect.objectContaining({ orgId: "org-123", seats: 5 }),
      }),
    );
    expect(result.paymentId).toBe("cs_org");
  });

  it("org cancel/sync volá Stripe funkce", async () => {
    vi.mocked(invokeAuthedFunction).mockResolvedValue({ success: true });

    await paymentProviderService.cancelOrgSubscription("org-7");
    await paymentProviderService.syncOrgSubscription("org-7");

    expect(invokeAuthedFunction).toHaveBeenCalledWith(
      "stripe-cancel-org-subscription",
      expect.objectContaining({ body: { orgId: "org-7" } }),
    );
    expect(invokeAuthedFunction).toHaveBeenCalledWith(
      "stripe-sync-org-subscription",
      expect.objectContaining({ body: { orgId: "org-7" } }),
    );
  });
});
