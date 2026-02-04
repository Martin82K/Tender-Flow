import type { Bid, DemandCategory, DemandDocument, Project, ProjectDetails } from "../types";

export interface SupplierCategoryRef {
  projectId: string;
  projectName: string;
  categoryId: string;
  categoryTitle: string;
  documents: DemandDocument[];
}

export interface SupplierStats {
  id: string;
  subcontractorId?: string;
  name: string;
  offerCount: number;
  sodCount: number;
  successRate: number;
  totalAwardedValue: number;
  lastAwardedAt?: string;
  lastAwardedLabel?: string;
  categories: SupplierCategoryRef[];
}

export interface CategoryProfit {
  id: string;
  projectId: string;
  projectName: string;
  label: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  offerCount: number;
}

export interface YearTrend {
  year: number;
  awardedValue: number;
  sodCount: number;
  offerCount: number;
  categoryCount: number;
}

export interface OverviewAnalytics {
  suppliers: SupplierStats[];
  categoryProfit: CategoryProfit[];
  yearTrends: YearTrend[];
  totals: {
    offerCount: number;
    sodCount: number;
    awardedValue: number;
    categoryCount: number;
    projectCount: number;
  };
  totalsByStatus: Record<Project["status"], {
    offerCount: number;
    sodCount: number;
    awardedValue: number;
    categoryCount: number;
    projectCount: number;
  }>;
}

const OFFER_STATUSES = new Set<Bid["status"]>([
  "offer",
  "shortlist",
  "sod",
  "rejected",
]);

const isOfferStatus = (status: Bid["status"]) => OFFER_STATUSES.has(status);

export const parseMoneyValue = (value?: string): number => {
  if (!value) return 0;
  const trimmed = value.toString().trim();
  if (!trimmed || trimmed === "-" || trimmed === "?") return 0;

  const hasM = /m/i.test(trimmed);
  const hasK = /k/i.test(trimmed) && !/kč/i.test(trimmed.toLowerCase());
  const clean = trimmed.replace(/\s/g, "").replace(/[^0-9,.-]/g, "").replace(",", ".");
  const parsed = Number.parseFloat(clean);
  if (!Number.isFinite(parsed)) return 0;

  if (hasM) return parsed * 1_000_000;
  if (hasK) return parsed * 1_000;
  return parsed;
};

export const formatMoney = (value: number): string => {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(value);
};

const normalizeSupplierKey = (bid: Bid): { id: string; subcontractorId?: string; name: string } => {
  const name = bid.companyName || "Neznámý dodavatel";
  if (bid.subcontractorId) {
    return { id: bid.subcontractorId, subcontractorId: bid.subcontractorId, name };
  }
  return { id: name.toLowerCase(), name };
};

const resolveBidDate = (bid: Bid, category: DemandCategory, project: ProjectDetails): string | undefined => {
  return (
    bid.updateDate ||
    category.deadline ||
    category.realizationEnd ||
    category.realizationStart ||
    project.finishDate ||
    undefined
  );
};

const extractYear = (value?: string): number | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getFullYear();
};

const addSupplierCategory = (
  supplier: SupplierStats,
  category: DemandCategory,
  projectName: string,
  projectId: string,
) => {
  const existing = supplier.categories.find((item) => item.categoryId === category.id);
  if (existing) return;
  supplier.categories.push({
    projectId,
    projectName,
    categoryId: category.id,
    categoryTitle: category.title,
    documents: Array.isArray(category.documents) ? category.documents : [],
  });
};

