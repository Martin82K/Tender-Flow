import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const readMigration = (name: string): string =>
  fs.readFileSync(path.join(ROOT, "supabase/migrations", name), "utf8");

describe("project scoped templates migration", () => {
  const schemaMigration = readMigration("20260605120000_project_scoped_templates.sql");
  const backfillMigration = readMigration("20260605133000_backfill_project_scoped_templates.sql");

  it("přidává typově konzistentní project_id a potřebné indexy", () => {
    expect(schemaMigration).toContain("ADD COLUMN IF NOT EXISTS project_id VARCHAR(36)");
    expect(schemaMigration).toContain("REFERENCES public.projects(id) ON DELETE CASCADE");
    expect(schemaMigration).toContain("idx_templates_user_project");
    expect(schemaMigration).toContain("idx_templates_project_default");
  });

  it("nahrazuje pouze známé politiky a nemaže budoucí nebo cizí politiky", () => {
    expect(schemaMigration).not.toContain("SELECT policyname");
    expect(schemaMigration).not.toContain("FROM pg_policies");
    expect(schemaMigration).toContain(
      'DROP POLICY IF EXISTS "Users can read own templates" ON public.templates',
    );
    expect(schemaMigration).toContain(
      'DROP POLICY IF EXISTS "Users can read own project scoped templates" ON public.templates',
    );
  });

  it("zachovává feature gating u čtení, vložení, změny i smazání", () => {
    const policySections = schemaMigration.split("CREATE POLICY").slice(1);

    expect(policySections).toHaveLength(4);
    for (const policy of policySections) {
      expect(policy).toContain("public.user_has_feature('dynamic_templates')");
      expect(policy).toContain("TO authenticated");
      expect(policy).toContain("user_id = (SELECT auth.uid())");
    }
  });

  it("čte projektové šablony jen při aktuálním vlastnictví nebo sdílení", () => {
    const selectPolicy = schemaMigration.split("CREATE POLICY")[1];

    expect(selectPolicy).toContain("p.owner_id = (SELECT auth.uid())");
    expect(selectPolicy).toContain("public.is_project_shared_with_user");
  });

  it("povoluje zápis projektových šablon jen vlastníkovi nebo editorovi", () => {
    expect(schemaMigration).toContain("p.owner_id = (SELECT auth.uid())");
    expect(schemaMigration).toContain(
      "public.has_project_share_permission(p.id, (SELECT auth.uid()), 'edit')",
    );
  });

  it("backfill zahrnuje pouze vlastníky a explicitní editory", () => {
    expect(backfillMigration).toContain("ps.permission = 'edit'");
    expect(backfillMigration).not.toMatch(
      /SELECT ps\.user_id, ps\.project_id\s+FROM public\.project_shares ps\s+WHERE ps\.user_id IS NOT NULL\s*[),]/,
    );
  });
});
