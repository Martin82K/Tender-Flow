import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePipelineCommunicationActions } from "../features/projects/model/usePipelineCommunicationActions";
import type { Bid, DemandCategory, ProjectDetails } from "../types";

const {
  mockPlatformAdapter,
  mockPersistBidStatusChange,
  mockUpdateBidStatusInMemory,
  mockGetDefaultTemplate,
  mockGetTemplateById,
  mockCreateMailtoLink,
  mockGenerateEmlContent,
  mockDownloadEmlFile,
} = vi.hoisted(() => ({
  mockPlatformAdapter: {
    isDesktop: false,
    shell: {
      openExternal: vi.fn(),
      openTempFile: vi.fn(),
    },
  },
  mockPersistBidStatusChange: vi.fn(),
  mockUpdateBidStatusInMemory: vi.fn(),
  mockGetDefaultTemplate: vi.fn(),
  mockGetTemplateById: vi.fn(),
  mockCreateMailtoLink: vi.fn(),
  mockGenerateEmlContent: vi.fn(),
  mockDownloadEmlFile: vi.fn(),
}));

vi.mock("../services/platformAdapter", () => ({
  default: mockPlatformAdapter,
}));

vi.mock("../features/projects/model/pipelineBidStatusModel", () => ({
  persistBidStatusChange: mockPersistBidStatusChange,
  updateBidStatusInMemory: mockUpdateBidStatusInMemory,
}));

vi.mock("../services/templateService", () => ({
  getDefaultTemplate: mockGetDefaultTemplate,
  getTemplateById: mockGetTemplateById,
}));

vi.mock("../services/inquiryService", () => ({
  createMailtoLink: mockCreateMailtoLink,
  generateEmlContent: mockGenerateEmlContent,
  downloadEmlFile: mockDownloadEmlFile,
}));

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
    inquiryLetterLink: null,
    materialInquiryTemplateLink: null,
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

const createBid = (): Bid =>
  ({
    id: "bid-1",
    subcontractorId: "sup-1",
    companyName: "ACME s.r.o.",
    contactPerson: "Pepa",
    email: "acme@example.com",
    phone: "+420777123456",
    status: "contacted",
  }) as Bid;

describe("usePipelineCommunicationActions status persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatformAdapter.isDesktop = false;
    mockGetTemplateById.mockResolvedValue(undefined);
    mockGetDefaultTemplate.mockResolvedValue({
      id: "tpl-1",
      name: "Default",
      subject: "Poptávka {KATEGORIE_NAZEV}",
      content: "Obsah",
      isDefault: true,
      lastModified: "2026-03-19",
    });
    mockCreateMailtoLink.mockReturnValue("mailto:test@example.com");
    mockGenerateEmlContent.mockReturnValue("EML");
    mockPersistBidStatusChange.mockResolvedValue({ error: null });
    mockUpdateBidStatusInMemory.mockImplementation((prev) => prev);
  });

  it("persistuje status sent po standardní poptávce přes mailto", async () => {
    const activeCategory = createCategory();
    const bid = createBid();
    const bids: Record<string, Bid[]> = { [activeCategory.id]: [bid] };
    const updateBidsInternal = vi.fn((updater) => updater(bids));
    const showAlert = vi.fn();
    const runDocHubFallbackForCategory = vi.fn();

    const actions = usePipelineCommunicationActions({
      activeCategory,
      bids,
      projectDetails: createProjectDetails(),
      emailClientMode: "mailto",
      userRole: "admin",
      updateBidsInternal,
      setIsExportMenuOpen: vi.fn(),
      showAlert,
      runDocHubFallbackForCategory,
    });

    await actions.handleGenerateInquiry(bid);

    expect(mockPlatformAdapter.shell.openExternal).toHaveBeenCalledWith(
      "mailto:test@example.com",
    );
    expect(mockPersistBidStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({
        bidId: bid.id,
        targetStatus: "sent",
        activeCategoryId: activeCategory.id,
        projectDataId: "project-1",
      }),
    );
    expect(updateBidsInternal).toHaveBeenCalledTimes(1);
    expect(runDocHubFallbackForCategory).toHaveBeenCalledWith(
      activeCategory.id,
      "inquiry-sent",
    );
    expect(showAlert).not.toHaveBeenCalled();
  });

  it("persistuje status sent i pro materiálovou poptávku v desktop EML režimu", async () => {
    mockPlatformAdapter.isDesktop = true;

    const activeCategory = createCategory();
    const bid = createBid();
    const bids: Record<string, Bid[]> = { [activeCategory.id]: [bid] };
    const updateBidsInternal = vi.fn((updater) => updater(bids));

    const actions = usePipelineCommunicationActions({
      activeCategory,
      bids,
      projectDetails: createProjectDetails(),
      emailClientMode: "mailto",
      userRole: "admin",
      updateBidsInternal,
      setIsExportMenuOpen: vi.fn(),
      showAlert: vi.fn(),
      runDocHubFallbackForCategory: vi.fn(),
    });

    await actions.handleGenerateMaterialInquiry(bid);

    expect(mockGenerateEmlContent).toHaveBeenCalled();
    expect(mockPlatformAdapter.shell.openTempFile).toHaveBeenCalled();
    expect(mockPersistBidStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({
        bidId: bid.id,
        targetStatus: "sent",
      }),
    );
    expect(updateBidsInternal).toHaveBeenCalledTimes(1);
  });

  it("při chybě persistence nenechá lokální stav falešně na sent", async () => {
    mockPersistBidStatusChange.mockResolvedValue({
      error: new Error("db failure"),
    });

    const activeCategory = createCategory();
    const bid = createBid();
    const bids: Record<string, Bid[]> = { [activeCategory.id]: [bid] };
    const updateBidsInternal = vi.fn((updater) => updater(bids));
    const showAlert = vi.fn();
    const runDocHubFallbackForCategory = vi.fn();

    const actions = usePipelineCommunicationActions({
      activeCategory,
      bids,
      projectDetails: createProjectDetails(),
      emailClientMode: "mailto",
      userRole: "admin",
      updateBidsInternal,
      setIsExportMenuOpen: vi.fn(),
      showAlert,
      runDocHubFallbackForCategory,
    });

    await actions.handleGenerateInquiry(bid);

    expect(mockPlatformAdapter.shell.openExternal).toHaveBeenCalled();
    expect(updateBidsInternal).not.toHaveBeenCalled();
    expect(runDocHubFallbackForCategory).not.toHaveBeenCalled();
    expect(showAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Chyba uložení stavu",
        variant: "danger",
      }),
    );
  });
});
