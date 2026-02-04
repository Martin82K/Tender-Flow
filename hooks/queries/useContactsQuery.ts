import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../services/supabase";
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

            const subcontractorsRes = await withRetry(
                () =>
                    withTimeout(
                        Promise.resolve(supabase.from("subcontractors").select("*").order("company_name")),
                        15000,
                        "Načtení dodavatelů vypršelo"
                    ),
                { retries: 1 }
            );

            if (subcontractorsRes.error) throw subcontractorsRes.error;

            const subcontractorsData = (subcontractorsRes.data || []) as any[];
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
                    status: s.status_id || "available",
                    name: s.contact_person_name || "-",
                    phone: s.phone || "-",
                    email: s.email || "-",
                };
            });

            const vendorIds = loadedContacts.map((c) => c.id).filter(Boolean);
            if (vendorIds.length > 0) {
                const normalizeCompanyName = (name: string) =>
                    name
                        .toLowerCase()
                        .replace(/\s+/g, " ")
                        .replace(/[,\.]/g, "")
                        .replace(/\b(spol\s*s\s*r\s*o|spol\s*s\.r\.o|s\s*r\s*o|s\.r\.o|sro|a\.s\.|as|v\.o\.s\.|vos)\b/g, "")
                        .trim();
                const nameToId = new Map<string, string>();
                loadedContacts.forEach((contact) => {
                    if (!contact.company) return;
                    const key = normalizeCompanyName(contact.company);
                    if (!key || nameToId.has(key)) return;
                    nameToId.set(key, contact.id);
                });

                const ratingStats = new Map<string, { sum: number; count: number }>();
                const seenContractIds = new Set<string>();
                const chunkSize = 200;

                const handleRatings = (rows: any[]) => {
                    rows.forEach((row: any) => {
                        if (!row || !row.id || seenContractIds.has(row.id)) return;
                        seenContractIds.add(row.id);
                        const targetId = row.vendor_id || (row.vendor_name ? nameToId.get(normalizeCompanyName(row.vendor_name)) : undefined);
                        if (!targetId || row.vendor_rating === null || row.vendor_rating === undefined) return;
                        const current = ratingStats.get(targetId) || { sum: 0, count: 0 };
                        const ratingValue = Number.parseFloat(row.vendor_rating);
                        if (!Number.isFinite(ratingValue)) return;
                        ratingStats.set(targetId, {
                            sum: current.sum + ratingValue,
                            count: current.count + 1,
                        });
                    });
                };

                const projectsRes = await withRetry(
                    () =>
                        withTimeout(
                            Promise.resolve(supabase.from("projects").select("id")),
                            15000,
                            "Načtení projektů vypršelo"
                        ),
                    { retries: 1 }
                );

                if (!projectsRes.error) {
                    const projectIds = (projectsRes.data || []).map((p: any) => p.id).filter(Boolean);
                    for (let i = 0; i < projectIds.length; i += chunkSize) {
                        const chunk = projectIds.slice(i, i + chunkSize);
                        const contractsRes = await withRetry(
                            () =>
                                withTimeout(
                                    Promise.resolve(
                                        supabase
                                            .from("contracts")
                                            .select("id, vendor_id, vendor_name, vendor_rating")
                                            .in("project_id", chunk)
                                            .not("vendor_rating", "is", null)
                                    ),
                                    15000,
                                    "Načtení hodnocení dodavatelů vypršelo"
                                ),
                            { retries: 1 }
                        );

                        if (contractsRes.error) {
                            console.warn("Nepodařilo se načíst hodnocení dodavatelů (projects):", contractsRes.error);
                            continue;
                        }

                        handleRatings(contractsRes.data || []);
                    }
                } else {
                    console.warn("Nepodařilo se načíst projekty pro hodnocení:", projectsRes.error);
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
