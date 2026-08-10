import { describe, expect, it } from "vitest";

import {
  toSubcontractorPersistencePayload,
  toSubcontractorUpdatePayload,
} from "@features/contacts/model/contactPersistence";
import type { Subcontractor } from "@/types";

const contact: Subcontractor = {
  id: "contact-1",
  company: "Bezpečná firma",
  specialization: ["Elektro"],
  contacts: [
    {
      id: "person-1",
      name: "Hlavní osoba",
      email: "primary@example.test",
      phone: "+420000000000",
      position: "Vedoucí",
    },
  ],
  ico: "12345678",
  region: "Praha",
  address: "Testovací 1",
  city: "Praha",
  web: "https://example.test",
  note: "Interní poznámka",
  regions: ["PHA"],
  status: "available",
};

describe("contact persistence mapping", () => {
  it("ukládá celý kontakt a odvozuje legacy hlavní osobu z prvního JSON kontaktu", () => {
    expect(toSubcontractorPersistencePayload(contact, "org-1")).toEqual(
      expect.objectContaining({
        organization_id: "org-1",
        company_name: "Bezpečná firma",
        contacts: contact.contacts,
        contact_person_name: "Hlavní osoba",
        email: "primary@example.test",
        phone: "+420000000000",
        address: "Testovací 1",
        city: "Praha",
        web: "https://example.test",
        note: "Interní poznámka",
        regions: ["PHA"],
      }),
    );
  });

  it("při změně pořadí osob atomicky aktualizuje JSON i legacy hlavní kontakt", () => {
    const nextPrimary = {
      id: "person-2",
      name: "Nová hlavní osoba",
      email: "new-primary@example.test",
      phone: "+420111111111",
      position: "Jednatel",
    };

    expect(toSubcontractorUpdatePayload({ contacts: [nextPrimary] })).toEqual({
      contacts: [nextPrimary],
      contact_person_name: "Nová hlavní osoba",
      email: "new-primary@example.test",
      phone: "+420111111111",
    });
  });

  it("vyprázdnění seznamu osob vymaže i legacy hlavní kontakt", () => {
    expect(toSubcontractorUpdatePayload({ contacts: [] })).toEqual({
      contacts: [],
      contact_person_name: null,
      email: null,
      phone: null,
    });
  });
});
