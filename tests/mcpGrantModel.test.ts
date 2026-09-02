import fs from "fs";
import path from "path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearMcpBackendProofRegistrationCache,
  McpPermissionServiceUnavailableError,
  resolveMcpPermissions,
} from "../server/mcp/permissionGrants.js";
import {
  listMyMcpClientGrants,
  revokeMyMcpClientAccess,
  setMyMcpClientGrant,
} from "../features/settings/api/mcpGrantService";

const ROOT = process.cwd();

const dbAdapterMock = vi.hoisted(() => ({
  rpc: vi.fn(),
  revokeOauthGrant: vi.fn(),
}));

vi.mock("@/services/dbAdapter", () => ({ dbAdapter: dbAdapterMock }));

describe("authoritative MCP user-client grants", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    clearMcpBackendProofRegistrationCache();
  });

  it("resolves only the authoritative permission array returned by the bound RPC", async () => {
    vi.stubEnv("SUPABASE_URL", "https://tf-test.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("SUPABASE_MCP_SECRET_KEY", "sb_secret_test_backend");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("true", { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        "tenderflow.read",
        "tenderflow.contacts.read",
      ]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveMcpPermissions({
      token: "oauth-user-token",
      clientId: "c6d04896-33d1-4cca-a7f2-8d380ed26f0d",
    })).resolves.toEqual([
      "tenderflow.read",
      "tenderflow.contacts.read",
    ]);

    const backendProof = createHash("sha256").update("sb_secret_test_backend").digest("hex");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://tf-test.supabase.co/rest/v1/rpc/register_mcp_backend_proof",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          apikey: "sb_secret_test_backend",
        }),
        body: JSON.stringify({ proof_input: backendProof }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://tf-test.supabase.co/rest/v1/rpc/get_my_mcp_permissions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          apikey: "sb_secret_test_backend",
          Authorization: "Bearer oauth-user-token",
          "x-tenderflow-mcp-proof": backendProof,
        }),
        body: JSON.stringify({
          client_id_input: "c6d04896-33d1-4cca-a7f2-8d380ed26f0d",
        }),
      }),
    );
  });

  it("fails closed on RPC error, missing read or unknown permission", async () => {
    vi.stubEnv("SUPABASE_URL", "https://tf-test.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("SUPABASE_MCP_SECRET_KEY", "sb_secret_test_backend");

    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response("true", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 503 })));
    await expect(resolveMcpPermissions({ token: "token", clientId: "client" }))
      .rejects.toBeInstanceOf(McpPermissionServiceUnavailableError);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify([
      "tenderflow.contacts.read",
    ]), { status: 200 })));
    await expect(resolveMcpPermissions({ token: "token", clientId: "client" }))
      .rejects.toThrow("MCP client is not enabled for read access");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify([
      "tenderflow.read",
      "tenderflow.admin",
    ]), { status: 200 })));
    await expect(resolveMcpPermissions({ token: "token", clientId: "client" }))
      .rejects.toThrow("Permission service returned an unsupported permission");
  });

  it("classifies missing server-side permission configuration as unavailable", async () => {
    vi.stubEnv("SUPABASE_URL", "https://tf-test.supabase.co");
    vi.stubEnv("SUPABASE_MCP_SECRET_KEY", "");

    await expect(resolveMcpPermissions({ token: "token", clientId: "client" }))
      .rejects.toBeInstanceOf(McpPermissionServiceUnavailableError);
  });

  it("uses authenticated settings RPCs without accepting a user id", async () => {
    dbAdapterMock.rpc.mockResolvedValueOnce({
      data: [{
        client_id: "client-1",
        client_name: "ChatGPT",
        client_uri: null,
        contacts_read_expires_at: null,
        write_expires_at: null,
        bid_offer_write_expires_at: null,
      }],
      error: null,
    });

    await expect(listMyMcpClientGrants()).resolves.toEqual([
      expect.objectContaining({ clientId: "client-1", clientName: "ChatGPT" }),
    ]);
    expect(dbAdapterMock.rpc).toHaveBeenCalledWith("list_my_mcp_client_grants");

    dbAdapterMock.rpc.mockResolvedValueOnce({
      data: [{ permission: "tenderflow.write", enabled: true, expires_at: "2026-08-09T10:00:00Z" }],
      error: null,
    });
    await setMyMcpClientGrant("client-1", "tenderflow.write", true);
    expect(dbAdapterMock.rpc).toHaveBeenCalledWith("set_my_mcp_client_grant", {
      client_id_input: "client-1",
      permission_input: "tenderflow.write",
      enabled_input: true,
    });

    dbAdapterMock.rpc.mockResolvedValueOnce({
      data: [{ permission: "tenderflow.bids.offer.write", enabled: true, expires_at: "infinity" }],
      error: null,
    });
    await setMyMcpClientGrant("client-1", "tenderflow.bids.offer.write", true);
    expect(dbAdapterMock.rpc).toHaveBeenCalledWith("set_my_mcp_client_grant", {
      client_id_input: "client-1",
      permission_input: "tenderflow.bids.offer.write",
      enabled_input: true,
    });
  });

  it("revokes the authenticated user's exact OAuth client grant", async () => {
    dbAdapterMock.revokeOauthGrant.mockResolvedValueOnce({ data: {}, error: null });

    await expect(revokeMyMcpClientAccess("client-1")).resolves.toBeUndefined();
    expect(dbAdapterMock.revokeOauthGrant).toHaveBeenCalledWith("client-1");
  });

  it("fails safely when OAuth client revocation is rejected", async () => {
    dbAdapterMock.revokeOauthGrant.mockResolvedValueOnce({
      data: null,
      error: { message: "Odpojení OAuth klienta se nepodařilo." },
    });

    await expect(revokeMyMcpClientAccess("client-1"))
      .rejects.toThrow("Odpojení OAuth klienta se nepodařilo.");
  });

  it("migration keeps grants private, expiring, audited and JWT client-bound", () => {
    const migrationDir = path.join(ROOT, "supabase/migrations");
    const filename = fs.readdirSync(migrationDir)
      .find((name) => name.endsWith("_mcp_authoritative_user_client_grants.sql"));

    expect(filename).toBeDefined();
    const migration = fs.readFileSync(path.join(migrationDir, filename as string), "utf8");
    const lifecycleFilename = fs.readdirSync(migrationDir)
      .find((name) => name.endsWith("_fix_mcp_grant_lifecycle.sql"));
    expect(lifecycleFilename).toBeDefined();
    const lifecycleMigration = fs.readFileSync(
      path.join(migrationDir, lifecycleFilename as string),
      "utf8",
    );
    expect(migration).toContain("CREATE TABLE public.mcp_user_client_grants");
    expect(migration).toContain("CREATE TABLE public.mcp_permission_grant_audit");
    expect(migration).toContain("ALTER TABLE public.mcp_user_client_grants ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("ALTER TABLE public.mcp_permission_grant_audit ENABLE ROW LEVEL SECURITY");
    expect(migration).toMatch(/REVOKE ALL ON TABLE public\.mcp_user_client_grants\s+FROM PUBLIC, anon, authenticated/);
    expect(migration).toMatch(/REVOKE ALL ON TABLE public\.mcp_permission_grant_audit\s+FROM PUBLIC, anon, authenticated/);
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_my_mcp_permissions");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.list_my_mcp_client_grants");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.set_my_mcp_client_grant");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("auth.jwt() ->> 'client_id'");
    expect(migration).toContain("auth.jwt() ->> 'azp'");
    expect(migration).toContain("mcp_oauth_client_resources");
    expect(migration).toContain("'tenderflow.contacts.read'");
    expect(migration).toContain("'tenderflow.write'");
    expect(migration).toContain("INTERVAL '30 days'");
    expect(migration).toContain("INTERVAL '8 hours'");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.get_my_mcp_permissions(UUID) TO authenticated");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.list_my_mcp_client_grants() TO authenticated");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.set_my_mcp_client_grant(UUID, TEXT, BOOLEAN) TO authenticated");
    expect(migration.match(/JOIN auth\.oauth_consents AS oauth_consent/g)).toHaveLength(3);
    expect(migration).toContain("oauth_consent.user_id = caller_id");
    expect(migration).toContain("oauth_consent.revoked_at IS NULL");
    expect(lifecycleMigration).toContain("ADD COLUMN consent_id UUID");
    expect(lifecycleMigration).toContain("ADD COLUMN consent_granted_at TIMESTAMPTZ");
    expect(lifecycleMigration).toContain("ALTER COLUMN consent_id SET NOT NULL");
    expect(lifecycleMigration).toContain("grant_row.consent_id");
    expect(lifecycleMigration).toContain("grant_row.consent_granted_at");
    expect(lifecycleMigration).toContain("pg_advisory_xact_lock");
    expect(lifecycleMigration).toContain(
      "DROP CONSTRAINT IF EXISTS mcp_permission_grant_audit_client_id_fkey",
    );
  });

  it("keeps write permission until explicit revoke without weakening consent binding", () => {
    const migrationDir = path.join(ROOT, "supabase/migrations");
    const filename = fs.readdirSync(migrationDir)
      .find((name) => name.endsWith("_mcp_persistent_write_grant.sql"));

    expect(filename).toBeDefined();
    const migration = fs.readFileSync(path.join(migrationDir, filename as string), "utf8");
    expect(migration).toContain("'infinity'::TIMESTAMPTZ");
    expect(migration).toContain("permission_input = 'tenderflow.write'");
    expect(migration).toContain("oauth_consent.id");
    expect(migration).toContain("oauth_consent.granted_at");
    expect(migration).toContain("MCP grant management requires a first-party Tender Flow session");
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.set_my_mcp_client_grant/);
    expect(migration).toContain("TO authenticated");
    expect(migration).not.toContain("TO tenderflow_mcp_client");
  });

  it("allows grant management only from a first-party Tender Flow session", () => {
    const migrationDir = path.join(ROOT, "supabase/migrations");
    const filename = fs.readdirSync(migrationDir)
      .find((name) => name.endsWith("_mcp_authoritative_user_client_grants.sql"));

    expect(filename).toBeDefined();
    const migration = fs.readFileSync(path.join(migrationDir, filename as string), "utf8");
    const managementFunctions = [
      "list_my_mcp_client_grants",
      "set_my_mcp_client_grant",
    ].map((functionName) => {
      const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${functionName}`);
      const end = migration.indexOf("\n$$;", start);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeGreaterThan(start);
      return migration.slice(start, end);
    });

    for (const functionSql of managementFunctions) {
      expect(functionSql).toContain("auth.jwt() ->> 'client_id'");
      expect(functionSql).toContain("auth.jwt() ->> 'azp'");
      expect(functionSql).toContain("MCP grant management requires a first-party Tender Flow session");
      expect(functionSql).toMatch(/IF jwt_client_id IS NOT NULL THEN[\s\S]*ERRCODE = '42501'/);
    }
  });

  it("adds covering indexes for every new non-leading foreign key", () => {
    const migrationDir = path.join(ROOT, "supabase/migrations");
    const filename = fs.readdirSync(migrationDir)
      .find((name) => name.endsWith("_mcp_grant_fk_indexes.sql"));

    expect(filename).toBeDefined();
    const migration = fs.readFileSync(path.join(migrationDir, filename as string), "utf8");
    expect(migration).toContain("idx_mcp_user_client_grants_client_id");
    expect(migration).toContain("ON public.mcp_user_client_grants(client_id)");
    expect(migration).toContain("idx_mcp_user_client_grants_granted_by");
    expect(migration).toContain("ON public.mcp_user_client_grants(granted_by)");
    expect(migration).toContain("idx_mcp_permission_grant_audit_client_id");
    expect(migration).toContain("ON public.mcp_permission_grant_audit(client_id)");
    expect(migration).toContain("idx_mcp_permission_grant_audit_actor_user_id");
    expect(migration).toContain("ON public.mcp_permission_grant_audit(actor_user_id)");
  });
});
