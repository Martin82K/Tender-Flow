import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260517173000_task_archive_completed.sql"),
  "utf8",
);
const retentionMigrationPath = join(
  process.cwd(),
  "supabase/migrations/20260828082623_completed_task_retention.sql",
);

describe("task archive retention migration", () => {
  it("archivuje dokončené úkoly až po 30 dnech", () => {
    expect(migration).toContain("retention_days INTEGER DEFAULT 30");
    expect(migration).toContain("COALESCE(retention_days, 30)");
    expect(migration).toContain("'archive_completed_tasks_30d_daily'");
    expect(migration).toContain("select public.archive_completed_tasks(30);");
  });

  it("maže archivované úkoly až po 30 dnech servisní funkcí", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.delete_archived_tasks(retention_days INTEGER DEFAULT 30)");
    expect(migration).toContain("archived_at < timezone('utc'::text, now()) - make_interval(days => v_days)");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.delete_archived_tasks(INTEGER) TO service_role");
    expect(migration).toContain("select public.delete_archived_tasks(30);");
  });

  it("nahrazuje archivaci bezpečným smazáním dokončených úkolů po 14 dnech", () => {
    const retentionMigration = readFileSync(retentionMigrationPath, "utf8");

    expect(retentionMigration).toContain("CREATE OR REPLACE FUNCTION public.purge_completed_tasks(retention_days INTEGER DEFAULT 14)");
    expect(retentionMigration).toContain("v_cutoff TIMESTAMPTZ := timezone('utc'::text, now()) - make_interval(days => v_days)");
    expect(retentionMigration).toContain("task.completed_at < v_cutoff");
    expect(retentionMigration).toContain("completed = TRUE");
    expect(retentionMigration).toContain("ADD COLUMN IF NOT EXISTS sync_policy_version SMALLINT NOT NULL DEFAULT 1");
    expect(retentionMigration).toContain("GRANT EXECUTE ON FUNCTION public.purge_completed_tasks(INTEGER) TO service_role");
    expect(retentionMigration).toContain("CREATE OR REPLACE FUNCTION public.delete_my_completed_tasks()");
    expect(retentionMigration).toContain("created_by = (SELECT auth.uid())");
    expect(retentionMigration).toContain("GRANT EXECUTE ON FUNCTION public.delete_my_completed_tasks() TO authenticated");
    const manualCleanupFunction = retentionMigration
      .split("CREATE OR REPLACE FUNCTION public.delete_my_completed_tasks()")[1]
      ?.split("REVOKE ALL ON FUNCTION public.delete_my_completed_tasks()")[0] ?? "";
    expect(manualCleanupFunction).toContain("SECURITY INVOKER");
    expect(manualCleanupFunction).not.toContain("SECURITY DEFINER");
    expect(manualCleanupFunction).toContain("child.completed = FALSE");
    expect(retentionMigration).toContain("select public.purge_completed_tasks(14);");
    expect(retentionMigration).toContain("cron.unschedule");
  });
});
