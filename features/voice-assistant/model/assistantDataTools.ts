import type { Bid, ContractWithDetails, DemandCategory, Project, ProjectDetails, Subcontractor } from "@/types";
import type { VoiceAssistantContextData, VoiceAssistantToolName } from "../types";

type ToolArgs = Record<string, unknown>;

export type AssistantToolResult =
  | { ok: true; tool: VoiceAssistantToolName; source: Record<string, unknown>; data: unknown }
  | {
      ok: false;
      tool: string;
      allowed?: false;
      code: "tool_not_allowed" | "not_found" | "ambiguous" | "missing_argument";
      message: string;
      source?: Record<string, unknown>;
      candidates?: unknown[];
    };

export const ASSISTANT_READONLY_TOOLS = [
  "list_projects",
  "find_project",
  "get_project_detail",
  "list_project_tenders",
  "get_tender_detail",
  "get_tender_winner",
  "list_tender_bids",
  "list_project_winners",
  "find_contacts",
  "get_contact_detail",
  "get_schedule",
  "get_tender_plan",
  "get_contract_summary",
  "get_contract_detail",
  "search_projects",
  "get_project_summary",
  "list_upcoming_deadlines",
  "draft_followup_email",
] as const satisfies readonly VoiceAssistantToolName[];

const ALLOWED_TOOLS = new Set<string>(ASSISTANT_READONLY_TOOLS);

const normalize = (value: unknown): string =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

const queryTokens = (query: string): string[] =>
  normalize(query)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);

const matchesNormalizedQuery = (haystackParts: unknown[], query: string): boolean => {
  const normalizedHaystack = normalize(haystackParts.filter(Boolean).join(" "));
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return true;
  if (normalizedHaystack.includes(normalizedQuery)) return true;
  const tokens = queryTokens(query);
  if (tokens.length === 0) return false;
  return tokens.every((token) => normalizedHaystack.includes(token));
};

const parseArgs = (rawArgs: unknown): ToolArgs => {
  if (rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)) {
    return rawArgs as ToolArgs;
  }
  if (typeof rawArgs !== "string") return {};
  try {
    const parsed = JSON.parse(rawArgs || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as ToolArgs)
      : {};
  } catch {
    return {};
  }
};

const safeText = (value: unknown, maxLength = 120): string =>
  String(value ?? "")
    .trim()
    .slice(0, maxLength);

const boundedLimit = (value: unknown, fallback = 8): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(Math.floor(parsed), 20));
};

const boundedRangeDays = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(1, Math.min(Math.floor(parsed), 180));
};

const parseMoney = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "");
  if (!text.trim()) return null;
  const hasMillions = /m/i.test(text);
  const hasThousands = /k/i.test(text) && !/kc|kč/i.test(normalize(text));
  const parsed = Number.parseFloat(
    text.replace(/\s/g, "").replace(/[^0-9,.-]/g, "").replace(",", "."),
  );
  if (!Number.isFinite(parsed)) return null;
  if (hasMillions) return parsed * 1_000_000;
  if (hasThousands) return parsed * 1_000;
  return parsed;
};

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const projectName = (project: Project | null | undefined, details?: ProjectDetails | null): string =>
  details?.title || project?.name || "";

const getProjectEntries = (context: VoiceAssistantContextData) =>
  context.sources.projects.map((project) => ({
    project,
    details: context.sources.projectDetails[project.id] || null,
  }));

const serializeProject = (project: Project | null, details?: ProjectDetails | null) => ({
  id: project?.id || details?.id || null,
  name: projectName(project, details),
  status: project?.status || details?.status || null,
  location: project?.location || details?.location || null,
  investor: details?.investor || null,
  finishDate: details?.finishDate || null,
  siteManager: details?.siteManager || null,
});

const serializeProjectListItem = (project: Project, details?: ProjectDetails | null) => ({
  ...serializeProject(project, details),
  hasDetails: Boolean(details),
  tenderCount: details?.categories?.length || 0,
});

