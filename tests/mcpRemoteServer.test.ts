import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { buildMcpResourceMetadata } from "../server/mcp/response.js";
import { handleMcpWebRequest } from "../server/mcp/tenderFlowMcp.js";
import { checkMcpRateLimit, resetMcpRateLimitsForTests } from "../server/mcp/rateLimit.js";

const ROOT = process.cwd();

describe("remote MCP server", () => {
  afterEach(() => {
    resetMcpRateLimitsForTests();
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

  it("registruje read-only discovery nástroje a oddělený třífázový zápis", () => {
    const source = fs.readFileSync(path.join(ROOT, "server/mcp/tenderFlowMcp.js"), "utf8");

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
});
