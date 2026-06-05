import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const readMigration = (name: string): string =>
  fs.readFileSync(path.join(ROOT, "supabase/migrations", name), "utf8");

describe("project scoped templates migration", () => {
  it("přidává project_id, indexy a RLS omezení zápisu na editovatelnou stavbu", () => {
    const migration = readMigration("20260605120000_project_scoped_templates.sql");

    expect(migration).toContain("ADD COLUMN IF NOT EXISTS project_id");
    expect(migration).toContain("REFERENCES public.projects(id) ON DELETE CASCADE");
    expect(migration).toContain("idx_templates_user_project");
    expect(migration).toContain("idx_templates_project_default");
    expect(migration).toContain('CREATE POLICY "Users can insert own editable project scoped templates"');
    expect(migration).toContain('CREATE POLICY "Users can update own editable project scoped templates"');
    expect(migration).toContain("user_id = auth.uid()");
    expect(migration).toContain("p.owner_id = auth.uid()");
    expect(migration).toContain("public.has_project_share_permission(p.id, auth.uid(), 'edit')");
  });
});
