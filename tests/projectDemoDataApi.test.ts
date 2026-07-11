import { describe, expect, it, vi } from "vitest";

const demoDataServiceMock = vi.hoisted(() => ({
  DEMO_PROJECT: {
    id: "demo-fallback",
    name: "Demo fallback",
    location: "",
    status: "realization",
    isDemo: true,
  },
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

  it("vrací uložené projekty nebo stabilní fallback pro query hook", () => {
    const projects = [{ id: "demo-1" }];
    demoDataServiceMock.getDemoData.mockReturnValueOnce({ projects });
    demoDataServiceMock.getDemoData.mockReturnValueOnce({ projects: [] });

    expect(projectDemoDataApi.getProjects()).toBe(projects);
    expect(projectDemoDataApi.getProjects()).toEqual([
      demoDataServiceMock.DEMO_PROJECT,
    ]);
  });
});
