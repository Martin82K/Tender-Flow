import { describe, expect, it, vi, beforeEach } from "vitest";
import { billingService } from "../services/billingService";
import { invokeAuthedFunction } from "../services/functionsClient";

vi.mock("../services/functionsClient", () => ({
  invokeAuthedFunction: vi.fn(),
}));

describe("billingService (wallet + error mapping)", () => {
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

  it("forwards idempotency key when creating subscription from payment method", async () => {
    vi.mocked(invokeAuthedFunction).mockResolvedValueOnce({
      success: true,
      subscriptionId: "sub_123",
    });

    await billingService.createSubscriptionFromPaymentMethod({
      tier: "pro",
      billingPeriod: "yearly",
      paymentMethodId: "pm_123",
      idempotencyKey: "idem-key-123456",
    });

    expect(invokeAuthedFunction).toHaveBeenCalledWith(
      "stripe-create-subscription-from-payment-method",
      expect.objectContaining({
        idempotencyKey: "idem-key-123456",
        body: expect.objectContaining({
          idempotencyKey: "idem-key-123456",
          paymentMethodId: "pm_123",
          tier: "pro",
        }),
      }),
    );
  });
});
