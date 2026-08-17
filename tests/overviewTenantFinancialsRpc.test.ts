import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const MIGRATION = "20260817185725_include_financials_in_overview_tenant_rpc.sql";
const ANON_REVOKE_MIGRATION = "20260817185834_restrict_anon_overview_tenant_rpc.sql";

describe("overview tenant RPC financial values", () => {
  it("returns investor price and amendments only for projects in the caller's tenant", () => {
    const migration = fs.readFileSync(
      path.join(ROOT, "supabase/migrations", MIGRATION),
      "utf8",
    );

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_overview_tenant_data()");
    expect(migration).toContain("p.organization_id = ANY(org_ids)");
    expect(migration).toContain("JOIN org_projects op ON op.id = pif.project_id");
    expect(migration).toContain("JOIN org_projects op ON op.id = pa.project_id");
    expect(migration).toContain("'investorFinancials'");
    expect(migration).toContain("'sodPrice'");
    expect(migration).toContain("'amendments'");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.get_overview_tenant_data() FROM PUBLIC;");
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.get_overview_tenant_data() TO authenticated;",
    );
  });

  it("removes the legacy direct anon grant while preserving authenticated access", () => {
    const migration = fs.readFileSync(
      path.join(ROOT, "supabase/migrations", ANON_REVOKE_MIGRATION),
      "utf8",
    );

    expect(migration).toContain(
      "REVOKE EXECUTE ON FUNCTION public.get_overview_tenant_data() FROM anon;",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.get_overview_tenant_data() TO authenticated;",
    );
  });
});
