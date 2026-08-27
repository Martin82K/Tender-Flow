import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("Microsoft To Do synchronization security boundaries", () => {
  it("keeps the delegated TODO token separate and least-privileged", () => {
    const authUrl = fs.readFileSync(path.join(root, "supabase/functions/dochub-auth-url/index.ts"), "utf8");
    const callback = fs.readFileSync(path.join(root, "supabase/functions/dochub-microsoft-callback/index.ts"), "utf8");
    const tokens = fs.readFileSync(path.join(root, "supabase/functions/_shared/tokens.ts"), "utf8");

    for (const source of [authUrl, callback, tokens]) {
      expect(source).toContain('"todo_sync"');
      expect(source).toContain('"Tasks.ReadWrite"');
    }
    const todoScopes = authUrl.slice(
      authUrl.indexOf("const MICROSOFT_TODO_SCOPES"),
      authUrl.indexOf("const MICROSOFT_MANAGE_SCOPES"),
    );
    expect(todoScopes).toContain('"Tasks.ReadWrite"');
    expect(todoScopes).not.toContain("Files.");
    expect(todoScopes).not.toContain("Sites.");
  });

  it("requires the authenticated user and never returns token material", () => {
    const connection = fs.readFileSync(
      path.join(root, "supabase/functions/microsoft-todo-connection/index.ts"),
      "utf8",
    );
    const sync = fs.readFileSync(
      path.join(root, "supabase/functions/microsoft-todo-sync/index.ts"),
      "utf8",
    );

    for (const source of [connection, sync]) {
      expect(source).toContain("authed.auth.getUser()");
      expect(source).toContain("userData.user.id");
      expect(source).not.toContain('select("token_ciphertext")');
    }
    expect(sync).toContain('accessKind: "todo_sync"');
  });

  it("stores sync state behind RLS and service-role-only grants", () => {
    const migrations = fs.readdirSync(path.join(root, "supabase/migrations"));
    const migrationName = migrations.find((name) => name.endsWith("_microsoft_todo_sync.sql"));
    expect(migrationName).toBeTruthy();
    const migration = fs.readFileSync(path.join(root, "supabase/migrations", migrationName!), "utf8");

    for (const table of ["microsoft_todo_list_mappings", "microsoft_todo_tombstones"]) {
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`REVOKE ALL ON TABLE public.${table} FROM PUBLIC, anon, authenticated`);
      expect(migration).toContain(`GRANT ALL ON TABLE public.${table} TO service_role`);
    }
    expect(migration).toContain("CREATE OR REPLACE FUNCTION private.enqueue_microsoft_todo_tombstone");
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain("external_container_id");
    expect(migration).toContain("external_updated_at");

    const allMigrationSql = migrations
      .map((name) => fs.readFileSync(path.join(root, "supabase/migrations", name), "utf8"))
      .join("\n");
    expect(allMigrationSql).toContain(
      "idx_microsoft_todo_list_mappings_project_id\n  ON public.microsoft_todo_list_mappings(todo_project_id)",
    );
  });
});
