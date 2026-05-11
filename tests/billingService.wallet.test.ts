import { describe, expect, it, vi, beforeEach } from "vitest";
import { billingService } from "../services/billingService";
import { invokeAuthedFunction } from "../services/functionsClient";

vi.mock("../services/functionsClient", () => ({
  invokeAuthedFunction: vi.fn(),
}));

describe("billingService (Stripe + error mapping)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps Stripe config errors to user-friendly checkout message", async () => {
    vi.mocked(invokeAuthedFunction).mockRejectedValueOnce(
      new Error("Missing STRIPE_SECRET_KEY"),
    );

    const result = await billingService.createCheckoutSession({
      tier: "starter",
      successUrl: "http://localhost:3000/app/settings?ok=true",
      cancelUrl: "http://localhost:3000/app/settings?cancel=true",
      billingPeriod: "monthly",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("není správně nakonfigurovaná");
  });

  it("calls stripe-create-payment edge function", async () => {
    vi.mocked(invokeAuthedFunction).mockResolvedValueOnce({
      success: true,
      paymentUrl: "https://checkout.stripe.com/c/cs_test_123",
      sessionId: "cs_test_123",
    });

    const result = await billingService.createCheckoutSession({
      tier: "pro",
      successUrl: "http://localhost:3000/app/settings?ok=true",
      cancelUrl: "http://localhost:3000/app/settings?cancel=true",
      billingPeriod: "yearly",
    });

    expect(invokeAuthedFunction).toHaveBeenCalledWith(
      "stripe-create-payment",
      expect.objectContaining({
        body: expect.objectContaining({
          tier: "pro",
          billingPeriod: "yearly",
        }),
      }),
    );
    expect(result.success).toBe(true);
    expect(result.checkoutUrl).toBe("https://checkout.stripe.com/c/cs_test_123");
    expect(result.paymentId).toBe("cs_test_123");
  });

  it("calls stripe-cancel-subscription edge function", async () => {
    vi.mocked(invokeAuthedFunction).mockResolvedValueOnce({
      success: true,
      message: "Předplatné bude zrušeno na konci aktuálního období.",
    });

    const result = await billingService.cancelRecurrence();

    expect(invokeAuthedFunction).toHaveBeenCalledWith(
      "stripe-cancel-subscription",
      expect.objectContaining({ body: {} }),
    );
    expect(result.success).toBe(true);
  });

  it("calls stripe-sync-subscription edge function", async () => {
    vi.mocked(invokeAuthedFunction).mockResolvedValueOnce({
      success: true,
      message: "Předplatné synchronizováno.",
      subscription: {
        id: "sub_12345",
        tier: "pro",
        status: "active",
        expiresAt: "2026-05-12T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      },
    });

    const result = await billingService.syncSubscription();

    expect(invokeAuthedFunction).toHaveBeenCalledWith(
      "stripe-sync-subscription",
      expect.objectContaining({ body: {} }),
    );
    expect(result.success).toBe(true);
    expect(result.subscription?.tier).toBe("pro");
  });

  it("maps API token errors to user-friendly message", async () => {
    vi.mocked(invokeAuthedFunction).mockRejectedValueOnce(
      new Error("Invalid API key provided"),
    );

    const result = await billingService.createCheckoutSession({
      tier: "starter",
      successUrl: "http://localhost:3000/app/settings?ok=true",
      cancelUrl: "http://localhost:3000/app/settings?cancel=true",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("platební brány");
  });
});
