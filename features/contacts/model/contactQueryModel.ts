import type { ContactPerson, Subcontractor } from "@/types";

export interface SubcontractorRow {
  id: string;
  company_name: string;
  specialization?: string | string[] | null;
  contacts?: ContactPerson[] | null;
  contact_person_name?: string | null;
  phone?: string | null;
  email?: string | null;
  ico?: string | null;
  region?: string | null;
  address?: string | null;
  city?: string | null;
  web?: string | null;
  note?: string | null;
  regions?: string[] | null;
  status_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geocoded_at?: string | null;
  ares_checked_at?: string | null;
  ares_not_found?: boolean | null;
}

export interface VendorRatingRow {
  vendor_id: string | null;
  vendor_rating: string | number | null;
}

const createContactPersonId = (): string => globalThis.crypto.randomUUID();

export const mapSubcontractorRows = (
  rows: readonly SubcontractorRow[],
  createId: () => string = createContactPersonId,
): Subcontractor[] =>
  rows.map((row) => {
    const specialization = Array.isArray(row.specialization)
      ? row.specialization
      : row.specialization
        ? [row.specialization]
        : ["Ostatní"];
    const existingContacts = Array.isArray(row.contacts) ? row.contacts : [];
    const contacts =
      existingContacts.length === 0 &&
      (row.contact_person_name || row.phone || row.email)
        ? [
            {
              id: createId(),
              name: row.contact_person_name || "-",
              phone: row.phone || "-",
              email: row.email || "-",
              position: "Hlavní kontakt",
            },
          ]
        : existingContacts;

    return {
      id: row.id,
      company: row.company_name,
      specialization:
        specialization.length > 0 ? specialization : ["Ostatní"],
      contacts,
      ico: row.ico || "-",
      region: row.region || "-",
      address: row.address || "-",
      city: row.city || "-",
      web: row.web || "",
      note: row.note || "",
      regions: Array.isArray(row.regions) ? row.regions : [],
      status: row.status_id || "available",
      name: row.contact_person_name || "-",
      phone: row.phone || "-",
      email: row.email || "-",
      latitude: row.latitude ?? undefined,
      longitude: row.longitude ?? undefined,
      geocodedAt: row.geocoded_at ?? undefined,
      aresCheckedAt: row.ares_checked_at ?? undefined,
      aresNotFound: row.ares_not_found ?? false,
    };
  });

export const applyVendorRatings = (
  contacts: readonly Subcontractor[],
  ratingRows: readonly VendorRatingRow[],
): Subcontractor[] => {
  const ratingStats = new Map<string, { sum: number; count: number }>();

  ratingRows.forEach((row) => {
    if (!row.vendor_id || row.vendor_rating == null) return;
    const rating = Number.parseFloat(String(row.vendor_rating));
    if (!Number.isFinite(rating)) return;

    const current = ratingStats.get(row.vendor_id) ?? { sum: 0, count: 0 };
    ratingStats.set(row.vendor_id, {
      sum: current.sum + rating,
      count: current.count + 1,
    });
  });

  return contacts.map((contact) => {
    const stats = ratingStats.get(contact.id);
    if (!stats || stats.count === 0) return contact;
    return {
      ...contact,
      vendorRatingAverage: stats.sum / stats.count,
      vendorRatingCount: stats.count,
    };
  });
};
