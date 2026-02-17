import type { Bid, BidStatus, DemandCategory } from "@/types";

export const DOC_HUB_FALLBACK_STATUSES: BidStatus[] = [
  "contacted",
  "sent",
  "offer",
  "shortlist",
  "sod",
];

export type FallbackCategory = Pick<DemandCategory, "id" | "title">;
export type FallbackSupplier = { id: string; name: string };

type CollectFallbackSuppliersParams = {
  categories: FallbackCategory[];
  bidsByCategory: Record<string, Bid[]>;
  categoryIds?: string[];
};

type CollectFallbackSuppliersResult = {
  categoriesForEnsure: FallbackCategory[];
  suppliersByCategory: Record<string, FallbackSupplier[]>;
};

const fallbackStatusesSet = new Set<BidStatus>(DOC_HUB_FALLBACK_STATUSES);

export const collectFallbackSuppliers = ({
  categories,
  bidsByCategory,
  categoryIds,
}: CollectFallbackSuppliersParams): CollectFallbackSuppliersResult => {
  const filteredCategoryIds = categoryIds ? new Set(categoryIds) : null;

  const categoriesForEnsure = categories.filter((category) =>
    filteredCategoryIds ? filteredCategoryIds.has(category.id) : true,
  );

  const suppliersByCategory: Record<string, FallbackSupplier[]> = {};

  for (const category of categoriesForEnsure) {
    const categoryBids = bidsByCategory[category.id] || [];
    const suppliersMap = new Map<string, FallbackSupplier>();

    for (const bid of categoryBids) {
      if (!fallbackStatusesSet.has(bid.status)) continue;

      const supplierId = bid.subcontractorId?.trim();
      const supplierName = bid.companyName?.trim();

      if (!supplierId || !supplierName) continue;
      if (suppliersMap.has(supplierId)) continue;

      suppliersMap.set(supplierId, { id: supplierId, name: supplierName });
    }

    if (suppliersMap.size > 0) {
      suppliersByCategory[category.id] = Array.from(suppliersMap.values());
    }
  }

  return {
    categoriesForEnsure,
    suppliersByCategory,
  };
};
