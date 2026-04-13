import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCheckoutSession,
  cancelRecurrence,
} from "../features/subscription/api/billingActions";

const { billingServiceMock } = vi.hoisted(() => ({
  billingServiceMock: {
    createCheckoutSession: vi.fn(),
    cancelRecurrence: vi.fn(),
    syncSubscription: vi.fn(),
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

describe("billingActions (GoPay wrappers)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes billingPeriod for checkout requests", async () => {
    billingServiceMock.createCheckoutSession.mockResolvedValueOnce({ success: true });

    await createCheckoutSession({
      tier: "starter",
      billingPeriod: "monthly",
      successPath: "http://localhost:3000/success",
      cancelPath: "http://localhost:3000/cancel",
    });

    expect(billingServiceMock.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        tier: "starter",
        billingPeriod: "monthly",
      }),
    );
  });

  it("calls cancelRecurrence on billingService", async () => {
    billingServiceMock.cancelRecurrence.mockResolvedValueOnce({
      success: true,
      message: "Cancelled",
    });

    const result = await cancelRecurrence();

    expect(billingServiceMock.cancelRecurrence).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});
