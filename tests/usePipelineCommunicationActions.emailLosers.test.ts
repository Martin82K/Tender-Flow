import { beforeEach, describe, expect, it, vi } from "vitest";

const platformMock = vi.hoisted(() => ({
  openTempFile: vi.fn(),
}));

const profileServiceMock = vi.hoisted(() => ({
  getProfile: vi.fn(),
}));

const organizationServiceMock = vi.hoisted(() => ({
  getOrganizationEmailBranding: vi.fn(),
}));

vi.mock("@/services/platformAdapter", () => ({
  __esModule: true,
  default: {
    isDesktop: false,
    shell: {
      openTempFile: platformMock.openTempFile,
    },
  },
}));

vi.mock("@/services/userProfileService", () => ({
  userProfileService: profileServiceMock,
}));

vi.mock("@/services/organizationService", () => ({
  organizationService: organizationServiceMock,
}));

import { usePipelineCommunicationActions } from "../features/projects/model/usePipelineCommunicationActions";
import type { Bid, DemandCategory, ProjectDetails, User } from "../types";

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

const currentUser: User = {
  id: "user-1",
  name: "Martin Kalkuš",
  email: "kalkus@baustav.cz",
  role: "user",
  organizationId: "org-1",
};

describe("usePipelineCommunicationActions.handleEmailLosers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileServiceMock.getProfile.mockResolvedValue({
      displayName: "Martin Kalkuš",
      signatureName: "Martin Kalkuš",
      signatureRole: "technik přípravy staveb",
      signaturePhone: "+420 353 561 325",
      signaturePhoneSecondary: "+420 777 300 042",
      signatureEmail: "kalkus@baustav.cz",
      signatureGreeting: "S pozdravem",
    });
    organizationServiceMock.getOrganizationEmailBranding.mockResolvedValue({
      emailLogoPath: "organizations/org-1/email-logo.png",
      emailLogoUrl: "https://cdn.example/email-logo.png",
      companyName: "BAU-STAV a.s.",
      companyAddress: "Loketská 344/12",
      companyMeta: "IČ: 147 05 877",
      disclaimerHtml: "<p>Disclaimer</p>",
    });
  });

  it("builds EML draft with encoded BCC list and signature", async () => {
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
      currentUser,
      updateBidsInternal: vi.fn(),
      setIsExportMenuOpen: vi.fn(),
      showAlert,
      runDocHubFallbackForCategory: vi.fn(),
    });

    await actions.handleEmailLosers();

    expect(platformMock.openTempFile).toHaveBeenCalledTimes(1);
    const [content, filename] = platformMock.openTempFile.mock.calls[0];
    const htmlPartBase64 = content.split("\r\n").findLast((line: string) =>
      /^[A-Za-z0-9+/=]+$/.test(line),
    );
    const decodedHtml = htmlPartBase64 ? atob(htmlPartBase64) : "";
    expect(filename).toMatch(/^Nevybrani_/);
    expect(content).toContain("Bcc: a@x.cz;b@x.cz");
    expect(decodedHtml).toContain("kalkus@baustav.cz");
    expect(decodedHtml).toContain("BAU-STAV a.s.");
    expect(showAlert).not.toHaveBeenCalled();
  });

  it("does not generate draft when there are no loser emails", async () => {
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
      currentUser,
      updateBidsInternal: vi.fn(),
      setIsExportMenuOpen: vi.fn(),
      showAlert,
      runDocHubFallbackForCategory: vi.fn(),
    });

    await actions.handleEmailLosers();

    expect(platformMock.openTempFile).not.toHaveBeenCalled();
    expect(showAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Žádný z nevybraných účastníků nemá uvedený email.",
      }),
    );
  });
});
