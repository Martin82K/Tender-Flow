import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const readMigration = (name: string): string =>
  fs.readFileSync(path.join(ROOT, "supabase/migrations", name), "utf8");

describe("subcontractors RLS hardening", () => {
  it("odstraňuje public NULL-owner expozici a drží kontakty uvnitř tenant scope", () => {
    const migration = readMigration("20260320183000_harden_subcontractors_rls.sql");

    expect(migration).toContain('CREATE POLICY "Subcontractors visible to owner or org"');
    expect(migration).toContain("organization_id IS NOT NULL");
    expect(migration).toContain("organization_id = ANY(public.get_my_org_ids())");
    expect(migration).not.toContain("owner_id IS NULL");
  });

  it("zachovává sdílenou databázi kontaktů pro všechny členy stejné organizace", () => {
    const migration = readMigration("20260320183000_harden_subcontractors_rls.sql");

    expect(migration).toContain('CREATE POLICY "Subcontractors visible to owner or org"');
    expect(migration).toContain("organization_id = ANY(public.get_my_org_ids())");
    expect(migration).toContain('CREATE POLICY "Subcontractors insert restricted to owner or org"');
    expect(migration).toContain('CREATE POLICY "Manage own or org subcontractors"');
  });

  it("write operace zůstávají povolené ownerovi nebo členu stejné organizace", () => {
    const migration = readMigration("20260320183000_harden_subcontractors_rls.sql");

    expect(migration).toContain('CREATE POLICY "Subcontractors insert restricted to owner or org"');
    expect(migration).toContain('CREATE POLICY "Manage own or org subcontractors"');
    expect(migration).toContain('CREATE POLICY "Strict Subcontractor Delete"');
    expect(migration).toContain("owner_id = auth.uid()");
  });
});
