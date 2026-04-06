import { describe, expect, it } from "vitest";
import {
  analyzeContactsImport,
  type FieldMapping,
  type ParsedTable,
} from "../services/contactsImportWizardService";

const mapping: FieldMapping = {
  company: "Firma",
  ico: null,
  region: null,
  specialization: null,
  status: null,
  contactName: "Jmeno",
  contactEmail: "Email",
  contactPhone: null,
  contactPosition: null,
  web: null,
  note: null,
};

const table: ParsedTable = {
  sourceLabel: "test.csv",
  headers: ["Firma", "Jmeno", "Email"],
  rows: [
    {
      Firma: "CON",
      Jmeno: "Test Kontakt",
      Email: "test@example.com",
    },
  ],
};

describe("ContactsImportWizard name fixes", () => {
  it("marks invalid company names as not importable when fix mode is off", () => {
    const result = analyzeContactsImport(table, mapping, {
      defaultStatusId: "available",
      statuses: [{ id: "available", label: "Dostupny", color: "green" }],
      existingContacts: [],
      nameFixMode: "off",
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].outcome).toBe("not_imported");
    expect(result.rows[0].companyNameInvalid).toBe(true);
    expect(result.rows[0].suggestedCompanyName).toBe("CON_");
    expect(result.aggregatedContacts).toHaveLength(0);
  });

  it("uses sanitized names when fix mode is applied", () => {
    const result = analyzeContactsImport(table, mapping, {
      defaultStatusId: "available",
      statuses: [{ id: "available", label: "Dostupny", color: "green" }],
      existingContacts: [],
      nameFixMode: "apply",
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].outcome).toBe("imported_with_warning");
    expect(result.rows[0].mapped.company).toBe("CON_");
    expect(result.aggregatedContacts).toHaveLength(1);
    expect(result.aggregatedContacts[0].company).toBe("CON_");
  });
});
