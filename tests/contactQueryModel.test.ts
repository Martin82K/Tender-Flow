import { describe, expect, it } from "vitest";

import {
  applyVendorRatings,
  mapSubcontractorRows,
} from "@features/contacts/model/contactQueryModel";
import {
  EMPTY_FILTER_STATE,
  filterContacts,
} from "@/shared/ui/contacts/contactsFiltersLogic";

describe("contact query model", () => {
  it("maps scalar specialization and synthesizes the legacy primary contact", () => {
    const contacts = mapSubcontractorRows(
      [
        {
          id: "contact-1",
          company_name: "Firma",
          specialization: "Elektro",
          contacts: null,
          contact_person_name: "Jan Novák",
          phone: "+420 123 456 789",
          email: "jan@example.com",
          status_id: "available",
          organization_id: "organization-1",
          owner_id: "owner-1",
          latitude: 50.1,
          longitude: 14.4,
          geocoded_at: "2026-07-11T10:00:00Z",
          ares_checked_at: "2026-07-10T10:00:00Z",
          ares_not_found: false,
        },
      ],
      () => "generated-contact-id",
    );

    expect(contacts).toEqual([
      expect.objectContaining({
        id: "contact-1",
        company: "Firma",
        specialization: ["Elektro"],
        latitude: 50.1,
        longitude: 14.4,
        geocodedAt: "2026-07-11T10:00:00Z",
        aresCheckedAt: "2026-07-10T10:00:00Z",
        aresNotFound: false,
        organizationId: "organization-1",
        ownerId: "owner-1",
        contacts: [
          {
            id: "generated-contact-id",
            name: "Jan Novák",
            phone: "+420 123 456 789",
            email: "jan@example.com",
            position: "Hlavní kontakt",
          },
        ],
      }),
    ]);
  });

  it("keeps existing contacts and uses safe field defaults", () => {
    const existingContact = {
      id: "person-1",
      name: "Marie",
      phone: "-",
      email: "-",
    };
    const contacts = mapSubcontractorRows([
      {
        id: "contact-1",
        company_name: "Firma",
        specialization: [],
        contacts: [existingContact],
        status_id: null,
      },
    ]);

    expect(contacts[0]).toEqual(
      expect.objectContaining({
        contacts: [existingContact],
        specialization: ["Ostatní"],
        ico: "-",
        region: "-",
        status: "available",
      }),
    );
  });

  it("normalizes partial JSON contact people before text search", () => {
    const contacts = mapSubcontractorRows(
      [
        {
          id: "contact-legacy",
          company_name: "Legacy firma",
          specialization: ["Elektro"],
          contacts: [
            {
              id: "person-legacy",
              name: null,
              phone: null,
              email: null,
            },
          ],
          status_id: "available",
        },
      ],
      () => "generated-contact-id",
    );

    expect(() =>
      filterContacts(contacts, {
        ...EMPTY_FILTER_STATE,
        searchText: "nenalezeny-vyraz",
      }),
    ).not.toThrow();
    expect(contacts[0].contacts).toEqual([
      {
        id: "person-legacy",
        name: "-",
        phone: "-",
        email: "-",
      },
    ]);
  });

  it("aggregates only finite vendor ratings without mutating input", () => {
    const contacts = mapSubcontractorRows([
      {
        id: "contact-1",
        company_name: "Firma",
        specialization: [],
        contacts: [],
        status_id: "available",
      },
    ]);

    const rated = applyVendorRatings(contacts, [
      { vendor_id: "contact-1", vendor_rating: "4.5" },
      { vendor_id: "contact-1", vendor_rating: 3.5 },
      { vendor_id: "contact-1", vendor_rating: "invalid" },
      { vendor_id: null, vendor_rating: 5 },
    ]);

    expect(rated[0]).toEqual(
      expect.objectContaining({
        vendorRatingAverage: 4,
        vendorRatingCount: 2,
      }),
    );
    expect(contacts[0].vendorRatingAverage).toBeUndefined();
  });
});
