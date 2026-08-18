import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePipelineCommunicationActions } from "../features/projects/model/usePipelineCommunicationActions";
import type { Bid, DemandCategory, ProjectDetails } from "../types";
import { expectConsoleError } from "./utils/consoleGuard";

const {
  mockPlatformAdapter,
  mockPersistBidStatusChange,
  mockUpdateBidStatusInMemory,
  mockGetDefaultTemplate,
  mockGetTemplateById,
  mockGetProjectTemplateSelection,
  mockCreateMailtoLink,
  mockGenerateEmlContent,
  mockDownloadEmlFile,
  mockLoadBudgetAttachmentForEmail,
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
  mockGetProjectTemplateSelection: vi.fn(),
  mockCreateMailtoLink: vi.fn(),
  mockGenerateEmlContent: vi.fn(),
  mockDownloadEmlFile: vi.fn(),
  mockLoadBudgetAttachmentForEmail: vi.fn(),
}));

vi.mock("@infra/platform/platformAdapter", () => ({
  default: mockPlatformAdapter,
}));

vi.mock("../features/projects/model/pipelineBidStatusModel", () => ({
  persistBidStatusChange: mockPersistBidStatusChange,
  updateBidStatusInMemory: mockUpdateBidStatusInMemory,
}));

vi.mock("../services/templateService", () => ({
  getDefaultTemplate: mockGetDefaultTemplate,
  getTemplateById: mockGetTemplateById,
  getProjectTemplateSelection: mockGetProjectTemplateSelection,
}));

vi.mock("../services/inquiryService", () => ({
  createMailtoLink: mockCreateMailtoLink,
  generateEmlContent: mockGenerateEmlContent,
  downloadEmlFile: mockDownloadEmlFile,
}));

