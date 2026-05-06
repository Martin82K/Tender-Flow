import { beforeEach, describe, expect, it, vi } from "vitest";

const subscriptionFeaturesServiceMock = vi.hoisted(() => ({
  listFeatures: vi.fn(),
  listTierFlags: vi.fn(),
  setTierFlag: vi.fn(),
  createFeature: vi.fn(),
  updateFeature: vi.fn(),
  deleteFeature: vi.fn(),
  checkFeatureAccess: vi.fn(),
  getUserEnabledFeatures: vi.fn(),
  getUserSubscriptionTier: vi.fn(),
}));

vi.mock("@infra/billing/subscriptionFeaturesService", () => ({
  subscriptionFeaturesService: subscriptionFeaturesServiceMock,
}));

vi.mock("@infra/billing/userSubscriptionService", () => ({
  userSubscriptionService: {
    getSubscriptionStatus: vi.fn(),
    formatExpirationDate: vi.fn(),
  },
}));

vi.mock("@/infra/org-billing/orgSubscriptionRpc", () => ({
  orgSubscriptionRpc: {
    getEffectiveUserTier: vi.fn(),
    getEnabledFeaturesV2: vi.fn(),
  },
}));

import {
  createSubscriptionFeature,
  deleteSubscriptionFeature,
  listSubscriptionFeatures,
  listSubscriptionTierFlags,
  setSubscriptionTierFlag,
  updateSubscriptionFeature,
} from "../features/subscription/api";

describe("subscription feature api wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deleguje listování feature definic a tier flagů", async () => {
    const features = [{ key: "module_tasks", name: "Tasks", sortOrder: 1 }];
    const flags = [{ tier: "pro", featureKey: "module_tasks", enabled: true }];
    subscriptionFeaturesServiceMock.listFeatures.mockResolvedValue(features);
    subscriptionFeaturesServiceMock.listTierFlags.mockResolvedValue(flags);

    await expect(listSubscriptionFeatures()).resolves.toBe(features);
    await expect(listSubscriptionTierFlags()).resolves.toBe(flags);
  });

  it("deleguje mutace feature definic a tier flagů", async () => {
    await createSubscriptionFeature({ key: "ai_ocr", name: "OCR" });
    await updateSubscriptionFeature("ai_ocr", { name: "AI OCR" });
    await setSubscriptionTierFlag("admin", "ai_ocr", true);
    await deleteSubscriptionFeature("ai_ocr");

    expect(subscriptionFeaturesServiceMock.createFeature).toHaveBeenCalledWith({
      key: "ai_ocr",
      name: "OCR",
    });
    expect(subscriptionFeaturesServiceMock.updateFeature).toHaveBeenCalledWith("ai_ocr", {
      name: "AI OCR",
    });
    expect(subscriptionFeaturesServiceMock.setTierFlag).toHaveBeenCalledWith("admin", "ai_ocr", true);
    expect(subscriptionFeaturesServiceMock.deleteFeature).toHaveBeenCalledWith("ai_ocr");
  });
});
