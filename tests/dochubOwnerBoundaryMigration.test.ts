import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260807163000_protect_dochub_project_settings.sql",
);

describe("DocHub project settings ownership boundary", () => {
  it("rejects DocHub column changes by a non-owner at the database boundary", () => {
    const migration = fs.readFileSync(migrationPath, "utf8");

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.enforce_dochub_owner_updates");
    expect(migration).toContain("jsonb_each(to_jsonb(OLD))");
    expect(migration).toContain("LIKE 'dochub\\_%'");
    expect(migration).toContain("OLD.owner_id IS DISTINCT FROM auth.uid()");
    expect(migration).toContain("OLD.owner_id IS DISTINCT FROM NEW.owner_id");
    expect(migration).toContain("current_user <> 'postgres'");
    expect(migration.match(/current_user <> 'postgres'/g)).toHaveLength(2);
    expect(migration).toContain("BEFORE UPDATE ON public.projects");
  });
});
