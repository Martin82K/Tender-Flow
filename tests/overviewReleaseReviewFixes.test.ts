import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260817205405_harden_overview_and_preserve_offer_deadline.sql",
  ),
  "utf8",
);

describe("overview release review fixes migration", () => {
  it("limits the overview RPC to projects visible through module permissions", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_overview_tenant_data()");
    expect(migration).toMatch(
      /public\.can_project_module_action\(p\.id::text, 'module_projects', false\)/i,
    );
    expect(migration).toContain("p.archived_original_status");
    expect(migration).toContain("'archivedOriginalStatus', op.archived_original_status");
  });

  it("preserves offer submission deadlines in both backup restore contracts", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.restore_user_backup(");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.restore_tenant_backup(");
    expect(migration.match(/offer_submission_deadline/g)).toHaveLength(6);
    expect(migration.match(/SET offer_submission_deadline = NULLIF/g)).toHaveLength(2);
  });

  it("keeps privileged functions private from anonymous callers", () => {
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.get_overview_tenant_data() FROM PUBLIC;");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.restore_user_backup(JSONB, UUID) FROM PUBLIC, anon;");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.restore_tenant_backup(JSONB, UUID) FROM PUBLIC, anon;");
  });
});
