import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const migrationName = "20260319120000_clone_tender_to_realization.sql";
const migration = fs.readFileSync(
  path.join(ROOT, "supabase/migrations", migrationName),
  "utf8",
);
const compatibilityMigration = fs.readFileSync(
  path.join(
    ROOT,
    "supabase/migrations",
    "20260319142000_fix_clone_tender_to_realization_compat.sql",
  ),
  "utf8",
);
const authorizationHardeningMigration = fs.readFileSync(
  path.join(
    ROOT,
    "supabase/migrations",
    "20260321130000_harden_clone_tender_rpc_ownerless_access.sql",
  ),
  "utf8",
);

describe("clone_tender_project_to_realization migration", () => {
  it("chrání RPC přes auth, status a edit oprávnění", () => {
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("Zdrojový projekt neexistuje.");
    expect(migration).toContain("v_source_project.status IS DISTINCT FROM 'tender'");
    expect(migration).toContain("project_shares ps");
    expect(migration).toContain("ps.permission = 'edit'");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.clone_tender_project_to_realization(VARCHAR) TO authenticated;");
  });

  it("nulují se dochub vazby a kopírují se sdílení", () => {
    expect(migration).toContain("dochub_root_link");
    expect(migration).toContain("'disconnected'");
    expect(migration).toContain("dochub_autocreate_enabled");
    expect(migration).toContain("INSERT INTO public.project_shares");
    expect(migration).toContain("ON CONFLICT (project_id, user_id) DO NOTHING");
  });

  it("pipeline v realizaci startuje čistě, ale se soutěžní cenou v round 0", () => {
    expect(migration).toContain("jsonb_build_object('0', v_effective_price_display)");
    expect(migration).toContain("'contacted'");
    expect(migration).toContain("price_display");
    expect(migration).toContain("selection_round");
    expect(migration).toContain("contracted");
    expect(migration).toContain("'?'");
  });

  it("compatibility migrace skládá project kopii jen nad existujícími sloupci", () => {
    expect(compatibilityMigration).toContain("information_schema.columns");
    expect(compatibilityMigration).toContain("'price_list_link'");
    expect(compatibilityMigration).toContain("'dochub_settings'");
    expect(compatibilityMigration).toContain("SET dochub_status = 'disconnected'");
    expect(compatibilityMigration).toContain("SET dochub_autocreate_enabled = false");
  });

  it("follow-up hardening nahrazuje ownerless fallback kontrolou org membership", () => {
    expect(authorizationHardeningMigration).toContain("public.is_org_member(v_source_project.organization_id)");
    expect(authorizationHardeningMigration).not.toContain("OR v_source_project.owner_id IS NULL");
  });
});
