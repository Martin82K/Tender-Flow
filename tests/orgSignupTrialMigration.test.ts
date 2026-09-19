import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("org signup enterprise trial migration", () => {
  it("creates a 14-day Enterprise trial from created_at and keeps the existing expiry wall", () => {
    const migration = fs.readFileSync(
      path.join(ROOT, "supabase/migrations/20260919070618_org_signup_enterprise_trial.sql"),
      "utf8",
    );
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_or_create_user_organization_internal");
    expect(migration).toContain("'enterprise', 'trial'");
    expect(migration).toContain("public._org_signup_trial_deadline(v_created_at)");
    expect(migration).toContain("interval '14 days'");
    expect(migration).toContain("'status', result_status");
    expect(migration).toContain("o.subscription_status = 'expired'");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.get_or_create_user_organization_internal(uuid, text, text) FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public._org_billable_seats_available");
    expect(migration).toContain("public._org_billable_seats_available(v_org_id)");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("AND om.is_billable = true");
    expect(migration).toContain(") <= o.max_seats");
    expect(migration).toContain("auth.role() IS DISTINCT FROM 'authenticated'");
    expect(migration).toContain("AND om.is_active = true");
    expect(migration).toContain("AND NOT EXISTS (");
    expect(migration).toContain("public.is_public_email_domain(v_domain)");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.is_public_email_domain");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.is_free_email_provider");
    expect(migration).toContain("'aol.com'");
    expect(migration).toContain("'post.cz'");
    expect(migration).toContain("'pm.me'");
    expect(migration).toContain("'ymail.com'");
    expect(migration).toContain("'gmx.com'");
    expect(migration).toContain("'mail.com'");
    expect(migration).toContain("'seznam.sk'");
    expect(migration).toContain("'yahoo.co.uk'");
    expect(migration).toContain("public.normalize_email_domain(p_email)");
    expect(migration).toContain("AND o.type = 'business'");
    expect(migration).toContain("AND bo.type = 'business'");
    expect(migration).toContain("o.subscription_status IS DISTINCT FROM 'trial'");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.handle_new_user_trial");
    expect(migration).toContain("Trial organizations cannot change the seat limit");
  });
});
