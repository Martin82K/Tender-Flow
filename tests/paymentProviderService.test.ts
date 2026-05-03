import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { invokeAuthedFunction } from "../services/functionsClient";
import {
  paymentProviderService,
  getActiveBillingProvider,
} from "../services/paymentProviderService";

vi.mock("../services/functionsClient", () => ({
  invokeAuthedFunction: vi.fn(),
}));

describe("paymentProviderService — provider routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("getActiveBillingProvider()", () => {
    it("vrací 'gopay' jako default, když env var není nastavený", () => {
      vi.stubEnv("VITE_BILLING_PROVIDER", "");
      expect(getActiveBillingProvider()).toBe("gopay");
    });

    it("respektuje 'stripe' override", () => {
      vi.stubEnv("VITE_BILLING_PROVIDER", "stripe");
      expect(getActiveBillingProvider()).toBe("stripe");
    });

    it("normalizuje case (STRIPE → stripe)", () => {
      vi.stubEnv("VITE_BILLING_PROVIDER", "STRIPE");
      expect(getActiveBillingProvider()).toBe("stripe");
    });

    it("padá na default při neznámém providerovi", () => {
      vi.stubEnv("VITE_BILLING_PROVIDER", "paddle");
      expect(getActiveBillingProvider()).toBe("gopay");
    });
  });

  describe("user-level checkout (default = gopay)", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_BILLING_PROVIDER", "gopay");
    });

    it("createUserCheckoutSession volá gopay-create-payment a vrací paymentId", async () => {
      vi.mocked(invokeAuthedFunction).mockResolvedValueOnce({
        success: true,
        paymentUrl: "https://gw.gopay.com/pay?id=42",
        paymentId: "42",
      });

      const result = await paymentProviderService.createUserCheckoutSession({
        tier: "pro",
        billingPeriod: "monthly",
        successUrl: "http://localhost:3000/ok",
        cancelUrl: "http://localhost:3000/cancel",
      });

      expect(invokeAuthedFunction).toHaveBeenCalledWith(
        "gopay-create-payment",
        expect.objectContaining({
          body: expect.objectContaining({ tier: "pro", billingPeriod: "monthly" }),
        }),
      );
      expect(result.success).toBe(true);
      expect(result.paymentId).toBe("42");
      expect(result.checkoutUrl).toBe("https://gw.gopay.com/pay?id=42");
    });

    it("cancelUserSubscription volá gopay-cancel-subscription", async () => {
      vi.mocked(invokeAuthedFunction).mockResolvedValueOnce({ success: true });
      await paymentProviderService.cancelUserSubscription();
      expect(invokeAuthedFunction).toHaveBeenCalledWith(
        "gopay-cancel-subscription",
        expect.objectContaining({ body: {} }),
      );
    });

    it("syncUserSubscription volá gopay-sync-subscription", async () => {
      vi.mocked(invokeAuthedFunction).mockResolvedValueOnce({ success: true });
      await paymentProviderService.syncUserSubscription();
      expect(invokeAuthedFunction).toHaveBeenCalledWith(
        "gopay-sync-subscription",
        expect.objectContaining({ body: {} }),
      );
    });
  });

  describe("user-level checkout (provider = stripe)", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_BILLING_PROVIDER", "stripe");
    });

    it("createUserCheckoutSession volá stripe-create-payment a normalizuje sessionId → paymentId", async () => {
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
  });

  describe("org-level checkout", () => {
    it("default provider routuje na gopay-create-org-payment", async () => {
      vi.stubEnv("VITE_BILLING_PROVIDER", "gopay");
      vi.mocked(invokeAuthedFunction).mockResolvedValueOnce({
        success: true,
        paymentUrl: "https://gw.gopay.com/pay?id=99",
        paymentId: "99",
      });

      await paymentProviderService.createOrgCheckoutSession({
        orgId: "org-123",
        tier: "pro",
        billingPeriod: "monthly",
        seats: 5,
        successUrl: "http://localhost:3000/ok",
        cancelUrl: "http://localhost:3000/cancel",
      });

      expect(invokeAuthedFunction).toHaveBeenCalledWith(
        "gopay-create-org-payment",
        expect.objectContaining({
          body: expect.objectContaining({
            orgId: "org-123",
            tier: "pro",
            seats: 5,
          }),
        }),
      );
    });

    it("stripe provider routuje na stripe-create-org-payment a normalizuje response", async () => {
      vi.stubEnv("VITE_BILLING_PROVIDER", "stripe");
      vi.mocked(invokeAuthedFunction).mockResolvedValueOnce({
        success: true,
        paymentUrl: "https://checkout.stripe.com/c/cs_org",
        sessionId: "cs_org",
      });

      const result = await paymentProviderService.createOrgCheckoutSession({
        orgId: "org-123",
        tier: "starter",
        billingPeriod: "yearly",
        seats: 3,
        successUrl: "http://localhost:3000/ok",
        cancelUrl: "http://localhost:3000/cancel",
      });

      expect(invokeAuthedFunction).toHaveBeenCalledWith(
        "stripe-create-org-payment",
        expect.objectContaining({
          body: expect.objectContaining({ orgId: "org-123", seats: 3 }),
        }),
      );
      expect(result.paymentId).toBe("cs_org");
    });

    it("cancelOrgSubscription routuje na správný provider", async () => {
      vi.stubEnv("VITE_BILLING_PROVIDER", "stripe");
      vi.mocked(invokeAuthedFunction).mockResolvedValueOnce({ success: true });
      await paymentProviderService.cancelOrgSubscription("org-7");
      expect(invokeAuthedFunction).toHaveBeenCalledWith(
        "stripe-cancel-org-subscription",
        expect.objectContaining({ body: { orgId: "org-7" } }),
      );
    });

    it("syncOrgSubscription routuje na správný provider", async () => {
      vi.stubEnv("VITE_BILLING_PROVIDER", "gopay");
      vi.mocked(invokeAuthedFunction).mockResolvedValueOnce({ success: true });
      await paymentProviderService.syncOrgSubscription("org-7");
      expect(invokeAuthedFunction).toHaveBeenCalledWith(
        "gopay-sync-org-subscription",
        expect.objectContaining({ body: { orgId: "org-7" } }),
      );
    });
  });
});
