import { describe, expect, it, vi } from "vitest";

const demoDataServiceMock = vi.hoisted(() => ({
  DEMO_PROJECT: {
    id: "demo-fallback",
    name: "Demo fallback",
    location: "",
    status: "realization",
    isDemo: true,
  },
  DEMO_PROJECT_DETAILS: {
    id: "demo-fallback",
    title: "Demo fallback",
    categories: [],
    bids: {},
  },
  getDemoData: vi.fn(),
  isDemoSession: vi.fn(),
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

  it("vrací uložený detail projektu nebo stabilní fallback", () => {
    const storedDetails = { id: "project-1", title: "Uložený detail" };
    demoDataServiceMock.getDemoData.mockReturnValueOnce({
      projectDetails: { "project-1": storedDetails },
    });
    demoDataServiceMock.getDemoData.mockReturnValueOnce({ projectDetails: {} });

    expect(projectDemoDataApi.getProjectDetails("project-1")).toBe(storedDetails);
    expect(projectDemoDataApi.getProjectDetails("missing")).toBe(
      demoDataServiceMock.DEMO_PROJECT_DETAILS,
    );
  });

  it("deleguje demo session a rozpozná kanonické demo ID", () => {
    demoDataServiceMock.isDemoSession.mockReturnValue(true);

    expect(projectDemoDataApi.isDemoSession()).toBe(true);
    expect(projectDemoDataApi.isDemoProjectId("demo-fallback")).toBe(true);
    expect(projectDemoDataApi.isDemoProjectId("project-1")).toBe(false);
  });
});
