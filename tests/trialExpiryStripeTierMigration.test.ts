import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("trial expiry for stripe tier migration", () => {
  it("aplikuje trial_ends_at expiraci i na stripe tier a backfilluje stare trialy", () => {
    const migration = fs.readFileSync(
      path.join(
        ROOT,
        "supabase/migrations/20260321123000_fix_trial_expiry_for_stripe_tier.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_user_subscription_tier(target_user_id UUID)");
    expect(migration).toContain("ELSIF v_status = 'trial' AND v_trial_ends_at IS NOT NULL AND v_trial_ends_at < NOW() THEN");
    expect(migration).toContain("IF v_admin_override IS NULL AND v_stripe_tier IS NOT NULL THEN");
    expect(migration).toContain("v_stripe_tier := NULL;");
    expect(migration).toContain("SET subscription_status = 'expired',");
    expect(migration).toContain("stripe_subscription_tier = NULL,");
    expect(migration).toContain("AND subscription_tier_override IS NULL;");
  });
});
