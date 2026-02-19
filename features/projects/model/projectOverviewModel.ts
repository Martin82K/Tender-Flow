import type { Subcontractor } from "@/types";
import type { OverviewAnalytics } from "@/utils/overviewAnalytics";

export type OverviewSupplier = OverviewAnalytics["suppliers"][number];

export type SupplierRow = OverviewSupplier & {
  rating?: number;
  ratingCount: number;
  contact: Subcontractor | null;
};

const resolveContact = (
  supplier: OverviewSupplier,
  contacts: Subcontractor[],
): Subcontractor | null => {
  if (!contacts.length) return null;
  if (supplier.subcontractorId) {
    const byId = contacts.find((c) => c.id === supplier.subcontractorId);
    if (byId) return byId;
  }

  const normalized = supplier.name.toLowerCase();
  return contacts.find((c) => c.company?.toLowerCase() === normalized) || null;
};

export const buildSupplierRows = (
  suppliers: OverviewSupplier[],
  contacts: Subcontractor[],
): SupplierRow[] => {
  const sorted = [...suppliers].sort((a, b) => {
    if (b.sodCount !== a.sodCount) return b.sodCount - a.sodCount;
    return b.offerCount - a.offerCount;
  });

  return sorted.map((supplier) => {
    const contact = resolveContact(supplier, contacts);
    return {
      ...supplier,
      rating: contact?.vendorRatingAverage,
      ratingCount: contact?.vendorRatingCount || 0,
      contact,
    };
  });
};

export const findExactSelectedSupplier = (
  filteredSuppliers: SupplierRow[],
  supplierQuery: string,
): SupplierRow | null => {
  const normalizedQuery = supplierQuery.trim().toLowerCase();
  if (!normalizedQuery) return null;

  const exactMatches = filteredSuppliers.filter(
    (supplier) => supplier.name.toLowerCase() === normalizedQuery,
  );

  if (exactMatches.length !== 1) return null;
  return exactMatches[0];
};

export const sortSupplierOffersByDate = (supplier: SupplierRow | null) => {
  if (!supplier) return [];

  return [...supplier.offers].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
};

export const buildSelectedSupplierSummary = (supplier: SupplierRow | null) => {
  if (!supplier) {
    return {
      totalAwardedValue: 0,
      totalSodRealizationValue: 0,
      offerCount: 0,
      shortlistCount: 0,
      sodCount: 0,
      rejectedCount: 0,
      successRate: 0,
      avgDiffSodPercent: null as number | null,
      avgDiffPlanPercent: null as number | null,
    };
  }

  let totalAwardedValue = 0;
  let totalSodRealizationValue = 0;
  let offerCount = 0;
  let shortlistCount = 0;
  let sodCount = 0;
  let rejectedCount = 0;
  const sodDiffs: number[] = [];
  const planDiffs: number[] = [];

  supplier.offers.forEach((offer) => {
    totalAwardedValue += offer.priceValue;
    offerCount += 1;

    if (offer.status === "shortlist") shortlistCount += 1;
    if (offer.status === "sod") {
      sodCount += 1;
      if (offer.projectStatus === "realization") {
        totalSodRealizationValue += offer.priceValue;
      }
    }
    if (offer.status === "rejected") rejectedCount += 1;

    if (offer.sodBudget && offer.sodBudget > 0) {
      sodDiffs.push(((offer.priceValue - offer.sodBudget) / offer.sodBudget) * 100);
    }
    if (offer.planBudget && offer.planBudget > 0) {
      planDiffs.push(((offer.priceValue - offer.planBudget) / offer.planBudget) * 100);
    }
  });

  const avgDiffSodPercent =
    sodDiffs.length > 0
      ? sodDiffs.reduce((sum, value) => sum + value, 0) / sodDiffs.length
      : null;
  const avgDiffPlanPercent =
    planDiffs.length > 0
      ? planDiffs.reduce((sum, value) => sum + value, 0) / planDiffs.length
      : null;

  return {
    totalAwardedValue,
    totalSodRealizationValue,
    offerCount,
    shortlistCount,
    sodCount,
    rejectedCount,
    successRate: offerCount > 0 ? (sodCount / offerCount) * 100 : 0,
    avgDiffSodPercent,
    avgDiffPlanPercent,
  };
};

export const buildSelectedSupplierMonthlySeries = (supplier: SupplierRow | null) => {
  if (!supplier) return { data: [], years: [] as number[] };

  const yearMap = new Map<number, number[]>();

  supplier.offers.forEach((offer) => {
    if (!offer.date) return;
    const parsed = new Date(offer.date);
    if (Number.isNaN(parsed.getTime())) return;

    const year = parsed.getFullYear();
    const monthIndex = parsed.getMonth();
    const values = yearMap.get(year) || Array.from({ length: 12 }, () => 0);
    values[monthIndex] += offer.priceValue;
    yearMap.set(year, values);
  });

  const years = Array.from(yearMap.keys()).sort((a, b) => a - b);
  const data = Array.from({ length: 12 }, (_, index) => {
    const row: Record<string, number | string> = { month: (index + 1).toString() };
    years.forEach((year) => {
      row[year.toString()] = yearMap.get(year)?.[index] || 0;
    });
    return row;
  });

  return { data, years };
};

export const buildStatusCounts = (suppliers: OverviewSupplier[]) => {
  const counts = {
    sod: 0,
    shortlist: 0,
    offer: 0,
    rejected: 0,
    contacted: 0,
    sent: 0,
  };

  suppliers.forEach((supplier) => {
    supplier.offers.forEach((offer) => {
      if (offer.status === "sod") counts.sod++;
      else if (offer.status === "shortlist") counts.shortlist++;
      else if (offer.status === "offer") counts.offer++;
      else if (offer.status === "rejected") counts.rejected++;
      else if (offer.status === "contacted") counts.contacted++;
      else if (offer.status === "sent") counts.sent++;
    });
  });

  return counts;
};

export const buildAverageBudgetDeviation = (suppliers: OverviewSupplier[]) => {
  const deviations: number[] = [];

  suppliers.forEach((supplier) => {
    supplier.offers.forEach((offer) => {
      if (offer.sodBudget && offer.sodBudget > 0 && offer.priceValue > 0) {
        const deviation = ((offer.priceValue - offer.sodBudget) / offer.sodBudget) * 100;
        deviations.push(deviation);
      }
    });
  });

  if (deviations.length === 0) return null;
  return deviations.reduce((sum, value) => sum + value, 0) / deviations.length;
};

export const formatOfferDate = (value?: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("cs-CZ");
};
