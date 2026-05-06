import { describe, expect, it, vi } from "vitest";

const billingServiceMock = vi.hoisted(() => ({ createCheckoutSession: vi.fn() }));
const paymentProviderServiceMock = vi.hoisted(() => ({ createOrgCheckoutSession: vi.fn() }));
const subscriptionFeaturesServiceMock = vi.hoisted(() => ({ listFeatures: vi.fn() }));
const userSubscriptionServiceMock = vi.hoisted(() => ({ getSubscriptionStatus: vi.fn() }));

vi.mock("@/services/billingService", () => ({
  billingService: billingServiceMock,
  PRICING_CONFIG: { starter: { monthlyPrice: 39900 } },
}));
vi.mock("@/services/paymentProviderService", () => ({
  paymentProviderService: paymentProviderServiceMock,
}));
vi.mock("@/services/subscriptionFeaturesService", () => ({
  subscriptionFeaturesService: subscriptionFeaturesServiceMock,
}));
vi.mock("@/services/userSubscriptionService", () => ({
  userSubscriptionService: userSubscriptionServiceMock,
}));

import {
  billingService,
  PRICING_CONFIG,
} from "@infra/billing/billingService";
import { paymentProviderService } from "@infra/billing/paymentProviderService";
import { subscriptionFeaturesService } from "@infra/billing/subscriptionFeaturesService";
import { userSubscriptionService } from "@infra/billing/userSubscriptionService";

describe("infra billing services", () => {
  it("deleguje billing a subscription services do legacy modulu", () => {
    expect(billingService).toBe(billingServiceMock);
    expect(PRICING_CONFIG.starter.monthlyPrice).toBe(39900);
    expect(paymentProviderService).toBe(paymentProviderServiceMock);
    expect(subscriptionFeaturesService).toBe(subscriptionFeaturesServiceMock);
    expect(userSubscriptionService).toBe(userSubscriptionServiceMock);
  });
});
