import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePipelineCommunicationActions } from "../features/projects/model/usePipelineCommunicationActions";
import type { Bid, DemandCategory, ProjectDetails } from "../types";

const createProjectDetails = (
  overrides: Partial<ProjectDetails> = {},
): ProjectDetails =>
  ({
    id: "project-1",
    title: "Projekt A",
    location: "Praha",
    finishDate: "2026-12-31",
    siteManager: "Vedouci",
    categories: [],
    losersEmailTemplateLink: null,
    ...overrides,
  }) as ProjectDetails;

const createCategory = (): DemandCategory =>
  ({
    id: "cat-1",
    title: "Elektro",
    budget: "100 000 Kč",
    status: "open",
    subcontractorCount: 0,
  }) as DemandCategory;

describe("usePipelineCommunicationActions.handleEmailLosers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      writable: true,
      value: { href: "" },
    });
  });

  it("builds mailto with encoded BCC separated by semicolon", async () => {
    const activeCategory = createCategory();
    const bids: Record<string, Bid[]> = {
      [activeCategory.id]: [
        {
          id: "1",
          subcontractorId: "s1",
          companyName: "A",
          contactPerson: "Kontakt A",
          email: "a@x.cz",
          price: "1000",
          status: "offer",
        },
        {
          id: "2",
          subcontractorId: "s2",
          companyName: "B",
          contactPerson: "Kontakt B",
          email: "b@x.cz",
          price: "2000",
          status: "shortlist",
        },
      ],
    };

    const showAlert = vi.fn();
    const actions = usePipelineCommunicationActions({
      activeCategory,
      bids,
      projectDetails: createProjectDetails(),
      updateBidsInternal: vi.fn(),
      setIsExportMenuOpen: vi.fn(),
      showAlert,
      runDocHubFallbackForCategory: vi.fn(),
    });

    await actions.handleEmailLosers();

    expect(window.location.href).toContain("mailto:?bcc=a%40x.cz%3Bb%40x.cz");
    expect(showAlert).not.toHaveBeenCalled();
  });

  it("does not navigate when there are no loser emails", async () => {
    const activeCategory = createCategory();
    const bids: Record<string, Bid[]> = {
      [activeCategory.id]: [
        {
          id: "1",
          subcontractorId: "s1",
          companyName: "A",
          contactPerson: "Kontakt A",
          email: "",
          price: "1000",
          status: "offer",
        },
      ],
    };

    const showAlert = vi.fn();
    const actions = usePipelineCommunicationActions({
      activeCategory,
      bids,
      projectDetails: createProjectDetails(),
      updateBidsInternal: vi.fn(),
      setIsExportMenuOpen: vi.fn(),
      showAlert,
      runDocHubFallbackForCategory: vi.fn(),
    });

    await actions.handleEmailLosers();

    expect(window.location.href).toBe("");
    expect(showAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Žádný z nevybraných účastníků nemá uvedený email.",
      }),
    );
  });
});
