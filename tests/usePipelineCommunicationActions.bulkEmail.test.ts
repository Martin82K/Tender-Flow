import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePipelineCommunicationActions } from "../features/projects/model/usePipelineCommunicationActions";
import type { Bid, DemandCategory, ProjectDetails, User } from "../types";
import { expectConsoleError } from "./utils/consoleGuard";

const mocks = vi.hoisted(() => ({
  openTempFile: vi.fn(),
  generateEmlContent: vi.fn(),
  persistBidStatusChange: vi.fn(),
  updateBidStatusInMemory: vi.fn(),
  getDefaultTemplate: vi.fn(),
  getTemplateById: vi.fn(),
  getProfile: vi.fn(),
  getOrganizationEmailBranding: vi.fn(),
  loadBudgetAttachmentForEmail: vi.fn(),
}));

vi.mock("@infra/platform/platformAdapter", () => ({
  default: {
    isDesktop: false,
    shell: {
      openExternal: vi.fn(),
      openTempFile: mocks.openTempFile,
    },
  },
}));

vi.mock("../features/projects/model/pipelineBidStatusModel", () => ({
  persistBidStatusChange: mocks.persistBidStatusChange,
  updateBidStatusInMemory: mocks.updateBidStatusInMemory,
}));

vi.mock("../services/inquiryService", () => ({
  createMailtoLink: vi.fn(),
  downloadEmlFile: vi.fn(),
  generateEmlContent: mocks.generateEmlContent,
}));

vi.mock("../services/templateService", () => ({
  getDefaultTemplate: mocks.getDefaultTemplate,
  getTemplateById: mocks.getTemplateById,
}));

vi.mock("@/services/budgetAttachmentService", () => ({
  loadBudgetAttachmentForEmail: mocks.loadBudgetAttachmentForEmail,
}));

vi.mock("../services/userProfileService", () => ({
  userProfileService: {
    getProfile: mocks.getProfile,
  },
}));

vi.mock("@features/organization/api", () => ({
  organizationService: {
    getOrganizationEmailBranding: mocks.getOrganizationEmailBranding,
    getOrganizationLogoUrl: vi.fn(),
  },
}));

const category: DemandCategory = {
  id: "cat-1",
  title: "Elektro",
  budget: "100 000 Kč",
  sodBudget: 100_000,
  planBudget: 80_000,
  status: "open",
  subcontractorCount: 0,
  description: "",
};

const projectDetails = {
  id: "project-1",
  title: "Projekt A",
  categories: [category],
  inquiryLetterLink: null,
  materialInquiryTemplateLink: null,
} as ProjectDetails;

const currentUser: User = {
  id: "user-1",
  name: "Martin Kalkuš",
  email: "sender@example.com",
  role: "user",
  organizationId: "org-1",
};

const createBid = (overrides: Partial<Bid>): Bid =>
  ({
    id: overrides.id || "bid-1",
    subcontractorId: overrides.subcontractorId || "supplier-1",
    companyName: overrides.companyName || "Dodavatel",
    contactPerson: "Kontakt",
    email: "supplier@example.com",
    status: "contacted",
    ...overrides,
  }) as Bid;

const createActions = (
  bids: Record<string, Bid[]>,
  overrides: { currentUser?: User; showAlert?: ReturnType<typeof vi.fn> } = {},
) => {
  const showAlert = overrides.showAlert || vi.fn();
  const updateBidsInternal = vi.fn(
    (updater: (value: Record<string, Bid[]>) => Record<string, Bid[]>) =>
      updater(bids),
  );
  const actions = usePipelineCommunicationActions({
    activeCategory: category,
    bids,
    projectId: "project-1",
    projectDetails,
    currentUser: overrides.currentUser || currentUser,
    userRole: "user",
    updateBidsInternal,
    setIsExportMenuOpen: vi.fn(),
    showAlert,
    runDocHubFallbackForCategory: vi.fn(),
  });

  return { actions, showAlert, updateBidsInternal };
};