const serializeTender = (projectId: string, category: DemandCategory) => ({
  id: category.id,
  projectId,
  title: category.title,
  status: category.status,
  deadline: category.deadline || null,
  realizationStart: category.realizationStart || null,
  realizationEnd: category.realizationEnd || null,
  sodBudget: category.sodBudget || 0,
  planBudget: category.planBudget || 0,
  budgetDisplay: category.budget || null,
  subcontractorCount: category.subcontractorCount || 0,
  workItems: category.workItems || [],
});

const serializeBid = (bid: Bid, categoryId: string) => ({
  id: bid.id,
  categoryId,
  subcontractorId: bid.subcontractorId,
  companyName: bid.companyName,
  contactPerson: bid.contactPerson || null,
  email: bid.email || null,
  phone: bid.phone || null,
  price: bid.price || null,
  priceValue: parseMoney(bid.price),
  priceHistory: bid.priceHistory || {},
  notes: bid.notes || null,
  tags: bid.tags || [],
  status: bid.status,
  updateDate: bid.updateDate || null,
  selectionRound: bid.selectionRound ?? null,
  contracted: Boolean(bid.contracted),
});

const getProjectContracts = (
  context: VoiceAssistantContextData,
  projectId: string,
): ContractWithDetails[] => context.sources.contractsByProject?.[projectId] || [];

const serializeContractSummary = (contract: ContractWithDetails) => ({
  id: contract.id,
  projectId: contract.projectId,
  vendorId: contract.vendorId || null,
  vendorName: contract.vendorName,
  title: contract.title,
  contractNumber: contract.contractNumber || null,
  status: contract.status,
  currency: contract.currency,
  basePrice: contract.basePrice,
  currentTotal: contract.currentTotal,
  approvedSum: contract.approvedSum,
  remaining: contract.remaining,
  invoicedSum: contract.invoicedSum,
  paidSum: contract.paidSum,
  overdueSum: contract.overdueSum,
  signedAt: contract.signedAt || null,
  effectiveFrom: contract.effectiveFrom || null,
  effectiveTo: contract.effectiveTo || null,
  completionDate: contract.completionDate || null,
  source: contract.source,
  sourceBidId: contract.sourceBidId || null,
  documentUrl: contract.documentUrl || null,
  terms: {
    retentionLegacy: {
      percent: asNumber(contract.retentionPercent),
      amount: asNumber(contract.retentionAmount),
    },
    retentionShort: {
      percent: asNumber(contract.retentionShortPercent),
      amount: asNumber(contract.retentionShortAmount),
      releaseOn: contract.retentionShortReleaseOn || null,
      status: contract.retentionShortStatus || null,
    },
    retentionLong: {
      percent: asNumber(contract.retentionLongPercent),
      amount: asNumber(contract.retentionLongAmount),
      releaseOn: contract.retentionLongReleaseOn || null,
      status: contract.retentionLongStatus || null,
    },
    siteSetupPercent: asNumber(contract.siteSetupPercent),
    warrantyMonths: asNumber(contract.warrantyMonths),
    paymentTerms: contract.paymentTerms || null,
    scopeSummary: contract.scopeSummary || null,
  },
});

const serializeContractDetail = (contract: ContractWithDetails) => ({
  ...serializeContractSummary(contract),
  vendorIco: contract.vendorIco || null,
  extractionConfidence: asNumber(contract.extractionConfidence),
  vendorRating: asNumber(contract.vendorRating),
  vendorRatingNote: contract.vendorRatingNote || null,
  amendments: (contract.amendments || []).map((amendment) => ({
    id: amendment.id,
    amendmentNo: amendment.amendmentNo,
    signedAt: amendment.signedAt || null,
    effectiveFrom: amendment.effectiveFrom || null,
    deltaPrice: amendment.deltaPrice,
    deltaDeadline: amendment.deltaDeadline || null,
    reason: amendment.reason || null,
    documentUrl: amendment.documentUrl || null,
  })),
  drawdowns: (contract.drawdowns || []).map((drawdown) => ({
    id: drawdown.id,
    period: drawdown.period,
    claimedAmount: drawdown.claimedAmount,
    approvedAmount: drawdown.approvedAmount,
    note: drawdown.note || null,
    documentUrl: drawdown.documentUrl || null,
  })),
  invoices: (contract.invoices || []).map((invoice) => ({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    amount: invoice.amount,
    currency: invoice.currency,
    status: invoice.status,
    paidAt: invoice.paidAt || null,
    note: invoice.note || null,
    documentUrl: invoice.documentUrl || null,
  })),
});

