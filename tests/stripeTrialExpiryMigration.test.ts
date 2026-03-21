import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("stripe trial expiry migration", () => {
  it("expires stripe-sourced trial tier once trial_ends_at passes", () => {
    const migration = fs.readFileSync(
      path.join(
        ROOT,
        "supabase/migrations/20260321133000_fix_stripe_trial_expiry_in_subscription_tier.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("IF v_admin_override IS NULL AND v_stripe_tier IS NOT NULL THEN");
    expect(migration).toContain(
      "ELSIF v_status = 'trial' AND v_trial_ends_at IS NOT NULL AND v_trial_ends_at < NOW() THEN",
    );
    expect(migration).toContain("SET subscription_status = 'expired'");
    expect(migration).toContain("v_stripe_tier := NULL;");
  });
});
