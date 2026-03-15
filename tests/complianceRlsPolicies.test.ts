import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const readMigration = (name: string): string =>
  fs.readFileSync(path.join(ROOT, "supabase/migrations", name), "utf8");

describe("compliance RLS and admin RPC migrations", () => {
  it("chrání hlavní compliance tabulky přes RLS admin policies", () => {
    const migration = readMigration("20260312221500_add_compliance_registry.sql");

    const protectedTables = [
      "compliance_checklist_items",
      "compliance_retention_policies",
      "data_subject_requests",
      "breach_cases",
      "subprocessors",
    ];

    for (const table of protectedTables) {
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
      expect(migration).toContain(`"${table}_admin_select"`);
      expect(migration).toContain(`"${table}_admin_write"`);
      expect(migration).toContain(`USING (public.is_admin())`);
      expect(migration).toContain(`WITH CHECK (public.is_admin())`);
      expect(migration).toContain(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO authenticated;`);
    }
  });

  it("chrání auditní a timeline tabulky přes admin-only policies", () => {
    const auditMigration = readMigration("20260312224500_add_admin_audit_events.sql");
    const runtimeMigration = readMigration("20260312235500_add_compliance_retention_runtime.sql");
    const retentionReviewMigration = readMigration("20260315110000_add_crm_retention_review_registry.sql");

    expect(auditMigration).toContain("ALTER TABLE public.admin_audit_events ENABLE ROW LEVEL SECURITY;");
    expect(auditMigration).toContain("\"admin_audit_events_admin_select\"");
    expect(auditMigration).toContain("\"admin_audit_events_admin_insert\"");
    expect(auditMigration).toContain("WITH CHECK (public.is_admin())");

    expect(runtimeMigration).toContain("ALTER TABLE public.data_subject_request_events ENABLE ROW LEVEL SECURITY;");
    expect(runtimeMigration).toContain("ALTER TABLE public.breach_case_events ENABLE ROW LEVEL SECURITY;");
    expect(runtimeMigration).toContain("\"data_subject_request_events_admin_write\"");
    expect(runtimeMigration).toContain("\"breach_case_events_admin_write\"");

    expect(retentionReviewMigration).toContain(
      "ALTER TABLE public.compliance_crm_retention_reviews ENABLE ROW LEVEL SECURITY;",
    );
    expect(retentionReviewMigration).toContain("\"compliance_crm_retention_reviews_admin_write\"");
  });

  it("admin RPC funkce jsou explicitně grantnuté authenticated role", () => {
    const accessReview = readMigration("20260313001000_add_access_review_audit.sql");
    const dsr = readMigration("20260312232000_add_dsr_export_anonymize.sql");
    const retention = readMigration("20260315103000_expand_compliance_retention_telemetry.sql");
    const incidents = readMigration("20260312110000_expand_app_incident_admin_logging.sql");

    expect(accessReview).toContain("GRANT EXECUTE ON FUNCTION public.get_access_review_overview_admin() TO authenticated;");
    expect(accessReview).toContain("GRANT EXECUTE ON FUNCTION public.create_access_review_report_admin(TEXT, TEXT) TO authenticated;");
    expect(dsr).toContain("GRANT EXECUTE ON FUNCTION public.get_data_subject_export_admin(TEXT) TO authenticated;");
    expect(dsr).toContain("GRANT EXECUTE ON FUNCTION public.anonymize_data_subject_admin(TEXT) TO authenticated;");
    expect(retention).toContain("GRANT EXECUTE ON FUNCTION public.run_compliance_retention_purge_admin() TO authenticated;");
    expect(incidents).toContain("GRANT EXECUTE ON FUNCTION public.log_app_incident(JSONB) TO authenticated;");
  });
});
