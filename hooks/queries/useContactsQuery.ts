import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../services/supabase";
import { withRetry, withTimeout } from "../../utils/helpers";
import { Subcontractor } from "../../types";

export const CONTACT_KEYS = {
    all: ["contacts"] as const,
    list: () => [...CONTACT_KEYS.all, "list"] as const,
};

export const useContactsQuery = () => {
    return useQuery({
        queryKey: CONTACT_KEYS.list(),
        queryFn: async () => {
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

            return loadedContacts;
        },
        staleTime: 5 * 60 * 1000,
    });
};
