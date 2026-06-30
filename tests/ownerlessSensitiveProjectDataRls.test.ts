import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const readMigration = (name: string): string =>
  fs.readFileSync(path.join(ROOT, "supabase/migrations", name), "utf8");

describe("ownerless sensitive project data RLS", () => {
  it("odstraňuje NULL-owner fallback z citlivých smluvních a finančních tabulek", () => {
    const migration = readMigration("20260320173000_harden_ownerless_sensitive_project_data_rls.sql");

    expect(migration).toContain('DROP POLICY IF EXISTS "Select financials via project" ON public.project_investor_financials;');
    expect(migration).toContain('DROP POLICY IF EXISTS "contracts_select" ON public.contracts;');
    expect(migration).toContain('DROP POLICY IF EXISTS "contract_md_versions_select" ON public.contract_markdown_versions;');
    expect(migration).not.toContain("owner_id IS NULL");
  });

  it("ponechává přístup jen ownerovi nebo explicitně sdílenému uživateli", () => {
    const migration = readMigration("20260320173000_harden_ownerless_sensitive_project_data_rls.sql");

    expect(migration).toContain("p.owner_id = auth.uid()");
    expect(migration).toContain("FROM public.project_shares ps");
    expect(migration).toContain("ps.permission = 'edit'");
    expect(migration).toContain("public.user_has_feature('module_contracts')");
  });

  it("chrání rozpočty projektu před přístupem přes ownerless sdílení", () => {
    const migration = readMigration("20260630120000_project_budgets.sql");

    expect(migration).toContain("ALTER TABLE public.project_budgets ENABLE ROW LEVEL SECURITY;");
    expect(migration).toContain("ALTER TABLE public.project_budget_items ENABLE ROW LEVEL SECURITY;");
    expect(migration).toContain("REFERENCES public.demand_categories(id) ON DELETE SET NULL");
    expect(migration).toContain("FROM public.project_shares ps");
    expect(migration).toContain("p.owner_id IS NOT NULL");
    expect(migration).not.toContain("p.owner_id IS NULL");
  });
});
