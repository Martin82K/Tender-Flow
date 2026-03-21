import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("contacts CSV export hardening", () => {
  it("neutralizuje buňky začínající formula prefixem", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "services/exportService.ts"),
      "utf8",
    );

    expect(source).toContain("const sanitizeCsvCell = (value: string): string => {");
    expect(source).toContain("return /^\\s*[=+\\-@]/.test(value) ? `'${value}` : value;");
    expect(source).toContain("sanitizeCsvCell(contact.company)");
    expect(source).toContain("sanitizeCsvCell(primaryContact.email || '')");
    expect(source).toContain("sanitizeCsvCell(otherContacts)");
  });
});
