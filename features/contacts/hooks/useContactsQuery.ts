import { useQuery } from "@tanstack/react-query";

import {
  applyVendorRatings,
  mapSubcontractorRows,
  type SubcontractorRow,
  type VendorRatingRow,
} from "@features/contacts/model/contactQueryModel";
import { dbAdapter } from "@infra/db/dbAdapter";
import { demoDataAdapter } from "@infra/demo/demoDataAdapter";
import { withRetry, withTimeout } from "@shared/async/asyncControl";

const CONTACT_PAGE_SIZE = 1000;
const CONTACT_QUERY_TIMEOUT_MS = 15_000;
const CONTACT_SELECT =
  "id, company_name, specialization, contacts, contact_person_name, phone, email, ico, region, address, city, web, note, regions, status_id, latitude, longitude, geocoded_at, ares_checked_at, ares_not_found";

interface QueryResponse<T> {
  data: T;
  error: unknown;
}

interface UseContactsQueryInput {
  userId?: string | null;
  userRole?: string | null;
}

export const CONTACT_KEYS = {
  all: ["contacts"] as const,
  list: () => [...CONTACT_KEYS.all, "list"] as const,
};

const fetchAllContactRows = async (): Promise<SubcontractorRow[]> => {
  const rows: SubcontractorRow[] = [];
  let offset = 0;

  while (true) {
    const response = await withRetry<QueryResponse<SubcontractorRow[] | null>>(
      () =>
        withTimeout(
          Promise.resolve(
            dbAdapter
              .from("subcontractors")
              .select(CONTACT_SELECT)
              .order("company_name")
              .range(offset, offset + CONTACT_PAGE_SIZE - 1),
          ),
          CONTACT_QUERY_TIMEOUT_MS,
          "Načtení dodavatelů vypršelo",
        ),
      { retries: 1 },
    );

    if (response.error) throw response.error;
    const page = response.data || [];
    rows.push(...page);
    if (page.length < CONTACT_PAGE_SIZE) return rows;
    offset += CONTACT_PAGE_SIZE;
  }
};

const fetchVendorRatingRows = (): Promise<
  QueryResponse<VendorRatingRow[] | null>
> =>
  withRetry(
    () =>
      withTimeout(
        Promise.resolve(
          dbAdapter
            .from("contracts")
            .select("vendor_id, vendor_rating")
            .not("vendor_rating", "is", null)
            .not("vendor_id", "is", null),
        ),
        CONTACT_QUERY_TIMEOUT_MS,
        "Načtení hodnocení dodavatelů vypršelo",
      ),
    { retries: 1 },
  );

export const useContactsQuery = ({
  userId,
  userRole,
}: UseContactsQueryInput) =>
  useQuery({
    queryKey: [...CONTACT_KEYS.list(), userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (userRole === "demo") return demoDataAdapter.getContacts();

      const [contactRows, ratingsResponse] = await Promise.all([
        fetchAllContactRows(),
        fetchVendorRatingRows(),
      ]);
      const contacts = mapSubcontractorRows(contactRows);

      return ratingsResponse.error
        ? contacts
        : applyVendorRatings(contacts, ratingsResponse.data || []);
    },
    staleTime: 5 * 60 * 1000,
  });
