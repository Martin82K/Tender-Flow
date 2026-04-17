import { describe, it, expect } from "vitest";
import {
  buildSearchIndex,
  searchAll,
  normalize,
  MIN_QUERY_LENGTH,
} from "@/shared/ui/GlobalSearch/searchEngine";
import type { Project, ProjectDetails, Subcontractor } from "@/types";

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: "p1",
  name: "Testovací stavba",
  location: "Praha",
  status: "active" as any,
  ...overrides,
});

const makeContact = (overrides: Partial<Subcontractor> = {}): Subcontractor => ({
  id: "c1",
  company: "AB Metal s.r.o.",
  specialization: ["Zámečnictví"],
  contacts: [],
  ico: "12345678",
  region: "Praha",
  city: "Praha",
  status: "active",
  ...overrides,
});

const makeDetails = (overrides: Partial<ProjectDetails> = {}): ProjectDetails => ({
  title: "Testovací stavba",
  location: "Praha",
  finishDate: "",
  siteManager: "",
  categories: [],
  ...overrides,
});

describe("normalize", () => {
  it("strips diacritics and lowercases", () => {
    expect(normalize("Obkládání Žlutá")).toBe("obkladani zluta");
  });
  it("handles empty strings", () => {
    expect(normalize("")).toBe("");
  });
  it("normalizes Czech characters", () => {
    expect(normalize("Škrdlovice")).toBe("skrdlovice");
    expect(normalize("Ústí nad Labem")).toBe("usti nad labem");
  });
});

describe("buildSearchIndex", () => {
  it("indexes projects, contacts and categories from loaded details", () => {
    const projects = [makeProject({ id: "p1" }), makeProject({ id: "p2", name: "Druhá stavba" })];
    const contacts = [makeContact()];
    const projectDetails = {
      p1: makeDetails({
        categories: [
          {
            id: "cat1",
            title: "Okna a dveře",
            budget: "",
            sodBudget: 0,
            planBudget: 0,
            status: "open",
            subcontractorCount: 0,
            description: "",
          },
        ],
      }),
    };
    const idx = buildSearchIndex({ projects, contacts, projectDetails });
    expect(idx.projects).toHaveLength(2);
    expect(idx.contacts).toHaveLength(1);
    expect(idx.categories).toHaveLength(1);
    expect(idx.totalProjectCount).toBe(2);
    expect(idx.loadedProjectDetailsCount).toBe(1);
  });
});

describe("searchAll", () => {
  const sources = {
    projects: [
      makeProject({ id: "p1", name: "Rekonstrukce školky", location: "Praha" }),
      makeProject({ id: "p2", name: "Nová hala Brno", location: "Brno" }),
    ],
    contacts: [
      makeContact({ id: "c1", company: "AB Metal", specialization: ["Zámečnictví", "Kovovýroba"] }),
      makeContact({ id: "c2", company: "Školka Dodávky s.r.o.", city: "Olomouc" }),
    ],
    projectDetails: {
      p1: makeDetails({
        title: "Rekonstrukce školky",
        categories: [
          {
            id: "cat1",
            title: "Obklady",
            budget: "",
            sodBudget: 0,
            planBudget: 0,
            status: "open",
            subcontractorCount: 0,
            description: "Keramické obklady koupelen",
          },
        ],
      }),
    },
  };
  const index = buildSearchIndex(sources);

  it("returns empty array for queries shorter than MIN_QUERY_LENGTH", () => {
    expect(MIN_QUERY_LENGTH).toBe(2);
    expect(searchAll("a", index)).toEqual([]);
    expect(searchAll("", index)).toEqual([]);
  });

  it("matches project by name", () => {
    const groups = searchAll("školky", index);
    const projects = groups.find((g) => g.category === "projects");
    expect(projects?.items[0]?.title).toBe("Rekonstrukce školky");
  });

  it("matches contact by company name", () => {
    const groups = searchAll("ab metal", index);
    const contacts = groups.find((g) => g.category === "contacts");
    expect(contacts?.items[0]?.title).toBe("AB Metal");
  });

  it("is diacritic-insensitive", () => {
    const groups = searchAll("skolky", index);
    expect(groups.find((g) => g.category === "projects")?.items[0]?.title).toBe(
      "Rekonstrukce školky",
    );
  });

  it("matches category from loaded project details", () => {
    const groups = searchAll("obklady", index);
    const cats = groups.find((g) => g.category === "categories");
    expect(cats?.items[0]?.title).toBe("Obklady");
    expect(cats?.items[0]?.navigateTo).toMatchObject({
      view: "project",
      projectId: "p1",
      tab: "pipeline",
      categoryId: "cat1",
    });
  });

  it("ranks exact match higher than substring", () => {
    const groups = searchAll("metal", index);
    const contacts = groups.find((g) => g.category === "contacts");
    expect(contacts?.items[0]?.title).toBe("AB Metal");
    expect(contacts?.items[0]?.score).toBeGreaterThan(0);
  });

  it("requires all tokens to match (AND semantics)", () => {
    const groups = searchAll("skolka dodavky", index);
    const contacts = groups.find((g) => g.category === "contacts");
    expect(contacts?.items[0]?.title).toBe("Školka Dodávky s.r.o.");
  });

  it("returns no results when no token matches", () => {
    const groups = searchAll("xyznevexistuje", index);
    expect(groups).toEqual([]);
  });

  it("matches contact by specialization (tertiary field)", () => {
    const groups = searchAll("zamecnictvi", index);
    const contacts = groups.find((g) => g.category === "contacts");
    expect(contacts?.items[0]?.title).toBe("AB Metal");
  });

  it("matches project by location (secondary field)", () => {
    const groups = searchAll("brno", index);
    const projects = groups.find((g) => g.category === "projects");
    expect(projects?.items[0]?.title).toBe("Nová hala Brno");
  });
});
