import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { logMcpAuditEvent } from "../server/mcp/audit.js";
import { checkMcpRateLimit } from "../server/mcp/rateLimit.js";
import { handleAuthorizedMcpRequest } from "../server/mcp/tenderFlowMcp.js";

const ROOT = process.cwd();
const auth = { userId: "user-1", clientId: "client-1" };

describe("MCP distributed rate limit and audit reliability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
  });

  it("používá atomický databázový limiter a předá risk bucket", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { allowed: true, remaining: 11, retry_after_seconds: 0 },
      error: null,
    });

    await expect(checkMcpRateLimit({ rpc }, auth, "tf_execute_change", "high"))
      .resolves.toMatchObject({ allowed: true, remaining: 11 });
    expect(rpc).toHaveBeenCalledWith("consume_mcp_rate_limit", {
      p_client_id: "client-1",
      p_risk_level: "high",
    });
  });

  it("selže uzavřeně při překročení i nedostupnosti databázového limiteru", async () => {
    const blocked = {
      rpc: vi.fn().mockResolvedValue({
        data: { allowed: false, remaining: 0, retry_after_seconds: 17 },
        error: null,
      }),
    };
    await expect(checkMcpRateLimit(blocked, auth, "tf_execute_change", "high"))
      .rejects.toMatchObject({ retryAfterSeconds: 17 });

    const unavailable = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "08006" } }),
    };
    await expect(checkMcpRateLimit(unavailable, auth, "tf_execute_change", "high"))
      .rejects.toThrow("Rate limit service is unavailable");
  });

  it("detekuje Supabase audit error a umí audit vyžadovat před zápisem", async () => {
    const insert = vi.fn().mockResolvedValue({ error: { code: "42501" } });
    const supabase = { from: vi.fn(() => ({ insert })) };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const event = {
      userId: "user-1",
      clientId: "client-1",
      toolName: "tf_execute_change",
      action: "execute_write_attempt",
      riskLevel: "high",
      success: false,
    };

    await expect(logMcpAuditEvent(supabase, event)).resolves.toMatchObject({ ok: false });
    expect(consoleError).toHaveBeenCalledWith(
      "MCP audit insert failed.",
      expect.objectContaining({
        clientId: "client-1",
        toolName: "tf_execute_change",
        errorCode: "42501",
      }),
    );
    await expect(logMcpAuditEvent(supabase, event, { required: true }))
      .rejects.toThrow("Audit service is unavailable; write was not executed");
  });

  it("má databázový bucket bez přímého authenticated přístupu a pevné limity", () => {
    const migrations = path.join(ROOT, "supabase/migrations");
    const filename = fs.readdirSync(migrations)
      .find((name) => name.endsWith("_mcp_distributed_rate_limit.sql"));

    expect(filename).toBeDefined();
    const migration = fs.readFileSync(path.join(migrations, filename as string), "utf8");
    expect(migration).toContain("CREATE TABLE public.mcp_rate_limit_buckets");
    expect(migration).toContain("ALTER TABLE public.mcp_rate_limit_buckets ENABLE ROW LEVEL SECURITY");
    expect(migration).toMatch(/REVOKE ALL ON TABLE public\.mcp_rate_limit_buckets\s+FROM PUBLIC, anon, authenticated, service_role/);
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.consume_mcp_rate_limit");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("auth.jwt() ->> 'client_id'");
    expect(migration).toContain("auth.jwt() ->> 'azp'");
    expect(migration).toContain("v_client_id <> 'local-stdio'");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.consume_mcp_rate_limit(TEXT, TEXT) TO authenticated");
    expect(migration).toContain("WHEN 'low' THEN 120");
    expect(migration).toContain("WHEN 'medium' THEN 30");
    expect(migration).toContain("WHEN 'high' THEN 12");
  });

  it("vyžaduje úspěšný audit před každou MCP write fází", () => {
    const source = fs.readFileSync(path.join(ROOT, "server/mcp/tenderFlowMcp.js"), "utf8");
    expect(source).toContain("const requiresPreAudit = WRITE_AUDIT_ACTIONS.has(action)");
    expect(source).toContain("action: `${action}_attempt`");
    expect(source).toContain("{ required: true }");
    expect(source).toContain("await checkMcpRateLimit(supabase, auth, toolName, effectiveRiskLevel)");
  });

  it("při výpadku pre-auditu nespustí write proposal handler", async () => {
    vi.stubEnv("SUPABASE_URL", "https://tf-test.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "test-anon-key");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/rpc/consume_mcp_rate_limit")) {
        return new Response(JSON.stringify({
          allowed: true,
          remaining: 29,
          retry_after_seconds: 0,
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.includes("/mcp_audit_events")) {
        return new Response(JSON.stringify({ code: "42501", message: "denied" }), {
          status: 403,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("[]", {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleAuthorizedMcpRequest(
      new Request("https://tenderflow.cz/api/mcp", {
        method: "POST",
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
          "mcp-protocol-version": "2026-07-28",
          "mcp-method": "tools/call",
          "mcp-name": "tf_prepare_change",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "write-audit-failure",
          method: "tools/call",
          params: {
            name: "tf_prepare_change",
            arguments: { change: { type: "create_task", title: "Test" } },
            _meta: {
              "io.modelcontextprotocol/protocolVersion": "2026-07-28",
              "io.modelcontextprotocol/clientInfo": { name: "test", version: "1" },
              "io.modelcontextprotocol/clientCapabilities": {},
            },
          },
        }),
      }),
      {
        token: "test-access-token",
        userId: "user-1",
        clientId: "client-1",
        oauthScopes: ["openid", "email", "profile"],
        permissions: ["tenderflow.read", "tenderflow.write"],
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      },
    );
    const body = await response.json() as {
      result?: { isError?: boolean; structuredContent?: { error?: string } };
    };

    expect(body.result).toMatchObject({
      isError: true,
      structuredContent: {
        error: "Audit service is unavailable; write was not executed.",
      },
    });
    expect(fetchMock.mock.calls.some(([input]) =>
      String(input).includes("/mcp_change_proposals"))).toBe(false);
  });
});
