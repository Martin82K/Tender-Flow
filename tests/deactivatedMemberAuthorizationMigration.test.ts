import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const readMigration = (name: string): string =>
  fs.readFileSync(path.join(ROOT, "supabase/migrations", name), "utf8");

describe("deactivated member authorization hardening", () => {
  const migrationName = "20260412200000_fix_deactivated_member_authorization.sql";

  it("is_org_member připouští pouze aktivní členství", () => {
    const migration = readMigration(migrationName);

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID)");
    expect(migration).toContain("om.user_id = auth.uid()");
    expect(migration).toContain("om.is_active = true");
  });

  it("get_my_org_ids vrací pouze organizace aktivního členství", () => {
    const migration = readMigration(migrationName);

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_my_org_ids()");
    expect(migration).toContain("SELECT om.organization_id");
    expect(migration).toContain("om.user_id = auth.uid()");
    expect(migration).toContain("AND om.is_active = true");
  });

  it("get_org_members autorizuje volajícího jen pokud je aktivní člen", () => {
    const migration = readMigration(migrationName);

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_org_members(org_id_input UUID)");
    expect(migration).toContain("AND om.user_id = auth.uid()");
    expect(migration).toContain("AND om.is_active = true");
    expect(migration).toContain("RAISE EXCEPTION 'Not authorized';");
  });
});
