import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const readMigration = (name: string): string =>
  fs.readFileSync(path.join(ROOT, "supabase/migrations", name), "utf8");

describe("project template links rewrite migration", () => {
  it("přepisuje uložené template linky na projektové kopie původních šablon", () => {
    const migration = readMigration("20260605150000_rewrite_project_template_links.sql");

    expect(migration).toContain("inquiry_letter_link");
    expect(migration).toContain("material_inquiry_template_link");
    expect(migration).toContain("losers_email_template_link");
    expect(migration).toContain("legacy.project_id IS NULL");
    expect(migration).toContain("RETURNING id INTO scoped_template_id");
    expect(migration).toContain("SET inquiry_letter_link = 'template:' || scoped_template_id::TEXT");
    expect(migration).toContain("SET material_inquiry_template_link = 'template:' || scoped_template_id::TEXT");
    expect(migration).toContain("SET losers_email_template_link = 'template:' || scoped_template_id::TEXT");
    expect(migration).toContain("~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'");
  });
});