const findLinkedContract = (
  contracts: ContractWithDetails[],
  bid: Bid,
): ContractWithDetails | null => {
  const byBidId = contracts.find((contract) => contract.sourceBidId === bid.id);
  if (byBidId) return byBidId;

  const byVendorId = contracts.find((contract) => contract.vendorId && contract.vendorId === bid.subcontractorId);
  if (byVendorId) return byVendorId;

  const bidCompany = normalize(bid.companyName);
  if (!bidCompany) return null;
  return contracts.find((contract) => normalize(contract.vendorName) === bidCompany) || null;
};

const serializeBidWithContract = (
  bid: Bid,
  categoryId: string,
  contracts: ContractWithDetails[],
) => {
  const linkedContract = findLinkedContract(contracts, bid);
  return {
    ...serializeBid(bid, categoryId),
    linkedContract: linkedContract ? serializeContractSummary(linkedContract) : null,
  };
};

const allContracts = (context: VoiceAssistantContextData): ContractWithDetails[] =>
  Object.values(context.sources.contractsByProject || {}).flat();

const findProjects = (context: VoiceAssistantContextData, query: string, limit = 8) => {
  return getProjectEntries(context)
    .filter(({ project, details }) => {
      return matchesNormalizedQuery([
        project.name,
        project.location,
        project.status,
        details?.title,
        details?.investor,
        details?.siteManager,
      ], query);
    })
    .slice(0, limit);
};

const resolveProject = (args: ToolArgs, context: VoiceAssistantContextData) => {
  const explicitProjectName = safeText(args.projectName ?? args.project ?? args.query);
  const projectId = safeText(args.projectId) || (!explicitProjectName ? context.currentProjectId || "" : "");
  if (projectId) {
    const direct = getProjectEntries(context).find(
      ({ project, details }) => project.id === projectId || details?.id === projectId,
    );
    if (direct) return { status: "found" as const, item: direct };
  }

  const query = explicitProjectName;
  if (!query) {
    return { status: "missing" as const, message: "Chybi projectId nebo nazev projektu." };
  }

  const matches = findProjects(context, query, 5);
  if (matches.length === 1) return { status: "found" as const, item: matches[0] };
  if (matches.length > 1) {
    return {
      status: "ambiguous" as const,
      message: "Projekt neni jednoznacny.",
      candidates: matches.map(({ project, details }) => serializeProject(project, details)),
    };
  }
  return { status: "not_found" as const, message: "Projekt nebyl nalezen." };
};

const findTenderMatches = (details: ProjectDetails, args: ToolArgs) => {
  const tenderId = safeText(args.tenderId ?? args.categoryId);
  if (tenderId) {
    return details.categories.filter((category) => category.id === tenderId);
  }
  const query = safeText(args.tenderName ?? args.categoryName ?? args.tender ?? args.query);
  return details.categories.filter((category) => {
    return matchesNormalizedQuery([
      category.title,
      category.status,
      ...(category.workItems || []),
    ], query);
  });
};

