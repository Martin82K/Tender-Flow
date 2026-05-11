import type { Bid, DemandCategory, DemandDocument, ProjectDetails } from "@/types";
import { parseDecimal } from "@/utils/formatters";

export type PipelineInquiryGenerationKind = "inquiry" | "materialInquiry";

export interface PipelineCategoryFormInput {
  title: string;
  sodBudget: string;
  planBudget: string;
  description: string;
  deadline?: string;
  realizationStart?: string;
  realizationEnd?: string;
}

const formatLegacyBudget = (value: number): string => {
  return `~${new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} Kč`;
};

const parseBudget = (value: string): number => parseDecimal(value) ?? 0;

export const calculateInternalPlanFromSodDiscount = (
  sodBudget: number,
  discountPercent: number,
): number => {
  if (!Number.isFinite(sodBudget) || !Number.isFinite(discountPercent)) return 0;
  const clampedPercent = Math.min(100, Math.max(0, discountPercent));
  return Math.max(0, sodBudget * (1 - clampedPercent / 100));
};

const parsePlanBudget = (sodBudget: number, value: string): number => {
  if (value.includes("%")) {
    const discountPercent = parseDecimal(value);
    return discountPercent === null
      ? 0
      : calculateInternalPlanFromSodDiscount(sodBudget, discountPercent);
  }
  return parseBudget(value);
};

export const getTemplateLinksForInquiryKindModel = (
  project: ProjectDetails,
  kind: PipelineInquiryGenerationKind,
): string[] => {
  const candidates =
    kind === "materialInquiry"
      ? [project.materialInquiryTemplateLink, project.inquiryLetterLink]
      : [project.inquiryLetterLink];

  return candidates.filter(
    (link): link is string => !!link && link.startsWith("template:"),
  );
};

export const sanitizeFolderSegment = (value: string): string => {
  return value.replace(/[<>:"|?*]/g, "").trim();
};

export const getSafeFallbackProjectId = (
  routeProjectId: string | undefined,
  detailsProjectId: string | undefined,
): string | null => {
  const routeId = routeProjectId?.trim();
  const detailsId = detailsProjectId?.trim();
  if (!routeId || !detailsId) return null;
  if (routeId !== detailsId) return null;
  return routeId;
};

export const hasComparableOfferSignal = (bid: Bid): boolean => {
  const hasPrice = !!(bid.price || "").trim() && bid.price !== "?" && bid.price !== "-";
  const hasPriceHistory = !!(bid.priceHistory && Object.keys(bid.priceHistory).length > 0);
  const hasOfferStatus =
    bid.status === "offer" || bid.status === "shortlist" || bid.status === "sod";

  return hasPrice || hasPriceHistory || hasOfferStatus;
};

export const buildBidComparisonSuppliers = (categoryBids: Bid[]): string[] => {
  const relevantSupplierNames = categoryBids
    .filter(hasComparableOfferSignal)
    .map((bid) => bid.companyName?.trim() || "")
    .filter(Boolean);

  const fallbackSupplierNames = categoryBids
    .map((bid) => bid.companyName?.trim() || "")
    .filter(Boolean);

  return Array.from(
    new Set(
      relevantSupplierNames.length > 0
        ? relevantSupplierNames
        : fallbackSupplierNames,
    ),
  ).sort((a, b) => a.localeCompare(b, "cs"));
};

export const htmlToPlainText = (html: string): string => {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/ul>/gi, "\n")
    .replace(/<\/ol>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export const buildNewDemandCategory = (
  formData: PipelineCategoryFormInput,
  categoryId: string,
  uploadedDocuments: DemandDocument[],
): DemandCategory => {
  const sod = parseBudget(formData.sodBudget);

  return {
    id: categoryId,
    title: formData.title,
    budget: formatLegacyBudget(sod),
    sodBudget: sod,
    planBudget: parsePlanBudget(sod, formData.planBudget),
    description: formData.description,
    status: "open",
    subcontractorCount: 0,
    documents: uploadedDocuments.length > 0 ? uploadedDocuments : undefined,
    deadline: formData.deadline || undefined,
    realizationStart: formData.realizationStart || undefined,
    realizationEnd: formData.realizationEnd || undefined,
  };
};

export const buildUpdatedDemandCategory = (
  currentCategory: DemandCategory,
  formData: PipelineCategoryFormInput,
  uploadedDocuments: DemandDocument[],
): DemandCategory => {
  const sod = parseBudget(formData.sodBudget);

  return {
    ...currentCategory,
    title: formData.title,
    budget: formatLegacyBudget(sod),
    sodBudget: sod,
    planBudget: parsePlanBudget(sod, formData.planBudget),
    description: formData.description,
    documents: uploadedDocuments.length > 0 ? uploadedDocuments : undefined,
    deadline: formData.deadline || undefined,
    realizationStart: formData.realizationStart || undefined,
    realizationEnd: formData.realizationEnd || undefined,
  };
};
