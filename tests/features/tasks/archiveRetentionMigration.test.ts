import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260517173000_task_archive_completed.sql"),
  "utf8",
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
});
