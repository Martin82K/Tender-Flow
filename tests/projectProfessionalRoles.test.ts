import { readFileSync } from "node:fs";
import { join } from "node:path";

const readSource = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("profesní role realizačního týmu", () => {
  it("používá pouze schválených sedm profesních rolí", () => {
    const typesSource = readSource("types.ts");

    expect(typesSource).toContain('"deputy"');
    expect(typesSource).toContain('"lead_site_manager"');
    expect(typesSource).toContain('"site_manager"');
    expect(typesSource).toContain('"preconstruction"');
    expect(typesSource).toContain('"technician"');
    expect(typesSource).toContain('"contracts_department"');
    expect(typesSource).toContain('"economist"');
    expect(typesSource).not.toContain('"project_admin" | "project_manager" | "team_member" | "viewer"');
  });

  it("odděluje systémového vlastníka od profesní role", () => {
    const serviceSource = readSource("services/projectService.ts");
    const teamSource = readSource("features/projects/team/ProjectTeamSettings.tsx");

    expect(serviceSource).toContain('ProjectAccessKind');
    expect(teamSource).toContain("Systémový vlastník");
    expect(teamSource).not.toContain('owner_admin: "Vlastník projektu"');
  });

  it("nabízí v organizaci samostatnou sekci Role a oprávnění", () => {
    const dashboardSource = readSource("features/organization/ui/OrganizationDashboard.tsx");
    const typesSource = readSource("features/organization/model/types.ts");

    expect(dashboardSource).toContain("Role a oprávnění");
    expect(typesSource).toContain("rolePermissions");
  });

  it("migruje profesní role bez odhadnutého mapování starých rolí", () => {
    const migration = readSource("supabase/migrations/20260808160957_complete_project_role_matrix.sql");

    expect(migration).toContain("ADD COLUMN IF NOT EXISTS professional_role TEXT");
    expect(migration).toContain("organization_role_permissions");
    expect(migration).not.toMatch(/UPDATE public\.project_shares[\s\S]*professional_role\s*=/i);
    expect(migration).toContain("legacy_external");
  });

  it("odděluje čtení, zápis a schvalování a auditovaně ukládá matici", () => {
    const migration = readSource("supabase/migrations/20260808160957_complete_project_role_matrix.sql");

    expect(migration).toContain("access_level IN ('none', 'read', 'write')");
    expect(migration).toContain("can_approve BOOLEAN NOT NULL DEFAULT false");
    expect(migration).toContain("role_permission_set");
    expect(migration).toContain("public.is_active_org_admin_or_owner(org_id_input)");
    expect(migration).toContain("REVOKE ALL ON public.organization_role_permissions FROM PUBLIC, anon, authenticated");
  });

  it("zachovává potvrzené úrovně smluv a zákaz nastavení Složkomatu", () => {
    const migration = readSource("supabase/migrations/20260808160957_complete_project_role_matrix.sql");

    expect(migration).toMatch(/preconstruction', 'contracts_department'[\s\S]*THEN 'write' ELSE 'read'/);
    expect(migration).toContain("ARRAY['deputy', 'contracts_department', 'economist']");
    expect(migration).toContain("'documents.dochub_settings', 'none'");
    expect(migration).toMatch(/action_input = 'view_contracts'[\s\S]*contract_level IN \('read', 'write'\)/);
    expect(migration).toMatch(/ELSE contract_level = 'write'/);
  });

  it("převádí vlastnictví bez smazání profesní role nového vlastníka", () => {
    const migration = readSource("supabase/migrations/20260808160957_complete_project_role_matrix.sql");
    const transfer = migration.split("CREATE OR REPLACE FUNCTION public.transfer_project_ownership")[1] || "";

    expect(transfer).toContain("Pouze aktuální vlastník může předat stavbu");
    expect(transfer).toContain("project_ownership_transferred");
    expect(transfer).not.toMatch(/DELETE FROM public\.project_shares/);
  });

  it("přesouvá profesní roli na člena organizace a ponechává projektové členství bez role", () => {
    const migration = readSource("supabase/migrations/20260808164231_move_professional_role_to_organization_member.sql");
    const teamUi = readSource("features/projects/team/ProjectTeamSettings.tsx");
    const membersUi = readSource("features/organization/ui/OrgMembersTab.tsx");

    expect(migration).toMatch(/ALTER TABLE public\.organization_members[\s\S]*ADD COLUMN IF NOT EXISTS professional_role TEXT/);
    expect(migration).toContain("ALTER TABLE public.project_shares DROP COLUMN IF EXISTS professional_role");
    expect(migration).toContain("om.professional_role");
    expect(migration).toContain("'organization_professional_role_set'");
    expect(migration).toContain("jsonb_build_object('membership_only', true)");
    expect(teamUi).not.toContain("updateRole");
    expect(teamUi).not.toContain("setSelectedRole");
    expect(membersUi).toContain("setOrganizationMemberProfessionalRole");
    expect(membersUi).not.toContain("Přístup ke smluvnímu přehledu");
  });

  it("vede Smluvní přehled jako dva výlučné read-only rozsahy matice", () => {
    const roleCatalog = readSource("shared/authorization/projectRoles.ts");
    const migration = readSource("supabase/migrations/20260808190000_contract_overview_role_scope.sql");

    expect(roleCatalog).toContain('key: "contract_overview"');
    expect(roleCatalog).toContain('key: "contract_overview.organization"');
    expect(roleCatalog).toContain('key: "contract_overview.project_team"');
    expect(roleCatalog).toContain("Tento širší rozsah má přednost");
    expect(roleCatalog).toContain('allowedLevels: ["none", "read"]');
    expect(migration).toContain("contract_overview_access_scope");
    expect(migration).toContain("contract_overview.organization");
    expect(migration).toContain("contract_overview.project_team");
    expect(migration).toContain("ps.project_id = p.id AND ps.user_id = auth.uid()");
    expect(migration).toContain("p.organization_id = caller_org");
    expect(migration).not.toMatch(/om\.role IN \('owner', 'admin'\)/);
  });
});