const resolveTender = (args: ToolArgs, context: VoiceAssistantContextData) => {
  const projectResult = resolveProject(args, context);
  if (projectResult.status !== "found") return projectResult;
  const { project, details } = projectResult.item;
  if (!details) return { status: "not_found" as const, message: "Detail projektu neni nacteny." };

  const matches = findTenderMatches(details, args);
  if (matches.length === 1) {
    return { status: "found" as const, project, details, category: matches[0] };
  }
  if (matches.length > 1) {
    return {
      status: "ambiguous" as const,
      message: "Vyberove rizeni neni jednoznacne.",
      candidates: matches.slice(0, 8).map((category) =>
        serializeTender(project.id, category),
      ),
    };
  }
  return { status: "not_found" as const, message: "Vyberove rizeni nebylo nalezeno." };
};

const getCategoryBids = (details: ProjectDetails, categoryId: string): Bid[] =>
  details.bids?.[categoryId] || [];

const winnerBids = (details: ProjectDetails, categoryId: string): Bid[] =>
  getCategoryBids(details, categoryId).filter((bid) => bid.status === "sod");

const ok = (
  tool: VoiceAssistantToolName,
  source: Record<string, unknown>,
  data: unknown,
): AssistantToolResult => ({ ok: true, tool, source, data });

const failFromResolution = (tool: string, resolution: { status: string; message?: string; candidates?: unknown[] }): AssistantToolResult => ({
  ok: false,
  tool,
  code: resolution.status === "ambiguous" ? "ambiguous" : resolution.status === "missing" ? "missing_argument" : "not_found",
  message: resolution.message || "Pozadovana data nebyla nalezena.",
  candidates: resolution.candidates,
});

const getContactPrimary = (contact: Subcontractor) => {
  const first = contact.contacts?.[0];
  return first
    ? { name: first.name, email: first.email, phone: first.phone, position: first.position || null }
    : { name: contact.name || null, email: contact.email || null, phone: contact.phone || null, position: null };
};

const serializeContact = (contact: Subcontractor, detailed = false) => ({
  id: contact.id,
  company: contact.company,
  specialization: contact.specialization || [],
  status: contact.status,
  ico: detailed ? contact.ico || null : undefined,
  region: contact.region || null,
  regions: detailed ? contact.regions || [] : undefined,
  address: detailed ? contact.address || null : undefined,
  city: contact.city || null,
  web: detailed ? contact.web || null : undefined,
  note: detailed ? contact.note || null : undefined,
  primaryContact: getContactPrimary(contact),
  contacts: detailed ? contact.contacts || [] : undefined,
  vendorRatingAverage: detailed ? contact.vendorRatingAverage ?? null : undefined,
  vendorRatingCount: detailed ? contact.vendorRatingCount ?? null : undefined,
});

