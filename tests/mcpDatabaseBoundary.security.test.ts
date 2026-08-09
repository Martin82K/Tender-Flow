import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn(() => ({ marker: "mcp-db-client" })));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

const ROOT = process.cwd();

const readBoundaryMigration = () => {
  const migrationName = fs
    .readdirSync(path.join(ROOT, "supabase/migrations"))
    .find((name) => name.endsWith("_mcp_tool_only_database_boundary.sql"));

  expect(migrationName).toBeDefined();
  return fs.readFileSync(
    path.join(ROOT, "supabase/migrations", migrationName as string),
    "utf8",
  );
};

describe("MCP tool-only database boundary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    createClientMock.mockClear();
  });

  it("odmítne vytvořit MCP databázového klienta bez odděleného serverového klíče", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "sb_publishable_public");
    vi.stubEnv("SUPABASE_MCP_SECRET_KEY", "");

    const { createUserSupabaseClient } = await import("../server/mcp/data.js");

    expect(() => createUserSupabaseClient("oauth-user-token")).toThrow(
      "Missing SUPABASE_MCP_SECRET_KEY",
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("stdio nepřijímá obecný Supabase session credential jako fallback", () => {
    const stdio = fs.readFileSync(path.join(ROOT, "scripts/mcp-stdio.js"), "utf8");

    expect(stdio).toContain("process.env.TENDER_FLOW_MCP_ACCESS_TOKEN");
    expect(stdio).not.toContain("process.env.SUPABASE_ACCESS_TOKEN");
    expect(stdio).not.toContain("Local Supabase session token detected");
  });

  it("posílá serverový klíč jen jako apikey a uživatelský JWT jako Authorization", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "sb_publishable_public");
    vi.stubEnv("SUPABASE_MCP_SECRET_KEY", "sb_secret_backend_only");

    const { createUserSupabaseClient } = await import("../server/mcp/data.js");
    createUserSupabaseClient("oauth-user-token");

    expect(createClientMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "sb_secret_backend_only",
      expect.objectContaining({
        global: {
          headers: {
            Authorization: "Bearer oauth-user-token",
          },
        },
      }),
    );
  });

  it("vydává registrovaným MCP klientům izolovanou NOINHERIT roli", () => {
    const migration = readBoundaryMigration();

    expect(migration).toMatch(/CREATE ROLE tenderflow_mcp_client NOLOGIN NOINHERIT/);
    expect(migration).toContain("GRANT tenderflow_mcp_client TO authenticator");
    expect(migration).toContain("'{role}'");
    expect(migration).toContain("TO_JSONB('tenderflow_mcp_client'::TEXT)");
    expect(migration).toMatch(/IF NOT mcp_client_is_registered THEN[\s\S]*RETURN JSONB_BUILD_OBJECT\('claims', claims\)/);
  });

  it("vyžaduje serverový sb_secret i pro starší OAuth token s authenticated rolí", () => {
    const migration = readBoundaryMigration();

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.enforce_mcp_backend_boundary()");
    expect(migration).toContain("auth.jwt() ->> 'client_id'");
    expect(migration).toContain("auth.jwt() ->> 'azp'");
    expect(migration).toMatch(
      /IF current_user = 'tenderflow_mcp_client'\s+OR jwt_client_id IS NOT NULL THEN/,
    );
    expect(migration).toContain("current_user = 'tenderflow_mcp_client'");
    expect(migration).toContain("request.headers");
    expect(migration).toContain("~ '^sb_secret_'");
    expect(migration).toContain("pgrst.db_pre_request");
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.enforce_mcp_backend_boundary\(\)\s+TO anon, authenticated, service_role, tenderflow_mcp_client/,
    );
  });

  it("dává MCP roli jen explicitní toolové tabulky a žádný přístup ke Storage ani Realtime", () => {
    const migration = readBoundaryMigration();

    expect(migration).toContain("REVOKE ALL ON SCHEMA storage FROM tenderflow_mcp_client");
    expect(migration).toContain("REVOKE ALL ON SCHEMA realtime FROM tenderflow_mcp_client");
    expect(migration).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM tenderflow_mcp_client");
    expect(migration).toMatch(/GRANT SELECT ON TABLE\s+public\.projects/);
    expect(migration).toContain("GRANT SELECT, INSERT ON TABLE public.tasks");
    expect(migration).not.toContain("GRANT ALL ON ALL TABLES");
  });

  it("odřízne starší authenticated OAuth token také od Storage a Realtime", () => {
    const migration = readBoundaryMigration();

    expect(migration).toContain('ON storage.objects AS RESTRICTIVE');
    expect(migration).toContain("FROM pg_catalog.pg_publication_tables");
    expect(migration).toContain("published.pubname = 'supabase_realtime'");
    expect(migration).toMatch(/AS RESTRICTIVE\s+FOR ALL TO authenticated/);
    expect(migration).toContain("auth.jwt() ->> 'client_id'");
    expect(migration).toContain("auth.jwt() ->> 'azp'");
  });

  it("odstraňuje všechny historické bezpodmínečné CRUD politiky kontaktů", () => {
    const migration = readBoundaryMigration();

    for (const policy of [
      "Enable read access for authenticated users",
      "Enable insert access for authenticated users",
      "Enable update access for authenticated users",
      "Enable delete access for authenticated users",
      "subcontractors_select_policy",
      "subcontractors_insert_policy",
      "subcontractors_update_policy",
      "subcontractors_delete_policy",
      "Users can insert subcontractors",
    ]) {
      expect(migration).toMatch(new RegExp(
        `DROP POLICY IF EXISTS \"${policy}\"\\s+ON public\\.subcontractors`,
      ));
    }

    expect(migration).toContain('CREATE POLICY "Subcontractors visible to owner or org"');
    expect(migration).toContain("can_write_subcontractor_tenant(owner_id, organization_id)");
  });
});
