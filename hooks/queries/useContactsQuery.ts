import { useQuery } from "@tanstack/react-query";
import { dbAdapter } from "../../services/dbAdapter";
import { withRetry, withTimeout } from "../../utils/helpers";
import { Subcontractor } from "../../types";
import { useAuth } from "../../context/AuthContext";

import { getDemoData, DEMO_CONTACTS } from "../../services/demoData";

export const CONTACT_KEYS = {
    all: ["contacts"] as const,
    list: () => [...CONTACT_KEYS.all, "list"] as const,
};

export const useContactsQuery = () => {
    const { user } = useAuth();
    return useQuery({
        queryKey: [...CONTACT_KEYS.list(), user?.id],
        enabled: !!user,
        queryFn: async () => {
            if (user?.role === "demo") {
                const demoData = getDemoData();
                return (demoData && demoData.contacts && demoData.contacts.length > 0)
                    ? demoData.contacts
                    : DEMO_CONTACTS;
            }

            // Supabase PostgREST has a server-side max_rows limit (default 1000).
            // Paginate to fetch all contacts regardless of server config.
            const PAGE_SIZE = 1000;
            const subcontractorsData: any[] = [];
            let offset = 0;
            let hasMore = true;

            while (hasMore) {
                const pageRes = await withRetry(
                    () =>
                        withTimeout(
                            Promise.resolve(
                                dbAdapter
                                    .from("subcontractors")
                                    .select("id, company_name, specialization, contacts, contact_person_name, phone, email, ico, region, address, city, web, note, regions, status_id, latitude, longitude, geocoded_at, ares_checked_at, ares_not_found")
                                    .order("company_name")
                                    .range(offset, offset + PAGE_SIZE - 1)
                            ),
                            15000,
                            "Načtení dodavatelů vypršelo"
                        ),
                    { retries: 1 }
                );

                if (pageRes.error) throw pageRes.error;

                const pageData = (pageRes.data || []) as any[];
                subcontractorsData.push(...pageData);

                if (pageData.length < PAGE_SIZE) {
                    hasMore = false;
                } else {
                    offset += PAGE_SIZE;
                }
            }
            const loadedContacts: Subcontractor[] = subcontractorsData.map((s) => {
                const specArray = Array.isArray(s.specialization)
                    ? s.specialization
                    : s.specialization
                        ? [s.specialization]
                        : ["Ostatní"];

                let contactsArray: any[] = Array.isArray(s.contacts) ? s.contacts : [];
                if (contactsArray.length === 0 && (s.contact_person_name || s.phone || s.email)) {
                    contactsArray = [
                        {
                            id: (window.crypto || (window as any).msCrypto).randomUUID(),
                            name: s.contact_person_name || "-",
                            phone: s.phone || "-",
                            email: s.email || "-",
                            position: "Hlavní kontakt",
                        },
                    ];
                }

                return {
                    id: s.id,
                    company: s.company_name,
                    specialization: specArray.length > 0 ? specArray : ["Ostatní"],
                    contacts: contactsArray,
                    ico: s.ico || "-",
                    region: s.region || "-",
                    address: s.address || "-",
                    city: s.city || "-",
                    web: s.web || "",
                    note: s.note || "",
                    regions: Array.isArray(s.regions) ? s.regions : [],
                    status: s.status_id || "available",
                    name: s.contact_person_name || "-",
                    phone: s.phone || "-",
                    email: s.email || "-",
                    latitude: s.latitude ?? undefined,
                    longitude: s.longitude ?? undefined,
                    geocodedAt: s.geocoded_at ?? undefined,
                    aresCheckedAt: s.ares_checked_at ?? undefined,
                    aresNotFound: s.ares_not_found ?? false,
                };
            });

            // Fetch all vendor ratings in a single query (no N+1)
            const ratingsRes = await withRetry(
                () =>
                    withTimeout(
                        Promise.resolve(
                            dbAdapter
                                .from("contracts")
                                .select("vendor_id, vendor_rating")
                                .not("vendor_rating", "is", null)
                                .not("vendor_id", "is", null)
                        ),
                        15000,
                        "Načtení hodnocení dodavatelů vypršelo"
                    ),
                { retries: 1 }
            );

            if (!ratingsRes.error && ratingsRes.data) {
                const ratingStats = new Map<string, { sum: number; count: number }>();
                for (const row of ratingsRes.data) {
                    if (!row.vendor_id || row.vendor_rating == null) continue;
                    const ratingValue = Number.parseFloat(row.vendor_rating);
                    if (!Number.isFinite(ratingValue)) continue;
                    const current = ratingStats.get(row.vendor_id) || { sum: 0, count: 0 };
                    ratingStats.set(row.vendor_id, {
                        sum: current.sum + ratingValue,
                        count: current.count + 1,
                    });
                }

                loadedContacts.forEach((contact) => {
                    const stats = ratingStats.get(contact.id);
                    if (!stats || stats.count === 0) return;
                    contact.vendorRatingAverage = stats.sum / stats.count;
                    contact.vendorRatingCount = stats.count;
                });
            }

            return loadedContacts;
        },
        staleTime: 5 * 60 * 1000,
    });
};
