import { readdirSync, readFileSync } from "node:fs";
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
const idempotencyMigrationPath = join(
  process.cwd(),
  "supabase/migrations/20260828101027_fix_todo_sync_idempotency.sql",
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

  it("ruční úklid zachová aktivní podúkoly a vymaže opravdu všechny hotové úkoly", () => {
    const idempotencyMigration = readFileSync(idempotencyMigrationPath, "utf8");

    expect(idempotencyMigration).toContain("CREATE OR REPLACE FUNCTION public.delete_my_completed_tasks()");
    expect(idempotencyMigration).toContain("UPDATE public.tasks AS child");
    expect(idempotencyMigration).toContain("child.completed = FALSE");
    expect(idempotencyMigration).toContain("parent.completed = TRUE");
    expect(idempotencyMigration).toContain("parent_task_id = NULL");
    expect(idempotencyMigration).toContain("sync_status = 'pending'");
    expect(idempotencyMigration).toMatch(/DELETE FROM public\.tasks AS task[\s\S]*task\.completed = TRUE/);
    expect(idempotencyMigration).not.toContain("child.completed = FALSE\n       )");
    expect(idempotencyMigration).toContain("SECURITY INVOKER");
    expect(idempotencyMigration).toContain("GRANT EXECUTE ON FUNCTION public.delete_my_completed_tasks() TO authenticated");
  });

  it("ruční úklid maže jen osobní úkoly a nedotýká se zakázek", () => {
    const migrationName = readdirSync(join(process.cwd(), "supabase/migrations"))
      .find((name) => name.endsWith("_fix_completed_personal_cleanup.sql"));

    expect(migrationName).toBeDefined();
    const cleanupMigration = readFileSync(
      join(process.cwd(), "supabase/migrations", migrationName ?? ""),
      "utf8",
    );
    const manualCleanupFunction = cleanupMigration
      .split("CREATE OR REPLACE FUNCTION public.delete_my_completed_tasks()")[1]
      ?.split("REVOKE ALL ON FUNCTION public.delete_my_completed_tasks()")[0] ?? "";

    expect(manualCleanupFunction).toContain("parent.project_id IS NULL");
    expect(manualCleanupFunction).toContain("child.project_id IS NULL");
    expect(manualCleanupFunction).toMatch(
      /DELETE FROM public\.tasks AS task[\s\S]*task\.completed = TRUE[\s\S]*task\.project_id IS NULL/,
    );
    expect(manualCleanupFunction).toMatch(
      /task\.parent_task_id IS NULL[\s\S]*parent\.project_id IS NULL/,
    );
    expect(manualCleanupFunction).toContain("SECURITY INVOKER");
  });

  it("ruční úklid zachová osobního rodiče s projektovým podúkolem", () => {
    const migrationName = readdirSync(join(process.cwd(), "supabase/migrations"))
      .find((name) => name.endsWith("_preserve_project_subtasks_cleanup.sql"));

    expect(migrationName).toBeDefined();
    const cleanupMigration = readFileSync(
      join(process.cwd(), "supabase/migrations", migrationName ?? ""),
      "utf8",
    );
    const manualCleanupFunction = cleanupMigration
      .split("CREATE OR REPLACE FUNCTION public.delete_my_completed_tasks()")[1]
      ?.split("REVOKE ALL ON FUNCTION public.delete_my_completed_tasks()")[0] ?? "";

    expect(manualCleanupFunction).toMatch(
      /NOT EXISTS \([\s\S]*child\.parent_task_id = task\.id[\s\S]*child\.project_id IS NOT NULL/,
    );
    expect(manualCleanupFunction).toContain("SECURITY INVOKER");
  });
});
