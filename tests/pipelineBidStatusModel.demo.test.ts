import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDemoData: vi.fn(),
  saveDemoData: vi.fn(),
  updateBidStatus: vi.fn(),
}));

vi.mock("@features/projects/api/projectDemoDataApi", () => ({
  projectDemoDataApi: {
    getDemoData: mocks.getDemoData,
    saveDemoData: mocks.saveDemoData,
  },
}));

vi.mock("@/features/projects/api", () => ({
  updateBidStatus: mocks.updateBidStatus,
}));

import { persistBidStatusChange } from "../features/projects/model/pipelineBidStatusModel";

describe("pipelineBidStatusModel demo persistence", () => {
  it("persistuje status nabidky pres project demo data api", async () => {
    const demoData = {
      projectDetails: {
        "project-1": {
          bids: {
            "cat-1": [
              {
                id: "bid-1",
                status: "contacted",
              },
            ],
          },
        },
      },
    };
    mocks.getDemoData.mockReturnValue(demoData);

    await expect(
      persistBidStatusChange({
        bidId: "bid-1",
        targetStatus: "sent",
        userRole: "demo",
        projectDataId: "project-1",
        activeCategoryId: "cat-1",
      }),
    ).resolves.toEqual({ error: null });

    expect(mocks.updateBidStatus).not.toHaveBeenCalled();
    expect(mocks.saveDemoData).toHaveBeenCalledWith({
      projectDetails: {
        "project-1": {
          bids: {
            "cat-1": [
              {
                id: "bid-1",
                status: "sent",
              },
            ],
          },
        },
      },
    });
  });
});
