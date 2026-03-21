import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("overview tenant RPC hardening migration", () => {
  it("omezuje subcontractor join na tenant nebo ownera", () => {
    const migration = fs.readFileSync(
      path.join(
        ROOT,
        "supabase/migrations/20260321114500_harden_overview_tenant_rpc_subcontractor_join.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_overview_tenant_data()");
    expect(migration).toContain("LEFT JOIN public.subcontractors s");
    expect(migration).toContain("s.organization_id = ANY(org_ids)");
    expect(migration).toContain("OR s.owner_id = auth.uid()");
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.get_overview_tenant_data() TO authenticated;",
    );
  });
});
