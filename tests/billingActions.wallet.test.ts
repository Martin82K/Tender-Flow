import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCheckoutSession,
  createSubscriptionFromPaymentMethod,
} from "../features/subscription/api/billingActions";

const { billingServiceMock } = vi.hoisted(() => ({
  billingServiceMock: {
    createCheckoutSession: vi.fn(),
    createBillingPortalSession: vi.fn(),
    syncSubscription: vi.fn(),
    createSetupIntent: vi.fn(),
    createSubscriptionFromPaymentMethod: vi.fn(),
    isBillingConfigured: vi.fn(),
    formatPrice: vi.fn(),
  },
}));

vi.mock("@/services/billingService", () => ({
  billingService: billingServiceMock,
  PRICING_CONFIG: {
    starter: { monthlyPrice: 39900, yearlyPrice: 383040 },
    pro: { monthlyPrice: 49900, yearlyPrice: 479000 },
    enterprise: { monthlyPrice: null, yearlyPrice: null },
  },
}));

vi.mock("@/services/userSubscriptionService", () => ({
  userSubscriptionService: {
    requestTierUpgrade: vi.fn(),
    cancelSubscription: vi.fn(),
    reactivateSubscription: vi.fn(),
  },
}));

describe("billingActions (wallet wrappers)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes paymentMethodPreference for checkout requests", async () => {
    billingServiceMock.createCheckoutSession.mockResolvedValueOnce({ success: true });

    await createCheckoutSession({
      tier: "starter",
      billingPeriod: "monthly",
      successPath: "http://localhost:3000/success",
      cancelPath: "http://localhost:3000/cancel",
      paymentMethodPreference: "wallet_first",
    });

    expect(billingServiceMock.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        tier: "starter",
        paymentMethodPreference: "wallet_first",
      }),
    );
  });

  it("generates fallback idempotency key when none is provided", async () => {
    billingServiceMock.createSubscriptionFromPaymentMethod.mockResolvedValueOnce({
      success: true,
    });

    await createSubscriptionFromPaymentMethod({
      tier: "pro",
      billingPeriod: "monthly",
      paymentMethodId: "pm_test_1",
    });

    expect(billingServiceMock.createSubscriptionFromPaymentMethod).toHaveBeenCalledWith(
      expect.objectContaining({
        tier: "pro",
        paymentMethodId: "pm_test_1",
        idempotencyKey: expect.any(String),
      }),
    );
  });
});
