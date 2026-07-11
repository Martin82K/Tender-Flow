import { DEMO_CONTACTS, getDemoData } from "@/services/demoData";
import type { Subcontractor } from "@/types";

export const demoDataAdapter = {
  getContacts: (): Subcontractor[] => {
    const contacts = getDemoData()?.contacts;
    return Array.isArray(contacts) && contacts.length > 0
      ? (contacts as Subcontractor[])
      : DEMO_CONTACTS;
  },
};
