import { describe, expect, it, vi } from "vitest";

const demoDataServiceMock = vi.hoisted(() => ({
  getDemoData: vi.fn(),
  saveDemoData: vi.fn(),
}));

vi.mock("@/services/demoData", () => demoDataServiceMock);

import { projectDemoDataApi } from "@features/projects/api/projectDemoDataApi";

describe("projectDemoDataApi", () => {
  it("deleguje demo data cteni a zapis do legacy service", () => {
    const demoData = { contacts: [], projectDetails: {} };
    demoDataServiceMock.getDemoData.mockReturnValue(demoData);

    expect(projectDemoDataApi.getDemoData()).toBe(demoData);
    projectDemoDataApi.saveDemoData(demoData as any);

    expect(demoDataServiceMock.getDemoData).toHaveBeenCalledOnce();
    expect(demoDataServiceMock.saveDemoData).toHaveBeenCalledWith(demoData);
  });
});
