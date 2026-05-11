import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONTACTS_WIZARD_IMPORT_MAX_FILE_BYTES,
  CONTACTS_WIZARD_IMPORT_MAX_ROWS,
  parseContactsImportSource,
} from "../services/contactsImportWizardService";

describe("contactsImportWizardService security", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("odmita URL import mimo HTTPS jeste pred fetch", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      parseContactsImportSource({ kind: "url", url: "http://example.com/kontakty.csv" }),
    ).rejects.toThrow("HTTPS");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("odmita URL s prihlasovacimi udaji jeste pred fetch", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      parseContactsImportSource({ kind: "url", url: "https://user:secret@example.com/kontakty.csv" }),
    ).rejects.toThrow("přihlašovací údaje");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("odmita prilis velky URL import podle Content-Length pred nactenim body", async () => {
    const blob = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      headers: new Headers({
        "content-length": String(CONTACTS_WIZARD_IMPORT_MAX_FILE_BYTES + 1),
      }),
      blob,
    } as unknown as Response);

    await expect(
      parseContactsImportSource({ kind: "url", url: "https://example.com/kontakty.csv" }),
    ).rejects.toThrow("příliš velký");
    expect(blob).not.toHaveBeenCalled();
  });

  it("odmita CSV nad row limitem", async () => {
    const rows = [
      "Firma,Email",
      ...Array.from(
        { length: CONTACTS_WIZARD_IMPORT_MAX_ROWS + 1 },
        (_, index) => `Firma ${index},test${index}@example.com`,
      ),
    ].join("\n");

    await expect(
      parseContactsImportSource({
        kind: "file",
        file: new File([rows], "kontakty.csv", { type: "text/csv" }),
      }),
    ).rejects.toThrow("příliš mnoho řádků");
  });

  it("xlsx parser je dynamicky importovany a omezeny bez formule/html/stylu", () => {
    const source = readFileSync(
      resolve(process.cwd(), "services/contactsImportWizardService.ts"),
      "utf-8",
    );

    expect(source).not.toContain('import * as XLSX from "xlsx"');
    expect(source).toContain('await import("xlsx")');
    expect(source).toContain("sheetRows: CONTACTS_WIZARD_IMPORT_MAX_ROWS + 2");
    expect(source).toContain("cellFormula: false");
    expect(source).toContain("cellHTML: false");
    expect(source).toContain("cellStyles: false");
  });
});
