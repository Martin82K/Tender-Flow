import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Project, ProjectDetails } from "@/types";

const mockState: {
  projects: Project[];
  allProjectDetails: Record<string, ProjectDetails>;
  isDataLoading: boolean;
} = {
  projects: [],
  allProjectDetails: {},
  isDataLoading: false,
};

vi.mock("@/hooks/useAppData", () => ({
  useAppData: () => ({ state: mockState, actions: {} }),
}));

vi.mock("@/context/UIContext", () => ({
  useUI: () => ({ showUiModal: vi.fn() }),
}));

import { useCommandCenterSignals } from "@features/dashboard/hooks/useCommandCenterSignals";

const TODAY = new Date();

function isoAtOffset(days: number): string {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function project(id: string, overrides: Partial<Project> = {}): Project {
  return { id, name: `Project ${id}`, location: "", status: "tender", ...overrides };
}

describe("useCommandCenterSignals", () => {
  beforeEach(() => {
    mockState.projects = [];
    mockState.allProjectDetails = {};
    mockState.isDataLoading = false;
  });

  it("returns empty when there is no data", () => {
    const { result } = renderHook(() => useCommandCenterSignals());
    expect(result.current.signals).toEqual([]);
    expect(result.current.counts).toEqual({ critical: 0, warning: 0, info: 0 });
    expect(result.current.timeline).toHaveLength(30);
    expect(result.current.isLoading).toBe(false);
  });

  it("excludes archived projects", () => {
    mockState.projects = [project("p1", { status: "archived" })];
    mockState.allProjectDetails = {
      p1: {
        title: "",
        location: "",
        finishDate: "",
        siteManager: "",
        categories: [
          {
            id: "c1",
            title: "X",
            budget: "",
            sodBudget: 0,
            planBudget: 0,
            status: "open",
            subcontractorCount: 0,
            description: "",
            deadline: isoAtOffset(1),
          },
        ],
      },
    };
    const { result } = renderHook(() => useCommandCenterSignals());
    expect(result.current.signals).toHaveLength(0);
  });

  it("sorts signals by severity then by daysUntilDue", () => {
    mockState.projects = [project("p1"), project("p2")];
    mockState.allProjectDetails = {
      p1: {
        title: "",
        location: "",
        finishDate: "",
        siteManager: "",
        categories: [
          {
            id: "c-warn",
            title: "Kat warn",
            budget: "",
            sodBudget: 0,
            planBudget: 0,
            status: "open",
            subcontractorCount: 0,
            description: "",
            deadline: isoAtOffset(5),
          },
          {
            id: "c-crit-soon",
            title: "Kat crit 1",
            budget: "",
            sodBudget: 0,
            planBudget: 0,
            status: "open",
            subcontractorCount: 0,
            description: "",
            deadline: isoAtOffset(1),
          },
        ],
      },
      p2: {
        title: "",
        location: "",
        finishDate: "",
        siteManager: "",
        categories: [
          {
            id: "c-crit-now",
            title: "Kat crit 0",
            budget: "",
            sodBudget: 0,
            planBudget: 0,
            status: "open",
            subcontractorCount: 0,
            description: "",
            deadline: isoAtOffset(0),
          },
        ],
      },
    };

    const { result } = renderHook(() => useCommandCenterSignals());
    const kinds = result.current.signals.map((s) => `${s.severity}:${s.daysUntilDue}`);
    expect(kinds[0]).toBe("critical:0");
    expect(kinds[1]).toBe("critical:1");
    expect(kinds[2]).toBe("warning:5");
    expect(result.current.counts.critical).toBe(2);
    expect(result.current.counts.warning).toBe(1);
  });

  it("reports isLoading from useAppData state", () => {
    mockState.isDataLoading = true;
    const { result } = renderHook(() => useCommandCenterSignals());
    expect(result.current.isLoading).toBe(true);
  });
});