describe("usePipelineCommunicationActions hromadné emaily", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateEmlContent.mockReturnValue("EML");
    mocks.openTempFile.mockResolvedValue(undefined);
    mocks.persistBidStatusChange.mockResolvedValue({ error: null });
    mocks.updateBidStatusInMemory.mockImplementation((value) => value);
    mocks.getTemplateById.mockResolvedValue(undefined);
    mocks.getDefaultTemplate.mockResolvedValue({
      id: "template-1",
      name: "Poptávka",
      subject: "Poptávka {KATEGORIE_NAZEV}",
      content: "<p>Dobrý den</p>",
      isDefault: true,
      lastModified: "2026-07-13",
    });
    mocks.getProfile.mockResolvedValue({
      displayName: "Martin Kalkuš",
      signatureEmail: "sender@example.com",
    });
    mocks.getOrganizationEmailBranding.mockResolvedValue(null);
    mocks.loadBudgetAttachmentForEmail.mockResolvedValue(null);
  });

  it("vytvoří jeden koncept s uživatelem v To a dodavateli v BCC", async () => {
    const bids = {
      [category.id]: [
        createBid({ id: "a", email: "supplier@example.com" }),
        createBid({ id: "b", email: "SUPPLIER@example.com" }),
        createBid({ id: "c", email: "second@example.com" }),
        createBid({ id: "sent", email: "sent@example.com", status: "sent" }),
      ],
    };
    const { actions, updateBidsInternal, showAlert } = createActions(bids);

    const result = await actions.handleGenerateBulkInquiry("inquiry");

    expect(result).toBe(true);
    expect(mocks.generateEmlContent).toHaveBeenCalledWith(
      "sender@example.com",
      "Poptávka Elektro",
      expect.stringContaining("Dobrý den"),
      expect.objectContaining({
        bcc: "supplier@example.com;second@example.com",
        attachments: [],
      }),
    );
    expect(mocks.openTempFile).toHaveBeenCalledWith(
      "EML",
      expect.stringMatching(/^Poptavka_hromadne_\d+\.eml$/),
    );
    expect(mocks.persistBidStatusChange).toHaveBeenCalledTimes(3);
    expect(mocks.persistBidStatusChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ bidId: "sent" }),
    );
    expect(updateBidsInternal).toHaveBeenCalledTimes(1);
    expect(showAlert).not.toHaveBeenCalled();
  });

  it("pro materiálovou variantu použije odpovídající šablonu a název", async () => {
    mocks.getTemplateById.mockResolvedValue({
      id: "material-template",
      name: "Materiál",
      subject: "Materiál {KATEGORIE_NAZEV}",
      content: "<p>Materiálová poptávka</p>",
      isDefault: false,
      lastModified: "2026-07-13",
    });
    const details = {
      ...projectDetails,
      materialInquiryTemplateLink: "template:material-template",
    } as ProjectDetails;
    const bids = { [category.id]: [createBid({ id: "a" })] };
    const actions = usePipelineCommunicationActions({
      activeCategory: category,
      bids,
      projectId: "project-1",
      projectDetails: details,
      currentUser,
      userRole: "user",
      updateBidsInternal: vi.fn(),
      setIsExportMenuOpen: vi.fn(),
      showAlert: vi.fn(),
      runDocHubFallbackForCategory: vi.fn(),
    });

    await actions.handleGenerateBulkInquiry("materialInquiry");

    expect(mocks.getTemplateById).toHaveBeenCalledWith("material-template", {
      projectId: "project-1",
    });
    expect(mocks.openTempFile).toHaveBeenCalledWith(
      "EML",
      expect.stringMatching(/^Materialova_poptavka_hromadne_\d+\.eml$/),
    );
  });

  it("zablokuje hromadný koncept bez platného emailu uživatele", async () => {
    const invalidUser = { ...currentUser, email: "invalid" };
    const bids = { [category.id]: [createBid({ id: "a" })] };
    const { actions, showAlert } = createActions(bids, {
      currentUser: invalidUser,
    });

    const result = await actions.handleGenerateBulkInquiry("inquiry");

    expect(result).toBe(false);
    expect(mocks.generateEmlContent).not.toHaveBeenCalled();
    expect(mocks.openTempFile).not.toHaveBeenCalled();
    expect(showAlert).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Chybí email odesílatele" }),
    );
  });

  it("při chybě otevření konceptu nezmění stav žádné karty", async () => {
    expectConsoleError("Failed to open bulk inquiry draft:");
    mocks.openTempFile.mockRejectedValue(new Error("Outlook unavailable"));
    const bids = { [category.id]: [createBid({ id: "a" })] };
    const { actions, showAlert, updateBidsInternal } = createActions(bids);

    const result = await actions.handleGenerateBulkInquiry("inquiry");

    expect(result).toBe(false);
    expect(mocks.persistBidStatusChange).not.toHaveBeenCalled();
    expect(updateBidsInternal).not.toHaveBeenCalled();
    expect(showAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Koncept se nepodařilo vytvořit",
      }),
    );
  });
});
