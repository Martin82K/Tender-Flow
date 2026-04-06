import { describe, expect, it } from "vitest";
import {
  analyzeContactsImport,
  parseContactsImportSource,
  suggestFieldMapping,
  type AnalyzeOptions,
  type FieldMapping,
  type ParsedTable,
} from "../services/contactsImportWizardService";

const makeTable = (rows: Array<Record<string, string>>): ParsedTable => ({
  sourceLabel: "test.csv",
  headers: Object.keys(rows[0] || {}),
  rows,
});

const baseOptions = (overrides?: Partial<AnalyzeOptions>): AnalyzeOptions => ({
  defaultStatusId: "available",
  statuses: [],
  existingContacts: [],
  nameFixMode: "off",
  ...overrides,
});

const sampleRows = [
  { Firma: "Alpha sro", Email: "a@alpha.cz", Jmeno: "Jan" },
  { Firma: "Beta sro", Email: "b@beta.cz", Jmeno: "Petr" },
  { Firma: "Gamma sro", Email: "c@gamma.cz", Jmeno: "Eva" },
];

const sampleMapping: FieldMapping = {
  company: "Firma",
  ico: null,
  region: null,
  city: null,
  specialization: null,
  status: null,
  contactName: "Jmeno",
  contactEmail: "Email",
  contactPhone: null,
  contactPosition: null,
  web: null,
  note: null,
};

describe("contactsImportWizard – row exclusion", () => {
  it("without exclusions, all valid rows are imported", () => {
    const table = makeTable(sampleRows);
    const result = analyzeContactsImport(table, sampleMapping, baseOptions());

    expect(result.rows).toHaveLength(3);
    expect(result.rows.every((r) => r.outcome === "imported")).toBe(true);
    expect(result.rows.every((r) => !r.excluded)).toBe(true);
    expect(result.aggregatedContacts).toHaveLength(3);
  });

  it("excluded row gets outcome not_imported and excluded flag", () => {
    const table = makeTable(sampleRows);
    const result = analyzeContactsImport(
      table,
      sampleMapping,
      baseOptions({ excludedRowIndices: new Set([2]) }),
    );

    expect(result.rows[0].excluded).toBe(false);
    expect(result.rows[0].outcome).toBe("imported");

    expect(result.rows[1].excluded).toBe(true);
    expect(result.rows[1].outcome).toBe("not_imported");
    expect(result.rows[1].rowIndex).toBe(2);

    expect(result.rows[2].excluded).toBe(false);
    expect(result.rows[2].outcome).toBe("imported");
  });

  it("excluded rows are not included in aggregatedContacts", () => {
    const table = makeTable(sampleRows);
    const result = analyzeContactsImport(
      table,
      sampleMapping,
      baseOptions({ excludedRowIndices: new Set([1, 3]) }),
    );

    expect(result.aggregatedContacts).toHaveLength(1);
    expect(result.aggregatedContacts[0].company).toBe("Beta sro");
  });

  it("excluding all rows results in empty aggregatedContacts", () => {
    const table = makeTable(sampleRows);
    const result = analyzeContactsImport(
      table,
      sampleMapping,
      baseOptions({ excludedRowIndices: new Set([1, 2, 3]) }),
    );

    expect(result.aggregatedContacts).toHaveLength(0);
    expect(result.rows.every((r) => r.excluded)).toBe(true);
    expect(result.rows.every((r) => r.outcome === "not_imported")).toBe(true);
  });

  it("counts reflect excluded rows as notImported", () => {
    const table = makeTable(sampleRows);
    const result = analyzeContactsImport(
      table,
      sampleMapping,
      baseOptions({ excludedRowIndices: new Set([2]) }),
    );

    expect(result.counts.imported).toBe(2);
    expect(result.counts.notImported).toBe(1);
    expect(result.counts.importedWithWarning).toBe(0);
  });

  it("excluded row preserves original warnings and errors", () => {
    // Row without company or email → would normally be not_imported with errors
    const rows = [
      { Firma: "Alpha s.r.o.", Email: "a@alpha.cz", Jmeno: "Jan" },
      { Firma: "", Email: "", Jmeno: "Orphan" },
    ];
    const table = makeTable(rows);

    // First check without exclusion
    const withoutExclude = analyzeContactsImport(table, sampleMapping, baseOptions());
    expect(withoutExclude.rows[1].outcome).toBe("not_imported");
    expect(withoutExclude.rows[1].errors.length).toBeGreaterThan(0);

    // Now exclude row 1 (valid row) and check row 2 still has its errors
    const withExclude = analyzeContactsImport(
      table,
      sampleMapping,
      baseOptions({ excludedRowIndices: new Set([1]) }),
    );
    expect(withExclude.rows[0].excluded).toBe(true);
    expect(withExclude.rows[1].errors.length).toBeGreaterThan(0);
    expect(withExclude.rows[1].excluded).toBe(false);
  });

  it("empty excludedRowIndices set behaves like no exclusion", () => {
    const table = makeTable(sampleRows);
    const result = analyzeContactsImport(
      table,
      sampleMapping,
      baseOptions({ excludedRowIndices: new Set() }),
    );

    expect(result.rows.every((r) => !r.excluded)).toBe(true);
    expect(result.aggregatedContacts).toHaveLength(3);
  });

  it("excluding a row that would be imported_with_warning still marks it excluded", () => {
    // Two rows with same company → second gets "imported_with_warning" due to duplicate
    const rows = [
      { Firma: "Alpha sro", Email: "a@alpha.cz", Jmeno: "Jan" },
      { Firma: "Alpha sro", Email: "b@alpha.cz", Jmeno: "Petr" },
    ];
    const table = makeTable(rows);

    // Without exclusion, second row merges with warning
    const noExclude = analyzeContactsImport(table, sampleMapping, baseOptions());
    expect(noExclude.aggregatedContacts).toHaveLength(1);
    expect(noExclude.aggregatedContacts[0].contacts).toHaveLength(2);

    // Exclude the second row
    const withExclude = analyzeContactsImport(
      table,
      sampleMapping,
      baseOptions({ excludedRowIndices: new Set([2]) }),
    );
    expect(withExclude.rows[1].excluded).toBe(true);
    expect(withExclude.rows[1].outcome).toBe("not_imported");
    expect(withExclude.aggregatedContacts).toHaveLength(1);
    expect(withExclude.aggregatedContacts[0].contacts).toHaveLength(1);
    expect(withExclude.aggregatedContacts[0].contacts[0].name).toBe("Jan");
  });
});