const toolHandlers: Record<VoiceAssistantToolName, (args: ToolArgs, context: VoiceAssistantContextData) => AssistantToolResult> = {
  list_projects: (args, context) => {
    const limit = boundedLimit(args.limit, 12);
    const status = safeText(args.status);
    const normalizedStatus = normalize(status);
    const entries = getProjectEntries(context)
      .filter(({ project, details }) => {
        if (!normalizedStatus) return true;
        return normalize(project.status || details?.status).includes(normalizedStatus);
      })
      .slice(0, limit);

    return ok("list_projects", { entity: "project", limit, status: status || null }, {
      totalAvailable: context.sources.projects.length,
      returned: entries.length,
      projects: entries.map(({ project, details }) => serializeProjectListItem(project, details)),
    });
  },

  find_project: (args, context) => {
    const query = safeText(args.query ?? args.projectName);
    const results = findProjects(context, query, boundedLimit(args.limit)).map(({ project, details }) =>
      serializeProject(project, details),
    );
    return ok("find_project", { entity: "project", query }, { query, results });
  },
  search_projects: (args, context) => toolHandlers.find_project(args, context),

  get_project_detail: (args, context) => {
    const projectResult = resolveProject(args, context);
    if (projectResult.status !== "found") return failFromResolution("get_project_detail", projectResult);
    const { project, details } = projectResult.item;
    if (!details) return failFromResolution("get_project_detail", { status: "not_found", message: "Detail projektu neni nacteny." });
    const contracts = getProjectContracts(context, project.id);
    return ok(
      "get_project_detail",
      { entity: "project", projectId: project.id },
      {
        project: serializeProject(project, details),
        financials: {
          plannedCost: details.plannedCost || 0,
          investorSodPrice: details.investorFinancials?.sodPrice || 0,
          investorAmendments: details.investorFinancials?.amendments || [],
          investorInvoices: details.investorFinancials?.invoices || [],
          internalAmendments: details.internalAmendments || [],
        },
        documents: {
          documentationLink: details.documentationLink || null,
          documentLinks: details.documentLinks || [],
          docHubEnabled: Boolean(details.docHubEnabled),
          docHubStatus: details.docHubStatus || null,
        },
        contracts: contracts.map(serializeContractSummary),
        tenders: details.categories.map((category) => serializeTender(project.id, category)),
        winners: details.categories.flatMap((category) =>
          winnerBids(details, category.id).map((bid) => ({
            tender: serializeTender(project.id, category),
            bid: serializeBidWithContract(bid, category.id, contracts),
          })),
        ),
      },
    );
  },
  get_project_summary: (args, context) => {
    const projectResult = resolveProject(args, context);
    if (projectResult.status !== "found") return failFromResolution("get_project_summary", projectResult);
    const { project, details } = projectResult.item;
    if (!details) return failFromResolution("get_project_summary", { status: "not_found", message: "Detail projektu neni nacteny." });
    return ok("get_project_summary", { entity: "project", projectId: project.id }, {
      project: serializeProject(project, details),
      tenders: details.categories.slice(0, 12).map((category) => ({
        id: category.id,
        title: category.title,
        status: category.status,
        deadline: category.deadline || null,
        subcontractorCount: category.subcontractorCount,
      })),
    });
  },

  list_project_tenders: (args, context) => {
    const projectResult = resolveProject(args, context);
    if (projectResult.status !== "found") return failFromResolution("list_project_tenders", projectResult);
    const { project, details } = projectResult.item;
    if (!details) return failFromResolution("list_project_tenders", { status: "not_found", message: "Detail projektu neni nacteny." });
    return ok("list_project_tenders", { entity: "project", projectId: project.id }, {
      project: serializeProject(project, details),
      tenders: details.categories.map((category) => serializeTender(project.id, category)),
    });
  },

  get_tender_detail: (args, context) => {
    const tender = resolveTender(args, context);
    if (tender.status !== "found") return failFromResolution("get_tender_detail", tender);
    const bids = getCategoryBids(tender.details, tender.category.id);
    const contracts = getProjectContracts(context, tender.project.id);
    return ok("get_tender_detail", { entity: "tender", projectId: tender.project.id, tenderId: tender.category.id }, {
      project: serializeProject(tender.project, tender.details),
      tender: {
        ...serializeTender(tender.project.id, tender.category),
        description: tender.category.description || null,
        documents: tender.category.documents || [],
      },
      bids: bids.map((bid) => serializeBidWithContract(bid, tender.category.id, contracts)),
      winners: bids
        .filter((bid) => bid.status === "sod")
        .map((bid) => serializeBidWithContract(bid, tender.category.id, contracts)),
    });
  },

  get_tender_winner: (args, context) => {
    const tender = resolveTender(args, context);
    if (tender.status !== "found") return failFromResolution("get_tender_winner", tender);
    const winners = winnerBids(tender.details, tender.category.id);
    const contracts = getProjectContracts(context, tender.project.id);
    return ok("get_tender_winner", { entity: "tender", projectId: tender.project.id, tenderId: tender.category.id }, {
      project: serializeProject(tender.project, tender.details),
      tender: serializeTender(tender.project.id, tender.category),
      hasWinner: winners.length > 0,
      winners: winners.map((bid) => serializeBidWithContract(bid, tender.category.id, contracts)),
      message: winners.length > 0
        ? "Vyberove rizeni ma vybraneho viteze."
        : "Vyberove rizeni zatim nema vybraneho viteze ve stavu SOD.",
    });
  },

  list_tender_bids: (args, context) => {
    const tender = resolveTender(args, context);
    if (tender.status !== "found") return failFromResolution("list_tender_bids", tender);
    const contracts = getProjectContracts(context, tender.project.id);
    return ok("list_tender_bids", { entity: "tender", projectId: tender.project.id, tenderId: tender.category.id }, {
      project: serializeProject(tender.project, tender.details),
      tender: serializeTender(tender.project.id, tender.category),
      bids: getCategoryBids(tender.details, tender.category.id).map((bid) =>
        serializeBidWithContract(bid, tender.category.id, contracts),
      ),
    });
  },

  list_project_winners: (args, context) => {
    const projectResult = resolveProject(args, context);
    if (projectResult.status !== "found") return failFromResolution("list_project_winners", projectResult);
    const { project, details } = projectResult.item;
    if (!details) return failFromResolution("list_project_winners", { status: "not_found", message: "Detail projektu neni nacteny." });
    const contracts = getProjectContracts(context, project.id);
    const winners = details.categories.flatMap((category) =>
      winnerBids(details, category.id).map((bid) => ({
        tender: serializeTender(project.id, category),
        bid: serializeBidWithContract(bid, category.id, contracts),
      })),
    );
    return ok("list_project_winners", { entity: "project", projectId: project.id }, {
      project: serializeProject(project, details),
      winners,
    });
  },

  find_contacts: (args, context) => {
    const query = safeText(args.query);
    const results = context.sources.contacts
      .filter((contact) => {
        return matchesNormalizedQuery([
          contact.company,
          contact.name,
          contact.email,
          contact.phone,
          contact.city,
          contact.region,
          ...(contact.specialization || []),
          ...(contact.contacts || []).flatMap((person) => [
            person.name,
            person.email,
            person.phone,
            person.position,
          ]),
        ], query);
      })
      .slice(0, boundedLimit(args.limit))
      .map((contact) => serializeContact(contact));
    return ok("find_contacts", { entity: "contact", query }, { query, results });
  },

  get_contact_detail: (args, context) => {
    const contactId = safeText(args.contactId);
    const query = safeText(args.query ?? args.company ?? args.companyName);
    const matches = context.sources.contacts.filter((contact) => {
      if (contactId) return contact.id === contactId;
      if (!query) return false;
      return matchesNormalizedQuery([contact.company, contact.name, contact.ico], query);
    });
    if (matches.length === 1) {
      return ok("get_contact_detail", { entity: "contact", contactId: matches[0].id }, {
        contact: serializeContact(matches[0], true),
      });
    }
    if (matches.length > 1) {
      return {
        ok: false,
        tool: "get_contact_detail",
        code: "ambiguous",
        message: "Kontakt neni jednoznacny.",
        candidates: matches.slice(0, 8).map((contact) => serializeContact(contact)),
      };
    }
    return { ok: false, tool: "get_contact_detail", code: "not_found", message: "Kontakt nebyl nalezen." };
  },

  get_schedule: (args, context) => {
    const projectResult = resolveProject(args, context);
    if (projectResult.status !== "found") return failFromResolution("get_schedule", projectResult);
    const { project, details } = projectResult.item;
    if (!details) return failFromResolution("get_schedule", { status: "not_found", message: "Detail projektu neni nacteny." });
    return ok("get_schedule", { entity: "project", projectId: project.id }, {
      project: serializeProject(project, details),
      finishDate: details.finishDate || null,
      tenderStages: details.categories.map((category) => ({
        id: category.id,
        title: category.title,
        deadline: category.deadline || null,
        realizationStart: category.realizationStart || null,
        realizationEnd: category.realizationEnd || null,
        status: category.status,
      })),
    });
  },

  get_tender_plan: (args, context) => {
    const projectResult = resolveProject(args, context);
    if (projectResult.status !== "found") return failFromResolution("get_tender_plan", projectResult);
    const { project, details } = projectResult.item;
    if (!details) return failFromResolution("get_tender_plan", { status: "not_found", message: "Detail projektu neni nacteny." });
    return ok("get_tender_plan", { entity: "project", projectId: project.id }, {
      project: serializeProject(project, details),
      items: details.categories.map((category) => ({
        id: category.id,
        name: category.title,
        dateFrom: category.realizationStart || null,
        dateTo: category.realizationEnd || null,
        categoryId: category.id,
        deadline: category.deadline || null,
      })),
    });
  },

  list_upcoming_deadlines: (args, context) => {
    const rangeDays = boundedRangeDays(args.rangeDays);
    const now = new Date();
    const max = new Date(now.getTime() + rangeDays * 24 * 60 * 60 * 1000);
    const deadlines = getProjectEntries(context)
      .flatMap(({ project, details }) =>
        (details?.categories || [])
          .filter((category) => category.deadline)
          .map((category) => ({
            projectId: project.id,
            projectTitle: projectName(project, details),
            tenderId: category.id,
            tenderTitle: category.title,
            deadline: category.deadline as string,
            status: category.status,
          })),
      )
      .filter((item) => {
        const date = new Date(item.deadline);
        return Number.isFinite(date.getTime()) && date >= now && date <= max;
      })
      .sort((a, b) => a.deadline.localeCompare(b.deadline))
      .slice(0, 20);
    return ok("list_upcoming_deadlines", { entity: "deadline" }, { rangeDays, deadlines });
  },

  get_contract_summary: (args, context) => {
    const projectResult = resolveProject(args, context);
    if (projectResult.status !== "found") return failFromResolution("get_contract_summary", projectResult);
    const { project, details } = projectResult.item;
    if (!details) return failFromResolution("get_contract_summary", { status: "not_found", message: "Detail projektu neni nacteny." });
    const contracts = getProjectContracts(context, project.id);
    const winners = details.categories.flatMap((category) =>
      winnerBids(details, category.id).map((bid) => serializeBidWithContract(bid, category.id, contracts)),
    );
    return ok("get_contract_summary", { entity: "project", projectId: project.id }, {
      project: serializeProject(project, details),
      projectContract: details.contract || null,
      investorFinancials: details.investorFinancials || null,
      contracts: contracts.map(serializeContractSummary),
      contractedBids: winners.filter((bid) => bid.contracted),
      pendingWinnerBids: winners.filter((bid) => !bid.contracted),
    });
  },

  get_contract_detail: (args, context) => {
    const contractId = safeText(args.contractId);
    if (contractId) {
      const contract = allContracts(context).find((item) => item.id === contractId);
      if (!contract) {
        return { ok: false, tool: "get_contract_detail", code: "not_found", message: "Smlouva nebyla nalezena." };
      }
      return ok("get_contract_detail", { entity: "contract", projectId: contract.projectId, contractId }, {
        contract: serializeContractDetail(contract),
      });
    }

    const tenderName = safeText(args.tenderName ?? args.tender ?? args.categoryName);
    const bidId = safeText(args.bidId);
    if (tenderName || bidId || safeText(args.tenderId ?? args.categoryId)) {
      const tender = resolveTender(args, context);
      if (tender.status !== "found") return failFromResolution("get_contract_detail", tender);
      const contracts = getProjectContracts(context, tender.project.id);
      const bids = getCategoryBids(tender.details, tender.category.id);
      const bidMatches = bidId ? bids.filter((bid) => bid.id === bidId) : bids.filter((bid) => bid.status === "sod");
      const linkedContracts = bidMatches
        .map((bid) => ({ bid, contract: findLinkedContract(contracts, bid) }))
        .filter((item): item is { bid: Bid; contract: ContractWithDetails } => Boolean(item.contract));

      if (linkedContracts.length === 1) {
        const { bid, contract } = linkedContracts[0];
        return ok("get_contract_detail", { entity: "contract", projectId: tender.project.id, tenderId: tender.category.id, contractId: contract.id }, {
          project: serializeProject(tender.project, tender.details),
          tender: serializeTender(tender.project.id, tender.category),
          winningBid: serializeBid(bid, tender.category.id),
          contract: serializeContractDetail(contract),
        });
      }
      if (linkedContracts.length > 1) {
        return {
          ok: false,
          tool: "get_contract_detail",
          code: "ambiguous",
          message: "K VŘ je navázáno více smluv, upřesněte dodavatele nebo contractId.",
          candidates: linkedContracts.map(({ bid, contract }) => ({
            bid: serializeBid(bid, tender.category.id),
            contract: serializeContractSummary(contract),
          })),
        };
      }
      return {
        ok: false,
        tool: "get_contract_detail",
        code: "not_found",
        message: "K vítězné nabídce VŘ není načtená navázaná smlouva.",
      };
    }

    const projectResult = resolveProject(args, context);
    const companyQuery = safeText(args.companyName ?? args.vendorName ?? args.company ?? args.query);
    const contracts = projectResult.status === "found"
      ? getProjectContracts(context, projectResult.item.project.id)
      : allContracts(context);
    const needle = normalize(companyQuery);
    const matches = contracts.filter((contract) => {
      if (!needle) return true;
      return normalize([
        contract.vendorName,
        contract.vendorIco,
        contract.title,
        contract.contractNumber,
      ].filter(Boolean).join(" ")).includes(needle);
    });

    if (matches.length === 1) {
      return ok("get_contract_detail", { entity: "contract", projectId: matches[0].projectId, contractId: matches[0].id }, {
        contract: serializeContractDetail(matches[0]),
      });
    }
    if (matches.length > 1) {
      return {
        ok: false,
        tool: "get_contract_detail",
        code: "ambiguous",
        message: "Smlouva není jednoznačná, upřesněte firmu nebo contractId.",
        candidates: matches.slice(0, 8).map(serializeContractSummary),
      };
    }
    return { ok: false, tool: "get_contract_detail", code: "not_found", message: "Smlouva nebyla nalezena." };
  },

  draft_followup_email: (args, context) => {
    const projectResult = resolveProject(args, context);
    const contactResult = toolHandlers.get_contact_detail(args, context);
    if (projectResult.status !== "found" || !contactResult.ok) {
      return {
        ok: false,
        tool: "draft_followup_email",
        code: "missing_argument",
        message: "Pro navrh e-mailu chybi jednoznacny projekt nebo kontakt.",
      };
    }
    const title = projectName(projectResult.item.project, projectResult.item.details);
    const contact = (contactResult.data as { contact: ReturnType<typeof serializeContact> }).contact;
    const recipient = contact.primaryContact.name || "dobry den";
    const intent = safeText(args.intent) || "navazani komunikace";
    return ok("draft_followup_email", { entity: "draft", projectId: projectResult.item.project.id, contactId: contact.id }, {
      draftOnly: true,
      subject: `Navazani k projektu ${title}`,
      body: [
        `Dobry den${recipient !== "dobry den" ? `, ${recipient}` : ""},`,
        "",
        `navazuji ohledne projektu ${title}. Radi bychom s vami doresili: ${intent}.`,
        "",
        "Dejte mi prosim vedet, kdy se vam hodi kratke sladeni dalsich kroku.",
        "",
        "S pozdravem",
      ].join("\n"),
    });
  },
};

export const executeAssistantDataTool = (
  name: string,
  rawArgs: unknown,
  context: VoiceAssistantContextData,
): AssistantToolResult => {
  if (!ALLOWED_TOOLS.has(name)) {
    return {
      ok: false,
      tool: name,
      allowed: false,
      code: "tool_not_allowed",
      message: "Tool is not allowed in Tender Flow assistant read-only catalog.",
    };
  }

  const args = parseArgs(rawArgs);
  return toolHandlers[name as VoiceAssistantToolName](args, context);
};
