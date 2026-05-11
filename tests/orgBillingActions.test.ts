import { describe, expect, it, vi } from "vitest";

const paymentProviderServiceMock = vi.hoisted(() => ({
  createOrgCheckoutSession: vi.fn(),
}));

vi.mock("@infra/billing/paymentProviderService", () => ({
  paymentProviderService: paymentProviderServiceMock,
}));

vi.mock("@infra/billing/billingService", () => ({
  PRICING_CONFIG: {
    starter: { monthlyPrice: 39900, yearlyPrice: 383040 },
    pro: { monthlyPrice: 49900, yearlyPrice: 479000 },
  },
}));

import {
  calculateOrgPrice,
  createOrgCheckout,
} from "../features/organization/api/orgBillingActions";

describe("orgBillingActions", () => {
  it("deleguje org checkout do payment provideru a mapuje cenu", async () => {
    paymentProviderServiceMock.createOrgCheckoutSession.mockResolvedValue({
      success: true,
      paymentUrl: "https://checkout.example",
      paymentId: "pay-1",
    });

    await expect(
      createOrgCheckout({
        orgId: "org-1",
        tier: "starter",
        billingPeriod: "monthly",
        seats: 2,
        successPath: "/success",
        cancelPath: "/cancel",
      }),
    ).resolves.toMatchObject({
      success: true,
      checkoutUrl: "https://checkout.example",
      paymentId: "pay-1",
    });

    expect(paymentProviderServiceMock.createOrgCheckoutSession).toHaveBeenCalledWith({
      orgId: "org-1",
      tier: "starter",
      billingPeriod: "monthly",
      seats: 2,
      successUrl: "/success",
      cancelUrl: "/cancel",
    });
    expect(calculateOrgPrice("starter", "monthly", 2)).toBe(79800);
  });
});
