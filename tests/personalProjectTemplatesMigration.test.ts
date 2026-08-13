import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260813120000_personal_project_template_selections.sql",
);

const grantsMigrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260813131000_restrict_project_template_selection_grants.sql",
);

describe("personal project template selections migration", () => {
  const migration = fs.readFileSync(migrationPath, "utf8");
  const grantsMigration = fs.readFileSync(grantsMigrationPath, "utf8");

  it("vynucuje jediný default pro uživatele a stavbu včetně legacy NULL scope", () => {
    expect(migration).toContain(
      "ALTER TABLE public.templates DISABLE TRIGGER trg_archived_guard_templates",
    );
    expect(migration).toContain(
      "ALTER TABLE public.templates ENABLE TRIGGER trg_archived_guard_templates",
    );
    expect(migration).toContain("uq_templates_one_project_default");
    expect(migration).toContain("WHERE is_default AND project_id IS NOT NULL");
    expect(migration).toContain("uq_templates_one_legacy_default");
    expect(migration).toContain("WHERE is_default AND project_id IS NULL");
  });

  it("ukládá osobní volbu podle stavby, uživatele a typu", () => {
    expect(migration).toContain("CREATE TABLE public.project_template_selections");
    expect(migration).toContain("PRIMARY KEY (project_id, user_id, template_kind)");
    expect(migration).toContain("FOREIGN KEY (template_id, user_id, project_id)");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("trg_archived_guard_project_template_selections");
    expect(migration).toContain("project.status IS DISTINCT FROM 'archived'");
    expect(migration).toContain("template.user_id = legacy.user_id");
    expect(migration).toContain("template.project_id = legacy.project_id");
  });

  it("RLS dovoluje číst a měnit pouze vlastní volbu", () => {
    expect(migration).toContain("user_id = (SELECT auth.uid())");
    expect(migration).toContain("WITH CHECK");
    expect(migration).toContain("public.user_has_feature('dynamic_templates')");
  });

  it("ukládá default atomicky a nepovolí přesun existující šablony mezi stavbami", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.save_scoped_template");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("project_id IS NOT DISTINCT FROM p_project_id");
    expect(migration).toContain("SECURITY INVOKER");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.save_scoped_template");
  });

  it("novou Data API tabulku vystavuje jen autentizovaným rolím", () => {
    expect(migration).toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_template_selections TO authenticated",
    );
    expect(migration).toContain("REVOKE ALL ON public.project_template_selections FROM anon");
    expect(grantsMigration).toContain(
      "REVOKE ALL ON public.project_template_selections FROM authenticated",
    );
    expect(grantsMigration).toContain("GRANT SELECT, INSERT, UPDATE, DELETE");
    expect(grantsMigration).not.toMatch(/GRANT\s+(?:ALL|TRUNCATE|TRIGGER|REFERENCES)/i);
  });
});
