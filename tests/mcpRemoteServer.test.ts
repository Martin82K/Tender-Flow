import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { redactForAudit, summarizeResultForAudit } from "../server/mcp/audit.js";
import { buildMcpResourceMetadata } from "../server/mcp/response.js";
import { validateMcpTokenClaims } from "../server/mcp/supabaseAuth.js";
import { assertProjectVisible, handleMcpWebRequest } from "../server/mcp/tenderFlowMcp.js";
import { checkMcpRateLimit, resetMcpRateLimitsForTests } from "../server/mcp/rateLimit.js";

const ROOT = process.cwd();

describe("remote MCP server", () => {
  afterEach(() => {
    resetMcpRateLimitsForTests();
    vi.unstubAllEnvs();
    delete process.env.MCP_ALLOWED_CLIENT_IDS;
    delete process.env.MCP_ALLOWED_AUDIENCES;
    delete process.env.MCP_REQUIRED_SCOPES;
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
  });

  it("publikuje OAuth protected-resource metadata pro ChatGPT MCP klienty", () => {
    process.env.VITE_SUPABASE_URL = "https://tf-test.supabase.co";

    const metadata = buildMcpResourceMetadata(
      new Request("https://tenderflow.cz/api/mcp", {
        headers: {
          "x-forwarded-host": "tenderflow.cz",
          "x-forwarded-proto": "https",
        },
      }),
    );

    expect(metadata).toEqual({
      resource: "https://tenderflow.cz/api/mcp",
      authorization_servers: ["https://tf-test.supabase.co/auth/v1"],
      bearer_methods_supported: ["header"],
      scopes_supported: ["openid", "email", "profile"],
      resource_documentation: "https://tenderflow.cz/app/settings?tab=tools",
    });
  });

  it("mapuje standardní OAuth protected-resource well-known URL na MCP metadata endpoint", () => {
    const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));

    expect(vercelConfig.rewrites).toEqual(
      expect.arrayContaining([
        {
          source: "/.well-known/oauth-protected-resource",
          destination: "/api/mcp-resource",
        },
        {
          source: "/.well-known/oauth-protected-resource/(.*)",
          destination: "/api/mcp-resource",
        },
      ]),
    );
  });

  it("fail-closed vrací WWW-Authenticate resource metadata bez bearer tokenu", async () => {
    const response = await handleMcpWebRequest(
      new Request("https://tenderflow.cz/api/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      'Bearer resource_metadata="https://tenderflow.cz/api/mcp-resource"',
    );
    await expect(response.json()).resolves.toMatchObject({ error: "unauthorized" });
  });

  it("validuje OAuth klienta, audience, resource a scope fail-closed", () => {
    vi.stubEnv("NODE_ENV", "production");
    const payload = {
      sub: "user-1",
      client_id: "client-1",
      aud: "authenticated",
      resource: "https://tenderflow.cz/api/mcp",
      scope: "openid email profile",
    };

    expect(() => validateMcpTokenClaims(payload, { expectedResource: "https://tenderflow.cz/api/mcp" })).toThrow(
      "MCP_ALLOWED_CLIENT_IDS must be configured in production.",
    );

    vi.stubEnv("MCP_ALLOWED_CLIENT_IDS", "client-2");
    expect(() => validateMcpTokenClaims(payload, { expectedResource: "https://tenderflow.cz/api/mcp" })).toThrow(
      "OAuth client is not allowed for Tender Flow MCP.",
    );

    vi.stubEnv("MCP_ALLOWED_CLIENT_IDS", "client-1");
    expect(validateMcpTokenClaims(payload, { expectedResource: "https://tenderflow.cz/api/mcp" })).toMatchObject({
      userId: "user-1",
      clientId: "client-1",
      scopes: ["openid", "email", "profile"],
    });

    expect(() =>
      validateMcpTokenClaims({ ...payload, resource: "https://evil.example/api/mcp" }, { expectedResource: "https://tenderflow.cz/api/mcp" }),
    ).toThrow("OAuth token resource does not match Tender Flow MCP.");
    expect(() =>
      validateMcpTokenClaims({ ...payload, scope: "openid email" }, { expectedResource: "https://tenderflow.cz/api/mcp" }),
    ).toThrow("OAuth token is missing required MCP scopes: profile.");
  });

  it("rediguje citlivé MCP audit payloady a neukládá celé výsledky execute", () => {
    const requestSummary = redactForAudit({
      proposalId: "proposal-1",
      executeToken: "super-secret-execute-token",
      idempotencyKey: "idempotency-secret",
      nested: { authorization: "Bearer secret" },
    });
    const resultSummary = summarizeResultForAudit({
      ok: true,
      data: {
        proposalId: "proposal-1",
        status: "executed",
        task: {
          id: "task-1",
          title: "Do not store this full title",
          note: "Do not store this full note",
        },
      },
    });

    expect(JSON.stringify(requestSummary)).not.toContain("super-secret-execute-token");
    expect(JSON.stringify(requestSummary)).not.toContain("idempotency-secret");
    expect(JSON.stringify(requestSummary)).not.toContain("Bearer secret");
    expect(resultSummary).toMatchObject({
      ok: true,
      status: "executed",
      proposalId: "proposal-1",
      entityType: "task",
      entityId: "task-1",
    });
    expect(JSON.stringify(resultSummary)).not.toContain("Do not store this full note");
  });

  it("ověří viditelnost projectId před MCP create_task", async () => {
    const makeSupabase = (row: { id: string } | null) => ({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
      })),
    });

    await expect(assertProjectVisible(makeSupabase({ id: "project-1" }), "project-1")).resolves.toBeUndefined();
    await expect(assertProjectVisible(makeSupabase(null), "project-1")).rejects.toThrow(
      "Project is not visible to the authenticated user.",
    );
  });

  it("registruje read-only discovery nástroje a oddělený třífázový zápis", () => {
    const source = fs.readFileSync(path.join(ROOT, "server/mcp/tenderFlowMcp.js"), "utf8").replace(/\r\n/g, "\n");

    expect(source).toContain("server.registerTool(\n    'search'");
    expect(source).toContain("server.registerTool(\n    'fetch'");
    expect(source).toContain("tf_prepare_change");
    expect(source).toContain("tf_confirm_change");
    expect(source).toContain("tf_execute_change");
    expect(source).toContain("tf_list_bids");
    expect(source).toContain("tf_list_winners");
    expect(source).toContain("tf_list_contracts");
    expect(source).toContain("tf_list_tender_plan");
    expect(source).toContain("annotations: { readOnlyHint: true");
    expect(source).toContain("Only create_task execution is enabled in MCP MVP.");
    expect(source).not.toContain("hard_delete");
  });

  it("omezuje volání per user/client/tool", () => {
    const auth = { userId: "user-1", clientId: "client-1" };

    for (let i = 0; i < 12; i += 1) {
      expect(() => checkMcpRateLimit(auth, "tf_execute_change", "high")).not.toThrow();
    }

    expect(() => checkMcpRateLimit(auth, "tf_execute_change", "high")).toThrow(
      "Rate limit exceeded for tf_execute_change",
    );
  });

  it("má databázové guardrails pro audit, návrhy změn a idempotenci execute", () => {
    const migration = fs.readFileSync(
      path.join(ROOT, "supabase/migrations/20260511170000_mcp_remote_server_tables.sql"),
      "utf8",
    );

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.mcp_audit_events");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.mcp_change_proposals");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.mcp_idempotency_keys");
    expect(migration).toContain("UNIQUE (user_id, client_id, idempotency_key)");
    expect(migration).toContain("ALTER TABLE public.mcp_audit_events ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("WITH CHECK (user_id = auth.uid())");
  });

  it("váže MCP stavové RLS na user_id i OAuth client_id", () => {
    const migration = fs.readFileSync(
      path.join(ROOT, "supabase/migrations/20260511183000_mcp_client_scoped_rls.sql"),
      "utf8",
    );

    expect(migration).toContain("ON public.mcp_audit_events");
    expect(migration).toContain("ON public.mcp_change_proposals");
    expect(migration).toContain("ON public.mcp_idempotency_keys");
    expect(migration.match(/client_id = \(auth\.jwt\(\) ->> 'client_id'\)/g)?.length).toBeGreaterThanOrEqual(6);
  });
});
