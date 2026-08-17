import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationNameSuffix = "_remove_command_center_subscription_features.sql";

const readMigration = (): string => {
  const migrationsDir = join(process.cwd(), "supabase/migrations");
  const matches = readdirSync(migrationsDir).filter((name) =>
    name.endsWith(migrationNameSuffix),
  );

  expect(matches).toHaveLength(1);
  return readFileSync(join(migrationsDir, matches[0]), "utf8");
};

describe("odstranění subscription funkcí Command Centeru", () => {
  it("maže závislá data před feature katalogem a opravuje popis TODO", () => {
    const migration = readMigration();
    const usageDelete = migration.indexOf("DELETE FROM public.feature_usage_events");
    const overridesDelete = migration.indexOf("DELETE FROM public.user_feature_overrides");
    const tierDelete = migration.indexOf("DELETE FROM public.subscription_tier_features");
    const featureDelete = migration.indexOf("DELETE FROM public.subscription_features");

    expect(migration).toContain("SET LOCAL lock_timeout = '5s'");
    expect(migration).toContain("SET LOCAL statement_timeout = '30s'");
    expect(usageDelete).toBeGreaterThanOrEqual(0);
    expect(overridesDelete).toBeGreaterThan(usageDelete);
    expect(tierDelete).toBeGreaterThan(overridesDelete);
    expect(featureDelete).toBeGreaterThan(tierDelete);

    for (const featureKey of [
      "module_command_center",
      "cc_matrix_health",
      "cc_advanced_kpi",
    ]) {
      expect(migration).toContain(`'${featureKey}'`);
    }

    expect(migration).toMatch(
      /UPDATE public\.subscription_features[\s\S]*description = 'Osobní úkoly, podúkoly, připomínky a kalendář'[\s\S]*WHERE key = 'module_tasks'/,
    );
    expect(migration).toContain("RAISE EXCEPTION");
  });
});
