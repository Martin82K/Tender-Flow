import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260921221000_project_client_cards.sql"),
  "utf8",
);

describe("project client card migration", () => {
  it("váže jednu kartu na stavbu a organizaci a odděluje ji od financí", () => {
    expect(migration).toContain("CREATE TABLE public.project_client_cards");
    expect(migration).toContain("project_id varchar(36) PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE");
    expect(migration).toContain("organization_id uuid NOT NULL REFERENCES public.organizations(id)");
    expect(migration).not.toContain("project_investor_financials");
    expect(migration).toContain("Client card organization must match the project");
    expect(migration).toContain("Project client card cannot move between projects");
  });

  it("uzavírá čtení i zápis rolí projektu, předplatným a archivací", () => {
    expect(migration).toContain("ALTER TABLE public.project_client_cards ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain('CREATE POLICY "Select client card via project"');
    expect(migration).toContain('CREATE POLICY "Manage client card via project"');
    expect(migration).toContain("ps.permission = 'edit'");
    expect(migration).toContain("p.organization_id = project_client_cards.organization_id");
    expect(migration).toContain("public.can_project_module_action(project_id::text, 'module_projects', false)");
    expect(migration).toContain("public.can_project_module_action(project_id::text, 'module_projects', true)");
    expect(migration).toContain("public.has_project_subscription(project_id::text)");
    expect(migration).toContain("public.has_resource_subscription(organization_id)");
    expect(migration).toContain("public.has_active_subscription()");
    expect(migration).toContain("public.guard_archived_project_write('direct', 'project_id')");
    expect(migration).not.toContain("owner_id IS NULL");
    expect(migration).toContain("REVOKE ALL ON public.project_client_cards FROM PUBLIC, anon, authenticated, tenderflow_mcp_client");
    expect(migration).toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_client_cards TO authenticated, service_role");
    expect(migration).not.toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_client_cards TO anon");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.guard_project_client_card()");
  });

  it("kontroluje české IČO mimo veřejné API", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION private.is_valid_czech_ico");
    expect(migration).toContain("private.is_valid_czech_ico(ico)");
    expect(migration).not.toContain("CREATE OR REPLACE FUNCTION public.is_valid_czech_ico");
  });
});
