import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("trial tier override source migration", () => {
  it("drží trial tier ve stripe poli a neshazuje placené manual override", () => {
    const migration = fs.readFileSync(
      path.join(
        ROOT,
        "supabase/migrations/20260321115500_fix_trial_tier_override_source.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.handle_new_user_trial()");
    expect(migration).toContain("IF NEW.subscription_tier_override IS NULL THEN");
    expect(migration).toContain("NEW.subscription_tier_override := NULL;");
    expect(migration).toContain("NEW.stripe_subscription_tier := 'pro';");
    expect(migration).toContain("WHERE subscription_tier_override = 'pro'");
    expect(migration).toContain("AND subscription_status = 'trial';");
    expect(migration).not.toContain("NEW.subscription_tier_override := 'pro';");
  });
});
