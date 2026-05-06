import { beforeEach, describe, expect, it, vi } from "vitest";

const featureUsageServiceMock = vi.hoisted(() => ({
  trackFeatureUsage: vi.fn(),
}));

vi.mock("@/services/featureUsageService", () => ({
  trackFeatureUsage: featureUsageServiceMock.trackFeatureUsage,
}));

import { trackFeatureUsage } from "../features/settings/api";

describe("settings feature usage api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deleguje usage tracking do legacy service", async () => {
    featureUsageServiceMock.trackFeatureUsage.mockResolvedValue(true);

    await expect(trackFeatureUsage("excel_indexer", { rows: 12 })).resolves.toBe(true);

    expect(featureUsageServiceMock.trackFeatureUsage).toHaveBeenCalledWith("excel_indexer", { rows: 12 });
  });
});
