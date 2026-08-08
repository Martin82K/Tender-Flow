import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260808120000_project_teams_contract_overview.sql",
);

const readMigration = (): string => fs.readFileSync(migrationPath, "utf8");

describe("project teams, archive and contract overview migration", () => {
  it("migrates existing shares without preserving external write access", () => {
    const migration = readMigration();

    expect(migration).toContain("ADD COLUMN IF NOT EXISTS role TEXT");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS legacy_external BOOLEAN");
    expect(migration).toMatch(/legacy_external\s*=\s*true[\s\S]*permission\s*=\s*'view'/i);
    expect(migration).toContain("project_manager");
    expect(migration).toContain("team_member");
    expect(migration).toContain("viewer");
  });

  it("creates atomic team RPCs and restricts them to active same-organization members", () => {
    const migration = readMigration();

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.create_project_with_team");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.set_project_team_member");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.remove_project_team_member");
    expect(migration).toContain("om.is_active = true");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.create_project_with_team");
  });

  it("enforces archived projects as read-only and allows only project administrators to restore", () => {
    const migration = readMigration();

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.guard_archived_project_write");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.set_project_archived");
    expect(migration).toMatch(/status\s*=\s*'archived'[\s\S]*Project is archived/i);
    expect(migration).toMatch(/effective_project_role[\s\S]*owner_admin[\s\S]*project_admin/i);
  });

  it("grants contract overview automatically to organization owner/admin and explicitly only to members", () => {
    const migration = readMigration();

    expect(migration).toContain("Přístup ke smluvnímu přehledu");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.has_contract_overview_access");
    expect(migration).toMatch(/om\.role IN \('owner', 'admin'\)/);
    expect(migration).toMatch(/om\.role = 'member'[\s\S]*organization_member_permissions/i);
    expect(migration).toMatch(/target_role <> 'member'[\s\S]*Automatic permission cannot be changed/i);
  });

  it("returns an allowlisted aggregate and audits every contract-overview access", () => {
    const migration = readMigration();

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_contract_overview");
    expect(migration).toContain("approved_drawdown");
    expect(migration).toContain("result_count");
    expect(migration).toContain("contract_overview_access");
    for (const forbidden of ["document_url", "extraction_json", "invoice_number", "source_bid_id"]) {
      const functionBody = migration.split("CREATE OR REPLACE FUNCTION public.get_contract_overview")[1] ?? "";
      expect(functionBody.split("REVOKE ALL ON FUNCTION public.get_contract_overview")[0]).not.toContain(forbidden);
    }
  });

  it("uses RLS and explicit grants for newly exposed tables", () => {
    const migration = readMigration();

    expect(migration).toContain("ALTER TABLE public.organization_member_permissions ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("ALTER TABLE public.project_access_audit_events ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("REVOKE ALL ON public.organization_member_permissions FROM anon, authenticated");
    expect(migration).toContain("GRANT SELECT ON public.project_access_audit_events TO authenticated");
  });

  it("retires email-based sharing RPCs and does not expose the organization roster to legacy external viewers", () => {
    const migration = readMigration();

    expect(migration).toContain("REVOKE ALL ON FUNCTION public.get_user_id_by_email(TEXT) FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.get_project_shares_debug(TEXT) FROM PUBLIC, anon, authenticated");
    expect(migration).toMatch(/caller_is_legacy_external[\s\S]*ps\.user_id = auth\.uid\(\)/);
  });
});