export const buildOverviewAnalytics = (
  projects: Project[],
  projectDetails: Record<string, ProjectDetails | undefined>,
  statusFilter: Project["status"] | "all" = "all",
): OverviewAnalytics => {
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));
  const projectStatusById = new Map(projects.map((project) => [project.id, project.status]));
  const suppliersMap = new Map<string, SupplierStats>();
  const categoryProfit: CategoryProfit[] = [];
  const yearMap = new Map<number, YearTrend>();
  const yearCategoryMap = new Map<number, Set<string>>();
  const totalsByStatus: OverviewAnalytics["totalsByStatus"] = {
    tender: { offerCount: 0, sodCount: 0, awardedValue: 0, categoryCount: 0, projectCount: 0 },
    realization: { offerCount: 0, sodCount: 0, awardedValue: 0, categoryCount: 0, projectCount: 0 },
    archived: { offerCount: 0, sodCount: 0, awardedValue: 0, categoryCount: 0, projectCount: 0 },
  };

  let totalOffers = 0;
  let totalSod = 0;
  let totalAwardedValue = 0;
  let totalCategories = 0;

  Object.entries(projectDetails).forEach(([projectId, details]) => {
    if (!details) return;
    const projectStatus = projectStatusById.get(projectId) || "tender";
    if (statusFilter !== "all" && projectStatus !== statusFilter) return;
    const projectName = details.title || projectNameById.get(projectId) || "Projekt";
    const categories = details.categories || [];

    categories.forEach((category) => {
      totalCategories += 1;
      totalsByStatus[projectStatus].categoryCount += 1;
      const bids = details.bids?.[category.id] || [];
      const sodBids = bids.filter((bid) => bid.status === "sod");
      const offerBids = bids.filter((bid) => isOfferStatus(bid.status));

      if (offerBids.length > 0) {
        totalOffers += offerBids.length;
        totalsByStatus[projectStatus].offerCount += offerBids.length;
      }
      if (sodBids.length > 0) {
        totalSod += sodBids.length;
        totalsByStatus[projectStatus].sodCount += sodBids.length;
      }

      const revenue = category.sodBudget || parseMoneyValue(category.budget);
      const cost = sodBids.reduce((sum, bid) => sum + parseMoneyValue(bid.price), 0);
      totalsByStatus[projectStatus].awardedValue += cost;
      if (revenue > 0 || cost > 0) {
        const profit = revenue - cost;
        categoryProfit.push({
          id: category.id,
          projectId,
          projectName,
          label: category.title,
          revenue,
          cost,
          profit,
          margin: revenue > 0 ? (profit / revenue) * 100 : 0,
          offerCount: offerBids.length,
        });
      }

      bids.forEach((bid) => {
        if (!isOfferStatus(bid.status)) return;
        const supplierKey = normalizeSupplierKey(bid);
        const existing = suppliersMap.get(supplierKey.id);
        const supplier: SupplierStats =
          existing ||
          {
            id: supplierKey.id,
            subcontractorId: supplierKey.subcontractorId,
            name: supplierKey.name,
            offerCount: 0,
            sodCount: 0,
            successRate: 0,
            totalAwardedValue: 0,
            categories: [],
          };

        supplier.offerCount += 1;
        addSupplierCategory(supplier, category, projectName, projectId);

        if (bid.status === "sod") {
          supplier.sodCount += 1;
          const awardedValue = parseMoneyValue(bid.price);
          supplier.totalAwardedValue += awardedValue;
          totalAwardedValue += awardedValue;

          const bidDate = resolveBidDate(bid, category, details);
          if (bidDate) {
            if (!supplier.lastAwardedAt || new Date(bidDate) > new Date(supplier.lastAwardedAt)) {
              supplier.lastAwardedAt = bidDate;
              supplier.lastAwardedLabel = `${projectName} / ${category.title}`;
            }
          }
        }

        suppliersMap.set(supplierKey.id, supplier);

        const year = extractYear(resolveBidDate(bid, category, details));
        if (year) {
          const trend = yearMap.get(year) || {
            year,
            awardedValue: 0,
            sodCount: 0,
            offerCount: 0,
            categoryCount: 0,
          };
          const yearCategories = yearCategoryMap.get(year) || new Set<string>();
          yearCategories.add(category.id);
          yearCategoryMap.set(year, yearCategories);
          trend.offerCount += 1;
          if (bid.status === "sod") {
            trend.sodCount += 1;
            trend.awardedValue += parseMoneyValue(bid.price);
          }
          yearMap.set(year, trend);
        }
      });
    });
  });

  const suppliers = Array.from(suppliersMap.values()).map((supplier) => ({
    ...supplier,
    successRate: supplier.offerCount > 0 ? supplier.sodCount / supplier.offerCount : 0,
  }));

  categoryProfit.sort((a, b) => b.profit - a.profit);
  const yearTrends = Array.from(yearMap.values())
    .map((trend) => ({
      ...trend,
      categoryCount: yearCategoryMap.get(trend.year)?.size || 0,
    }))
    .sort((a, b) => a.year - b.year);

  return {
    suppliers,
    categoryProfit,
    yearTrends,
    totals: {
      offerCount: totalOffers,
      sodCount: totalSod,
      awardedValue: totalAwardedValue,
      categoryCount: totalCategories,
      projectCount: projects.length,
    },
    totalsByStatus: {
      tender: {
        ...totalsByStatus.tender,
        projectCount: projects.filter((p) => p.status === "tender").length,
      },
      realization: {
        ...totalsByStatus.realization,
        projectCount: projects.filter((p) => p.status === "realization").length,
      },
      archived: {
        ...totalsByStatus.archived,
        projectCount: projects.filter((p) => p.status === "archived").length,
      },
    },
  };
};
