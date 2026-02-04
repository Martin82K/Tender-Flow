import type { Subcontractor } from "../types";
import type { OverviewAnalytics } from "./overviewAnalytics";

export type SupplierFilterOptions = {
  query: string;
  specialization: string;
};

export type SupplierRow = OverviewAnalytics["suppliers"][number] & {
  rating?: number;
  ratingCount?: number;
  contact?: Subcontractor | null;
};

const normalize = (value: string) => value.toLowerCase().trim();

export const filterSuppliers = (
  suppliers: SupplierRow[],
  { query, specialization }: SupplierFilterOptions,
): SupplierRow[] => {
  const normalizedQuery = normalize(query);
  const normalizedSpec = normalize(specialization);

  return suppliers.filter((supplier) => {
    const matchesQuery = normalizedQuery
      ? supplier.name.toLowerCase().includes(normalizedQuery)
      : true;

    const matchesSpec = normalizedSpec
      ? (supplier.contact?.specialization || [])
          .map((item) => item.toLowerCase())
          .some((item) => item.includes(normalizedSpec))
      : true;

    return matchesQuery && matchesSpec;
  });
};
