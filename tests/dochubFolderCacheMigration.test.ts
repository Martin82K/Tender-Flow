import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.resolve(import.meta.dirname, "../supabase/migrations");

describe("DocHub folder cache migration", () => {
  it("repairs the nullable top-level cache key and preserves the primary key", () => {
    const migrationName = fs.readdirSync(migrationsDir)
      .find((name) => name.endsWith("_repair_dochub_folder_cache_keys.sql"));

    expect(migrationName).toBeTruthy();
    const migration = fs.readFileSync(path.join(migrationsDir, migrationName!), "utf8");

    expect(migration).toContain("ALTER COLUMN key SET DEFAULT ''");
    expect(migration).toContain("ALTER COLUMN key SET NOT NULL");
    expect(migration).toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON public.dochub_project_folders TO service_role");
    expect(migration).toContain("ALTER TABLE public.dochub_project_folders ENABLE ROW LEVEL SECURITY");
  });
});
