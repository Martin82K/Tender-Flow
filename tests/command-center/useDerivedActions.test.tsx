import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DemandCategory, Project, ProjectDetails, Bid } from "@/types";
import type { CommandCenterFilterState } from "@features/command-center/types";

const uiMock = {
  showUiModal: vi.fn(),
};

const state = {
  projects: [] as Project[],
  allProjectDetails: {} as Record<string, ProjectDetails>,
  contacts: [],
  contactStatuses: [],
  isDataLoading: false,
  loadingError: null,
  appLoadProgress: null,
  isBackgroundLoading: false,
  backgroundWarning: null,
  selectedProjectId: null,
  isAdmin: false,
};

vi.mock("@/context/UIContext", () => ({
  useUI: () => uiMock,
}));

vi.mock("@/hooks/useAppData", () => ({
  useAppData: () => ({ state, actions: {} }),
}));

vi.mock("@features/projects/contracts/hooks/useAllContractsQuery", () => ({
  useAllContractsQuery: () => ({ data: [] }),
  ALL_CONTRACTS_QUERY_KEY: ["contracts", "all"],
}));

import { useDerivedActions } from "@features/command-center/hooks/useDerivedActions";

const daysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
};

const makeProject = (id: string, overrides: Partial<Project> = {}): Project => ({
  id,
  name: `Projekt ${id}`,
  location: "Praha",
  status: "tender",
  ...overrides,
});

const makeCategory = (id: string, overrides: Partial<DemandCategory> = {}): DemandCategory => ({
  id,
  title: `Kategorie ${id}`,
  budget: "1000000",
  sodBudget: 1_000_000,
  planBudget: 900_000,
  status: "open",
  subcontractorCount: 0,
  description: "",
  documents: [
    { id: "d1", name: "PD.pdf", url: "", size: 1000, uploadedAt: new Date().toISOString() },
  ],
  createdAt: daysAgo(5),
  ...overrides,
});

const makeBid = (id: string, overrides: Partial<Bid> = {}): Bid => ({
  id,
  subcontractorId: `sub-${id}`,
  companyName: `Firma ${id}`,
  contactPerson: "Jan Novák",
  status: "contacted",
  ...overrides,
});

const setState = (projects: Project[], details: Record<string, ProjectDetails>) => {
  state.projects = projects;
  state.allProjectDetails = details;
};

const DEFAULT_FILTER: CommandCenterFilterState = {
  projectIds: [],
  healthLevels: [],
  statuses: ["tender", "realization"],
  rangeDays: 14,
};

describe("useDerivedActions", () => {
  it("returns empty array when no projects", () => {
    setState([], {});
    const { result } = renderHook(() => useDerivedActions(DEFAULT_FILTER));
    expect(result.current).toEqual([]);
  });

  it("flags 14denní limit jako critical když DDL je za <=2 dny", () => {
    const project = makeProject("p1");
    const category = makeCategory("c1", { createdAt: daysAgo(13) });
    const details: ProjectDetails = {
      title: project.name,
      location: "Praha",
      finishDate: "",
      siteManager: "",
      categories: [category],
      bids: { [category.id]: [makeBid("b1"), makeBid("b2"), makeBid("b3")] },
    };
    setState([project], { [project.id]: details });
    const { result } = renderHook(() => useDerivedActions(DEFAULT_FILTER));
    const limit = result.current.find((a) => a.id === `demand-14d-${category.id}`);
    expect(limit).toBeDefined();
    expect(limit?.severity).toBe("critical");
  });

  it("varuje u kategorie s méně než 3 dodavateli", () => {
    const project = makeProject("p2");
    const category = makeCategory("c2", { createdAt: daysAgo(1) });
    const details: ProjectDetails = {
      title: project.name,
      location: "Brno",
      finishDate: "",
      siteManager: "",
      categories: [category],
      bids: { [category.id]: [makeBid("b1")] },
    };
    setState([project], { [project.id]: details });
    const { result } = renderHook(() => useDerivedActions(DEFAULT_FILTER));
    const low = result.current.find((a) => a.id === `low-suppliers-${category.id}`);
    expect(low).toBeDefined();
    expect(low?.severity).toBe("warning");
  });

  it("označí poptávku za blokovanou, pokud chybí PD a je starší 2 dnů", () => {
    const project = makeProject("p3");
    const category = makeCategory("c3", {
      createdAt: daysAgo(5),
      documents: [],
    });
    const details: ProjectDetails = {
      title: project.name,
      location: "Ostrava",
      finishDate: "",
      siteManager: "",
      categories: [category],
      bids: { [category.id]: [makeBid("b1"), makeBid("b2"), makeBid("b3")] },
    };
    setState([project], { [project.id]: details });
    const { result } = renderHook(() => useDerivedActions(DEFAULT_FILTER));
    const blocked = result.current.find((a) => a.id === `blocked-${category.id}`);
    expect(blocked).toBeDefined();
    expect(blocked?.severity).toBe("critical");
  });

  it("respektuje filter projectIds", () => {
    const p1 = makeProject("p4");
    const p2 = makeProject("p5");
    const cat1 = makeCategory("cat1", { createdAt: daysAgo(13) });
    const cat2 = makeCategory("cat2", { createdAt: daysAgo(13) });
    const d1: ProjectDetails = {
      title: p1.name,
      location: "",
      finishDate: "",
      siteManager: "",
      categories: [cat1],
      bids: { [cat1.id]: [makeBid("b1"), makeBid("b2"), makeBid("b3")] },
    };
    const d2: ProjectDetails = {
      title: p2.name,
      location: "",
      finishDate: "",
      siteManager: "",
      categories: [cat2],
      bids: { [cat2.id]: [makeBid("b1"), makeBid("b2"), makeBid("b3")] },
    };
    setState([p1, p2], { [p1.id]: d1, [p2.id]: d2 });
    const { result } = renderHook(() =>
      useDerivedActions({ ...DEFAULT_FILTER, projectIds: [p1.id] })
    );
    const mentionsP1 = result.current.some((a) => a.projectId === p1.id);
    const mentionsP2 = result.current.some((a) => a.projectId === p2.id);
    expect(mentionsP1).toBe(true);
    expect(mentionsP2).toBe(false);
  });

  it("řadí akce podle severity (critical nejdřív)", () => {
    const project = makeProject("p6");
    const critCat = makeCategory("crit-cat", { createdAt: daysAgo(13) });
    const warnCat = makeCategory("warn-cat", { createdAt: daysAgo(1) });
    const details: ProjectDetails = {
      title: project.name,
      location: "",
      finishDate: "",
      siteManager: "",
      categories: [warnCat, critCat],
      bids: {
        [critCat.id]: [makeBid("b1"), makeBid("b2"), makeBid("b3")],
        [warnCat.id]: [makeBid("b1")],
      },
    };
    setState([project], { [project.id]: details });
    const { result } = renderHook(() => useDerivedActions(DEFAULT_FILTER));
    const firstSeverity = result.current[0]?.severity;
    expect(firstSeverity).toBe("critical");
  });
});
