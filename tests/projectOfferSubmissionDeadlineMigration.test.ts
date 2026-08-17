import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260817192556_add_project_offer_submission_deadline.sql",
);

describe("project offer submission deadline migration", () => {
  it("přidá nullable DATE sloupec bez oslabení existujících RLS pravidel", () => {
    expect(existsSync(migrationPath)).toBe(true);
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toMatch(
      /ALTER TABLE public\.projects\s+ADD COLUMN IF NOT EXISTS offer_submission_deadline DATE;/i,
    );
    expect(migration).not.toMatch(/DISABLE ROW LEVEL SECURITY/i);
    expect(migration).not.toMatch(/DROP POLICY/i);
  });
});