vi.mock("../services/budgetAttachmentService", () => ({
  loadBudgetAttachmentForEmail: mockLoadBudgetAttachmentForEmail,
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
    mockLoadBudgetAttachmentForEmail.mockReset();
    mockPlatformAdapter.isDesktop = false;
    mockGetTemplateById.mockResolvedValue(undefined);
    mockGetProjectTemplateSelection.mockResolvedValue(undefined);
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
    mockLoadBudgetAttachmentForEmail.mockResolvedValue({
      filename: "rozpocet.xlsx",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      base64Content: "YWJj",
    });
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
      projectId: "project-1",
      projectDetails: createProjectDetails(),
      emailClientMode: "mailto",
      userRole: "admin",
      updateBidsInternal,
      showAlert,
      runDocHubFallbackForCategory,
    });

    await actions.handleGenerateInquiry(bid);

    expect(mockPlatformAdapter.shell.openExternal).toHaveBeenCalledWith(
      "mailto:test@example.com",
    );
    expect(mockGetDefaultTemplate).toHaveBeenCalledWith({
      projectId: "project-1",
    });
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
      projectId: "project-1",
      projectDetails: createProjectDetails(),
      emailClientMode: "mailto",
      userRole: "admin",
      updateBidsInternal,
      showAlert: vi.fn(),
      runDocHubFallbackForCategory: vi.fn(),
    });

    await actions.handleGenerateMaterialInquiry(bid);

    expect(mockGenerateEmlContent).toHaveBeenCalled();
    expect(mockPlatformAdapter.shell.openTempFile).toHaveBeenCalled();
    expect(mockGetDefaultTemplate).toHaveBeenCalledWith({
      projectId: "project-1",
    });
    expect(mockPersistBidStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({
        bidId: bid.id,
        targetStatus: "sent",
      }),
    );
    expect(updateBidsInternal).toHaveBeenCalledTimes(1);
  });

  it("v desktop EML režimu připojí namapovanou rozpočtovou přílohu", async () => {
    mockPlatformAdapter.isDesktop = true;

    const activeCategory = {
      ...createCategory(),
      budgetAttachment: {
        source: "dochub" as const,
        fileName: "rozpocet.xlsx",
        relativePath: "rozpocet.xlsx",
        selectedAt: "2026-07-01T20:00:00.000Z",
        enabled: true,
      },
    };
    const bid = createBid();
    const bids: Record<string, Bid[]> = { [activeCategory.id]: [bid] };

    const actions = usePipelineCommunicationActions({
      activeCategory,
      bids,
      projectId: "project-1",
      projectDetails: createProjectDetails(),
      emailClientMode: "mailto",
      userRole: "admin",
      updateBidsInternal: vi.fn((updater) => updater(bids)),
      showAlert: vi.fn(),
      runDocHubFallbackForCategory: vi.fn(),
      resolveDesktopTenderFolderPath: vi.fn().mockResolvedValue("/Projects/Stavba/Betony"),
    });

    await actions.handleGenerateInquiry(bid);

    expect(mockLoadBudgetAttachmentForEmail).toHaveBeenCalledWith(
      "/Projects/Stavba/Betony",
      activeCategory.budgetAttachment,
    );
    expect(mockGenerateEmlContent).toHaveBeenCalledWith(
      bid.email,
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            filename: "rozpocet.xlsx",
          }),
        ],
      }),
    );
  });

  it("v desktop EML režimu připojí všechny namapované rozpočtové přílohy", async () => {
    mockPlatformAdapter.isDesktop = true;
    mockLoadBudgetAttachmentForEmail
      .mockResolvedValueOnce({ filename: "rozpocet.xlsx", contentType: "application/octet-stream", base64Content: "MQ==" })
      .mockResolvedValueOnce({ filename: "vykaz.pdf", contentType: "application/pdf", base64Content: "Mg==" });

    const activeCategory = {
      ...createCategory(),
      budgetAttachments: [
        { source: "dochub" as const, fileName: "rozpocet.xlsx", relativePath: "rozpocet.xlsx", size: 1024, selectedAt: "2026-07-01T20:00:00.000Z", enabled: true },
        { source: "dochub" as const, fileName: "vykaz.pdf", relativePath: "podklady/vykaz.pdf", size: 2048, selectedAt: "2026-07-01T20:01:00.000Z", enabled: true },
      ],
    };
    const bid = createBid();
    const bids: Record<string, Bid[]> = { [activeCategory.id]: [bid] };

    const actions = usePipelineCommunicationActions({
      activeCategory,
      bids,
      projectId: "project-1",
      projectDetails: createProjectDetails(),
      emailClientMode: "mailto",
      userRole: "admin",
      updateBidsInternal: vi.fn((updater) => updater(bids)),
      showAlert: vi.fn(),
      runDocHubFallbackForCategory: vi.fn(),
      resolveDesktopTenderFolderPath: vi.fn().mockResolvedValue("/Projects/Stavba/Betony"),
    });

    await actions.handleGenerateInquiry(bid);

    expect(mockLoadBudgetAttachmentForEmail).toHaveBeenCalledTimes(2);
    expect(mockGenerateEmlContent).toHaveBeenCalledWith(
      bid.email,
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        attachments: [
          expect.objectContaining({ filename: "rozpocet.xlsx" }),
          expect.objectContaining({ filename: "vykaz.pdf" }),
        ],
      }),
    );
  });

  it("před načtením přeskočí přílohu nad souhrnný limit EML", async () => {
    mockPlatformAdapter.isDesktop = true;
    mockLoadBudgetAttachmentForEmail
      .mockResolvedValueOnce({
        filename: "prvni.xlsx",
        contentType: "application/octet-stream",
        base64Content: "MQ==",
      })
      .mockResolvedValueOnce({
        filename: "druha.xlsx",
        contentType: "application/octet-stream",
        base64Content: "Mg==",
      });
    const eightMiB = 8 * 1024 * 1024;
    const activeCategory = {
      ...createCategory(),
      budgetAttachments: [
        {
          source: "dochub" as const,
          fileName: "prvni.xlsx",
          relativePath: "prvni.xlsx",
          size: eightMiB,
          selectedAt: "2026-07-01T20:00:00.000Z",
          enabled: true,
        },
        {
          source: "dochub" as const,
          fileName: "druha.xlsx",
          relativePath: "druha.xlsx",
          size: eightMiB,
          selectedAt: "2026-07-01T20:01:00.000Z",
          enabled: true,
        },
        {
          source: "dochub" as const,
          fileName: "treti.xlsx",
          relativePath: "treti.xlsx",
          size: eightMiB,
          selectedAt: "2026-07-01T20:02:00.000Z",
          enabled: true,
        },
      ],
    };
    const bid = createBid();
    const bids: Record<string, Bid[]> = { [activeCategory.id]: [bid] };
    const showAlert = vi.fn();
    const actions = usePipelineCommunicationActions({
      activeCategory,
      bids,
      projectId: "project-1",
      projectDetails: createProjectDetails(),
      emailClientMode: "mailto",
      userRole: "admin",
      updateBidsInternal: vi.fn((updater) => updater(bids)),
      showAlert,
      runDocHubFallbackForCategory: vi.fn(),
      resolveDesktopTenderFolderPath: vi
        .fn()
        .mockResolvedValue("/Projects/Stavba/Betony"),
    });

    await actions.handleGenerateInquiry(bid);

    expect(mockLoadBudgetAttachmentForEmail).toHaveBeenCalledTimes(2);
    expect(mockLoadBudgetAttachmentForEmail).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ fileName: "treti.xlsx" }),
    );
    expect(showAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Příloha nebyla vložena",
        message: expect.stringContaining("celkový limit 20 MB"),
      }),
    );
    expect(mockGenerateEmlContent).toHaveBeenCalledWith(
      bid.email,
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        attachments: [
          expect.objectContaining({ filename: "prvni.xlsx" }),
          expect.objectContaining({ filename: "druha.xlsx" }),
        ],
      }),
    );
  });

  it("při chybě jedné z více příloh zachová ostatní v EML", async () => {
    mockPlatformAdapter.isDesktop = true;
    mockLoadBudgetAttachmentForEmail
      .mockRejectedValueOnce(new Error("vykaz.pdf nelze načíst"))
      .mockResolvedValueOnce({ filename: "rozpocet.xlsx", contentType: "application/octet-stream", base64Content: "MQ==" });
    const activeCategory = {
      ...createCategory(),
      budgetAttachments: [
        { source: "dochub" as const, fileName: "vykaz.pdf", relativePath: "vykaz.pdf", selectedAt: "2026-07-01T20:00:00.000Z", enabled: true },
        { source: "dochub" as const, fileName: "rozpocet.xlsx", relativePath: "rozpocet.xlsx", selectedAt: "2026-07-01T20:01:00.000Z", enabled: true },
      ],
    };
    const bid = createBid();
    const bids: Record<string, Bid[]> = { [activeCategory.id]: [bid] };
    const showAlert = vi.fn();
    const actions = usePipelineCommunicationActions({
      activeCategory,
      bids,
      projectId: "project-1",
      projectDetails: createProjectDetails(),
      emailClientMode: "mailto",
      userRole: "admin",
      updateBidsInternal: vi.fn((updater) => updater(bids)),
      showAlert,
      runDocHubFallbackForCategory: vi.fn(),
      resolveDesktopTenderFolderPath: vi.fn().mockResolvedValue("/Projects/Stavba/Betony"),
    });

    await actions.handleGenerateInquiry(bid);

    expect(showAlert).toHaveBeenCalledWith(expect.objectContaining({
      title: "Příloha nebyla vložena",
      message: expect.stringContaining("vykaz.pdf nelze načíst"),
    }));
    expect(mockGenerateEmlContent).toHaveBeenCalledWith(
      bid.email,
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        attachments: [expect.objectContaining({ filename: "rozpocet.xlsx" })],
      }),
    );
  });

  it("u známé nadlimitní přílohy vytvoří EML bez ní a bez dalšího modalu", async () => {
    mockPlatformAdapter.isDesktop = true;

    const activeCategory = {
      ...createCategory(),
      budgetAttachment: {
        source: "dochub" as const,
        fileName: "velky-rozpocet.xlsx",
        relativePath: "velky-rozpocet.xlsx",
        size: 10 * 1024 * 1024 + 1,
        selectedAt: "2026-07-01T20:00:00.000Z",
        enabled: true,
      },
    };
    const bid = createBid();
    const bids: Record<string, Bid[]> = { [activeCategory.id]: [bid] };
    const showAlert = vi.fn();

    const actions = usePipelineCommunicationActions({
      activeCategory,
      bids,
      projectId: "project-1",
      projectDetails: createProjectDetails(),
      emailClientMode: "mailto",
      userRole: "admin",
      updateBidsInternal: vi.fn((updater) => updater(bids)),
      showAlert,
      runDocHubFallbackForCategory: vi.fn(),
      resolveDesktopTenderFolderPath: vi.fn().mockResolvedValue("/Projects/Stavba/Betony"),
    });

    await actions.handleGenerateInquiry(bid);

    expect(mockLoadBudgetAttachmentForEmail).not.toHaveBeenCalled();
    expect(showAlert).not.toHaveBeenCalled();
    expect(mockGenerateEmlContent).toHaveBeenCalledWith(
      bid.email,
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ attachments: [] }),
    );
    expect(mockPlatformAdapter.shell.openTempFile).toHaveBeenCalledWith(
      "EML",
      expect.stringMatching(/^Poptavka_\d+\.eml$/),
    );
    expect(mockPersistBidStatusChange).toHaveBeenCalled();
  });

  it("při pozdější chybě přílohy upozorní uživatele, ale EML přesto vytvoří", async () => {
    mockPlatformAdapter.isDesktop = true;
    mockLoadBudgetAttachmentForEmail.mockRejectedValue(
      new Error("Soubor je větší než povolený limit 10 MB."),
    );

    const activeCategory = {
      ...createCategory(),
      budgetAttachment: {
        source: "dochub" as const,
        fileName: "rozpocet.xlsx",
        relativePath: "rozpocet.xlsx",
        size: 1024,
        selectedAt: "2026-07-01T20:00:00.000Z",
        enabled: true,
      },
    };
    const bid = createBid();
    const bids: Record<string, Bid[]> = { [activeCategory.id]: [bid] };
    const showAlert = vi.fn();

    const actions = usePipelineCommunicationActions({
      activeCategory,
      bids,
      projectId: "project-1",
      projectDetails: createProjectDetails(),
      emailClientMode: "mailto",
      userRole: "admin",
      updateBidsInternal: vi.fn((updater) => updater(bids)),
      showAlert,
      runDocHubFallbackForCategory: vi.fn(),
      resolveDesktopTenderFolderPath: vi.fn().mockResolvedValue("/Projects/Stavba/Betony"),
    });

    await actions.handleGenerateInquiry(bid);

    expect(showAlert).toHaveBeenCalledWith({
      title: "Příloha nebyla vložena",
      message:
        "Soubor je větší než povolený limit 10 MB. EML zpráva bude vytvořena bez této přílohy.",
      variant: "info",
    });
    expect(mockGenerateEmlContent).toHaveBeenCalledWith(
      bid.email,
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ attachments: [] }),
    );
    expect(mockPlatformAdapter.shell.openTempFile).toHaveBeenCalled();
  });

  it("v mailto režimu negeneruje opakované upozornění kvůli lokální příloze", async () => {
    const activeCategory = {
      ...createCategory(),
      budgetAttachment: {
        source: "dochub" as const,
        fileName: "rozpocet.xlsx",
        relativePath: "rozpocet.xlsx",
        selectedAt: "2026-07-01T20:00:00.000Z",
        enabled: true,
      },
    };
    const bid = createBid();
    const bids: Record<string, Bid[]> = { [activeCategory.id]: [bid] };
    const showAlert = vi.fn();

    const actions = usePipelineCommunicationActions({
      activeCategory,
      bids,
      projectId: "project-1",
      projectDetails: createProjectDetails(),
      emailClientMode: "mailto",
      userRole: "admin",
      updateBidsInternal: vi.fn((updater) => updater(bids)),
      showAlert,
      runDocHubFallbackForCategory: vi.fn(),
      resolveDesktopTenderFolderPath: vi.fn(),
    });

    await actions.handleGenerateInquiry(bid);

    expect(mockLoadBudgetAttachmentForEmail).not.toHaveBeenCalled();
    expect(showAlert).not.toHaveBeenCalled();
    expect(mockPlatformAdapter.shell.openExternal).toHaveBeenCalledWith(
      "mailto:test@example.com",
    );
  });

  it("v EML režimu zachová HTML strukturu šablony a podpisu bez globálního br převodu", async () => {
    mockPlatformAdapter.isDesktop = true;
    mockGetDefaultTemplate.mockResolvedValue({
      id: "tpl-html",
      name: "HTML",
      subject: "Poptávka {KATEGORIE_NAZEV}",
      content:
        "<p>Dobrý den,</p>\n<p>posílám poptávku.</p>\n{PODPIS_UZIVATELE}",
      isDefault: true,
      lastModified: "2026-03-19",
    });

    const activeCategory = createCategory();
    const bid = createBid();
    const bids: Record<string, Bid[]> = { [activeCategory.id]: [bid] };

    const actions = usePipelineCommunicationActions({
      activeCategory,
      bids,
      projectId: "project-1",
      projectDetails: createProjectDetails({
        siteManager:
          "<div class=\"signature\"><p>S pozdravem</p><p><strong>Vedouci</strong></p></div>",
      }),
      emailClientMode: "mailto",
      userRole: "admin",
      updateBidsInternal: vi.fn((updater) => updater(bids)),
      showAlert: vi.fn(),
      runDocHubFallbackForCategory: vi.fn(),
    });

    await actions.handleGenerateInquiry(bid);

    expect(mockGenerateEmlContent).toHaveBeenCalledWith(
      bid.email,
      expect.any(String),
      expect.stringContaining("<p>Dobrý den,</p>"),
      expect.objectContaining({
        attachments: [],
      }),
    );
    const [, , htmlBody] = mockGenerateEmlContent.mock.calls[0];
    expect(htmlBody).toContain("<p>posílám poptávku.</p>");
    expect(htmlBody).toContain("S pozdravem");
    expect(htmlBody).not.toContain("</p><br><p>");
  });

  it("při chybě persistence nenechá lokální stav falešně na sent", async () => {
    expectConsoleError("Error persisting sent statuses after inquiry generation:");
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
      projectId: "project-1",
      projectDetails: createProjectDetails(),
      emailClientMode: "mailto",
      userRole: "admin",
      updateBidsInternal,
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
