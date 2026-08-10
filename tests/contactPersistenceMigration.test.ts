import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const MIGRATION = "20260810150000_fix_contact_persistence.sql";

const readMigration = (): string =>
  fs.readFileSync(path.join(ROOT, "supabase/migrations", MIGRATION), "utf8");

describe("contact persistence migration", () => {
  it("povolí týmový kontakt bez osobního ownera jen aktivnímu členu stejné organizace", () => {
    const migration = readMigration();

    expect(migration).toContain("CREATE SCHEMA IF NOT EXISTS private");
    expect(migration).toContain("REVOKE ALL ON SCHEMA private FROM PUBLIC, anon");
    expect(migration).toContain("caller.organization_id = organization_id_input");
    expect(migration).toContain("caller.user_id = auth.uid()");
    expect(migration).toContain("COALESCE(caller.is_active, true) = true");
    expect(migration).toMatch(/owner_id_input IS NULL[\s\S]*RETURN TRUE/);
    expect(migration).toContain("RETURN owner_id_input = auth.uid()");
    expect(migration).toContain("REVOKE ALL ON FUNCTION private.can_write_subcontractor_tenant(UUID, UUID)");
    expect(migration).toContain("private.can_write_subcontractor_tenant(owner_id, organization_id)");
    expect(migration).toContain("DROP FUNCTION public.can_write_subcontractor_tenant(UUID, UUID)");
  });

  it("sjednotí legacy hlavní kontakt podle první osoby bez změny tenant scope", () => {
    const migration = readMigration();

    expect(migration).toContain("UPDATE public.subcontractors");
    expect(migration).toContain("contacts->0->>'name'");
    expect(migration).toContain("contacts->0->>'email'");
    expect(migration).toContain("contacts->0->>'phone'");
    expect(migration).not.toMatch(/UPDATE public\.subcontractors[\s\S]*organization_id\s*=/);
    expect(migration).not.toMatch(/UPDATE public\.subcontractors[\s\S]*owner_id\s*=/);
  });
});
