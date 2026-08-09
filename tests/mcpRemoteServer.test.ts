import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { redactForAudit, summarizeResultForAudit } from "../server/mcp/audit.js";
import { buildMcpResourceMetadata } from "../server/mcp/response.js";
import { validateMcpTokenClaims } from "../server/mcp/supabaseAuth.js";
import { McpPermissionServiceUnavailableError } from "../server/mcp/permissionGrants.js";
import {
  assertProjectVisible,
  handleAuthorizedMcpRequest,
  handleMcpWebRequest,
  mcpAuthenticationFailureResponse,
} from "../server/mcp/tenderFlowMcp.js";
import { checkMcpRateLimit, resetMcpRateLimitsForTests } from "../server/mcp/rateLimit.js";

const ROOT = process.cwd();

const callAuthorizedMcp = async (
  method: string,
  params: Record<string, unknown>,
  oauthScopes: string[],
  permissions: string[],
) => {
  const response = await handleAuthorizedMcpRequest(
    new Request("https://tenderflow.cz/api/mcp", {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-protocol-version": "2026-07-28",
        "mcp-method": method,
        ...(typeof params.uri === "string" ? { "mcp-name": params.uri } : {}),
        ...(typeof params.name === "string" ? { "mcp-name": params.name } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `test-${method}`,
        method,
        params: {
          ...params,
          _meta: {
            "io.modelcontextprotocol/protocolVersion": "2026-07-28",
            "io.modelcontextprotocol/clientInfo": { name: "Tender Flow test", version: "1.0.0" },
            "io.modelcontextprotocol/clientCapabilities": {},
          },
        },
      }),
    }),
    {
      token: "test-access-token",
      userId: "user-1",
      clientId: "client-1",
      oauthScopes,
      permissions,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    },
  );
  const body = await response.json() as { result: Record<string, unknown> };
  expect(response.status, JSON.stringify(body)).toBe(200);
  return body;
};

describe("remote MCP server", () => {
  afterEach(() => {
    resetMcpRateLimitsForTests();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    delete process.env.MCP_ALLOWED_CLIENT_IDS;
    delete process.env.MCP_ALLOWED_AUDIENCES;
    delete process.env.MCP_REQUIRED_SCOPES;
    delete process.env.MCP_ALLOWED_ORIGINS;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_MCP_SECRET_KEY;
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
      scopes_supported: [
        "openid",
        "email",
        "profile",
      ],
      resource_documentation: "https://tenderflow.cz/app/settings?tab=tools&subTab=mcp",
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
      'Bearer resource_metadata="https://tenderflow.cz/api/mcp-resource", scope="openid"',
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({ error: "unauthorized" });
  });

  it("loguje odmítnutí OAuth tokenu bez Authorization hodnoty", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await handleMcpWebRequest(
      new Request("https://tenderflow.cz/api/mcp", {
        method: "POST",
        headers: {
          authorization: "Basic super-secret-credential",
          "content-type": "application/json",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      }),
    );

    expect(response.status).toBe(401);
    expect(warn).toHaveBeenCalledOnce();
    const logOutput = JSON.stringify(warn.mock.calls);
    expect(logOutput).toContain("mcp_auth_rejected");
    expect(logOutput).toContain("missing_bearer");
    expect(logOutput).not.toContain("super-secret-credential");
    expect(logOutput).not.toContain("authorization");
  });

  it("mapuje výpadek permission resolveru na 503 bez OAuth challenge", async () => {
    const response = mcpAuthenticationFailureResponse(
      new Request("https://tenderflow.cz/api/mcp"),
      new McpPermissionServiceUnavailableError(),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("www-authenticate")).toBeNull();
    await expect(response.json()).resolves.toMatchObject({
      error: "mcp_auth_service_unavailable",
    });
  });

  it("validuje OAuth klienta, audience, resource a standardní scope fail-closed", () => {
    vi.stubEnv("NODE_ENV", "production");
    const payload = {
      sub: "user-1",
      client_id: "client-1",
      role: "tenderflow_mcp_client",
      aud: "authenticated",
      app_metadata: { mcp_resource: "https://tenderflow.cz/api/mcp" },
      scope: "openid email profile",
    };

    expect(() => validateMcpTokenClaims(
      { ...payload, role: "authenticated" },
      { expectedResource: "https://tenderflow.cz/api/mcp" },
    )).toThrow("OAuth token is not restricted to the Tender Flow MCP database role");

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
      oauthScopes: ["openid", "email", "profile"],
    });
    expect(validateMcpTokenClaims(payload, { expectedResource: "https://tenderflow.cz/api/mcp" }))
      .not.toHaveProperty("permissions");

    expect(validateMcpTokenClaims({
      ...payload,
      scope: "openid email profile tenderflow.contacts.read tenderflow.write",
    }, { expectedResource: "https://tenderflow.cz/api/mcp" })).toMatchObject({
      oauthScopes: ["openid", "email", "profile", "tenderflow.contacts.read", "tenderflow.write"],
    });

    expect(() =>
      validateMcpTokenClaims({ ...payload, app_metadata: { mcp_resource: "https://evil.example/api/mcp" } }, { expectedResource: "https://tenderflow.cz/api/mcp" }),
    ).toThrow("OAuth token resource does not match Tender Flow MCP.");
    vi.stubEnv("MCP_REQUIRED_SCOPES", "openid email profile");
    expect(() =>
      validateMcpTokenClaims({ ...payload, scope: "openid email" }, { expectedResource: "https://tenderflow.cz/api/mcp" }),
    ).toThrow("OAuth token is missing required MCP scopes: profile.");

    vi.stubEnv("MCP_REQUIRED_SCOPES", "openid tenderflow.write");
    expect(() =>
      validateMcpTokenClaims(payload, { expectedResource: "https://tenderflow.cz/api/mcp" }),
    ).toThrow("MCP_REQUIRED_SCOPES contains unsupported OAuth scopes: tenderflow.write.");
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

    expect(source).toContain("registerScopedTool(server, auth,\n    'search'");
    expect(source).toContain("registerScopedTool(server, auth,\n    'fetch'");
    expect(source).toContain("tf_prepare_change");
    expect(source).toContain("tf_confirm_change");
    expect(source).toContain("tf_execute_change");
    expect(source).toContain("tf_list_bids");
    expect(source).toContain("tf_list_winners");
    expect(source).toContain("tf_list_contracts");
    expect(source).toContain("tf_get_contract_overview");
    expect(source).toContain("tf_list_tender_plan");
    expect(source).toContain("annotations: { readOnlyHint: true");
    expect(source).toContain("Only create_task execution is enabled in MCP MVP.");
    expect(source).not.toContain("hard_delete");
  });

  it("zveřejňuje remote pouze obecné read-only nástroje podle interních permissions", async () => {
    vi.stubEnv("SUPABASE_URL", "https://tf-test.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("SUPABASE_MCP_SECRET_KEY", "sb_secret_test_backend");

    const identityOnly = await callAuthorizedMcp("tools/list", {}, ["openid"], []);
    expect(identityOnly.result.tools).toEqual([]);

    const readOnly = await callAuthorizedMcp(
      "tools/list",
      {},
      ["openid", "email", "profile"],
      ["tenderflow.read"],
    );
    const readNames = (readOnly.result.tools as Array<{ name: string }>).map((tool) => tool.name);
    expect(readNames).toContain("search");
    expect(readNames).toContain("fetch");
    expect(readNames).toContain("tf_list_projects");
    expect(readNames).toContain("tf_get_project_summary");
    expect(readNames).toContain("tf_get_contract_overview");
    expect(readNames).toContain("tf_list_tasks");
    expect(readNames).not.toContain("tf_list_contacts");
    expect(readNames).not.toContain("tf_execute_change");

    const forgedScopes = await callAuthorizedMcp(
      "tools/list",
      {},
      ["openid", "tenderflow.read", "tenderflow.contacts.read", "tenderflow.write"],
      ["tenderflow.read"],
    );
    const forgedNames = (forgedScopes.result.tools as Array<{ name: string }>).map((tool) => tool.name);
    expect(forgedNames).toContain("search");
    expect(forgedNames).toContain("fetch");
    expect(forgedNames).not.toContain("tf_list_contacts");
    expect(forgedNames).not.toContain("tf_prepare_change");
    expect(forgedNames).not.toContain("tf_execute_change");
  });

  it("publikuje u každého dostupného toolu OAuth security scheme pro ChatGPT", async () => {
    vi.stubEnv("SUPABASE_URL", "https://tf-test.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("SUPABASE_MCP_SECRET_KEY", "sb_secret_test_backend");

    const catalog = await callAuthorizedMcp(
      "tools/list",
      {},
      ["openid", "email", "profile"],
      ["tenderflow.read", "tenderflow.contacts.read", "tenderflow.write"],
    );
    const tools = catalog.result.tools as Array<{
      securitySchemes?: unknown;
      _meta?: Record<string, unknown>;
    }>;

    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      const expectedSchemes = [{ type: "oauth2", scopes: ["openid"] }];
      expect(tool._meta?.securitySchemes).toEqual(expectedSchemes);
      expect(JSON.stringify(tool._meta?.securitySchemes)).not.toContain("tenderflow.contacts.read");
      expect(JSON.stringify(tool._meta?.securitySchemes)).not.toContain("tenderflow.write");
    }
  });

  it("publikuje privátní resource katalog a scope-filtered URI templates", async () => {
    vi.stubEnv("SUPABASE_URL", "https://tf-test.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("SUPABASE_MCP_SECRET_KEY", "sb_secret_test_backend");

    const resources = await callAuthorizedMcp("resources/list", {}, ["openid"], []);
    expect(resources.result.resources).toEqual([
      expect.objectContaining({
        name: "tender-flow-catalog",
        uri: "tenderflow://catalog",
      }),
    ]);

    const readTemplates = await callAuthorizedMcp("resources/templates/list", {}, [
      "openid",
      "email",
      "profile",
    ], ["tenderflow.read"]);
    const readTemplateNames = (
      readTemplates.result.resourceTemplates as Array<{ name: string }>
    ).map((resource) => resource.name);
    expect(readTemplateNames).toContain("tender-flow-contract-overview");
    expect(readTemplateNames).toContain("tender-flow-project");

    const contactTemplates = await callAuthorizedMcp(
      "resources/templates/list",
      {},
      ["openid", "tenderflow.contacts.read"],
      ["tenderflow.read"],
    );
    const contactTemplateNames = (
      contactTemplates.result.resourceTemplates as Array<{ name: string }>
    ).map((resource) => resource.name);
    expect(contactTemplateNames).toEqual([
      "tender-flow-project",
      "tender-flow-contract-overview",
    ]);
  });

  it("obecný search a contact fetch bez contacts permission nenačítají subcontractors", async () => {
    vi.stubEnv("SUPABASE_URL", "https://tf-test.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("SUPABASE_MCP_SECRET_KEY", "sb_secret_test_backend");
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/rpc/consume_mcp_rate_limit")) {
        return new Response(JSON.stringify({
          allowed: true,
          remaining: 119,
          retry_after_seconds: 0,
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response("[]", {
        status: url.includes("/mcp_audit_events") ? 201 : 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const searchResponse = await callAuthorizedMcp(
      "tools/call",
      { name: "search", arguments: { query: "fasáda" } },
      ["openid", "email", "profile"],
      ["tenderflow.read"],
    );
    expect(searchResponse.result).toMatchObject({ isError: false });

    const fetchResponse = await callAuthorizedMcp(
      "tools/call",
      { name: "fetch", arguments: { id: "contact:contact-1" } },
      ["openid", "email", "profile"],
      ["tenderflow.read"],
    );
    expect(fetchResponse.result).toMatchObject({
      structuredContent: { ok: false, error: "Unknown fetch id." },
    });
    expect(fetchMock.mock.calls.some(([input]) =>
      String(input).includes("/subcontractors"))).toBe(false);
  });

  it("čte katalog jako privátní MCP 2.0 resource a audituje požadavek bez tokenu v logu", async () => {
    vi.stubEnv("SUPABASE_URL", "https://tf-test.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("SUPABASE_MCP_SECRET_KEY", "sb_secret_test_backend");
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      if (String(input).includes("/rpc/consume_mcp_rate_limit")) {
        return new Response(JSON.stringify({
          allowed: true,
          remaining: 119,
          retry_after_seconds: 0,
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("[]", {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await callAuthorizedMcp(
      "resources/read",
      { uri: "tenderflow://catalog" },
      ["openid"],
      [],
    );

    expect(response.result).toMatchObject({
      cacheScope: "private",
      ttlMs: 300_000,
      contents: [
        expect.objectContaining({
          uri: "tenderflow://catalog",
          mimeType: "application/json",
        }),
      ],
    });
    const catalog = JSON.parse(
      (response.result.contents as Array<{ text: string }>)[0].text,
    );
    expect(catalog).toMatchObject({
      protocolVersion: "2026-07-28",
      oauthScopes: {
        identity: "openid",
        email: "email",
        profile: "profile",
      },
      permissions: {
        read: "tenderflow.read",
        contactsRead: "tenderflow.contacts.read",
        write: "tenderflow.write",
      },
    });
    expect(fetchMock).toHaveBeenCalled();
    const auditCall = fetchMock.mock.calls.find(([input]) =>
      String(input).includes("/mcp_audit_events"));
    const auditBody = String(auditCall?.[1]?.body || "");
    expect(auditBody).toContain("resource:catalog");
    expect(auditBody).not.toContain("test-access-token");
  });

  it("čte smluvní přehled přes RLS-aware RPC resource bez interních storage cest", async () => {
    vi.stubEnv("SUPABASE_URL", "https://tf-test.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("SUPABASE_MCP_SECRET_KEY", "sb_secret_test_backend");
    const organizationId = "11111111-1111-4111-8111-111111111111";
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/rpc/consume_mcp_rate_limit")) {
        return new Response(JSON.stringify({
          allowed: true,
          remaining: 119,
          retry_after_seconds: 0,
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/rpc/get_contract_overview")) {
        return new Response(JSON.stringify([{
          organization_id: organizationId,
          project_id: "project-1",
          project_name: "Administrativní centrum",
          project_status: "active",
          contract_id: "22222222-2222-4222-8222-222222222222",
          contract_partner: "Dodavatel s.r.o.",
          contract_title: "Generální dodávka",
          contract_status: "signed",
          currency: "CZK",
          base_price: 1000,
          current_total: 1000,
          approved_drawdown: 250,
          remaining_amount: 750,
          document_storage_path: "tenant/private/contract.pdf",
          document_file_name: "smlouva.pdf",
          amendments: [],
        }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("[]", {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await callAuthorizedMcp(
      "resources/read",
      { uri: `tenderflow://organizations/${organizationId}/contracts/overview` },
      ["openid", "email", "profile"],
      ["tenderflow.read"],
    );

    const contents = response.result.contents as Array<{ text: string }>;
    const rows = JSON.parse(contents[0].text);
    expect(rows).toEqual([
      expect.objectContaining({
        organizationId,
        contractTitle: "Generální dodávka",
        hasDocument: true,
        documentFileName: "smlouva.pdf",
      }),
    ]);
    expect(contents[0].text).not.toContain("tenant/private");
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/rpc/get_contract_overview"))).toBe(true);
  });

  it("používá MCP 2.0 server pro protokol 2026-07-28", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    const source = fs.readFileSync(path.join(ROOT, "server/mcp/tenderFlowMcp.js"), "utf8").replace(/\r\n/g, "\n");
    const stdioSource = fs.readFileSync(path.join(ROOT, "scripts/mcp-stdio.js"), "utf8").replace(/\r\n/g, "\n");

    expect(pkg.dependencies["@modelcontextprotocol/server"]).toBe("2.0.0");
    expect(pkg.dependencies["@modelcontextprotocol/sdk"]).toBeUndefined();
    expect(source).toContain("import { createMcpHandler, McpServer, ResourceTemplate } from '@modelcontextprotocol/server';");
    expect(source).toContain("createMcpHandler");
    expect(stdioSource).toContain("serveStdio");
  });

  it("obslouží moderní server/discover bez legacy initialize session", async () => {
    vi.stubEnv("SUPABASE_URL", "https://tf-test.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("SUPABASE_MCP_SECRET_KEY", "sb_secret_test_backend");
    const response = await handleAuthorizedMcpRequest(
      new Request("https://tenderflow.cz/api/mcp", {
        method: "POST",
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
          "mcp-protocol-version": "2026-07-28",
          "mcp-method": "server/discover",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "discover-1",
          method: "server/discover",
          params: {
            _meta: {
              "io.modelcontextprotocol/protocolVersion": "2026-07-28",
              "io.modelcontextprotocol/clientInfo": { name: "Tender Flow test", version: "1.0.0" },
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
        permissions: ["tenderflow.read"],
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: "discover-1",
      result: {
        resultType: "complete",
        supportedVersions: ["2026-07-28"],
      },
    });
  });

  it("odmítne nedůvěryhodný browser Origin před autentizací", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MCP_ALLOWED_ORIGINS", "https://chatgpt.com");

    const rejected = await handleMcpWebRequest(
      new Request("https://tenderflow.cz/api/mcp", {
        method: "POST",
        headers: { origin: "https://evil.example", "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "server/discover" }),
      }),
    );
    expect(rejected.status).toBe(403);
    await expect(rejected.json()).resolves.toMatchObject({ error: "forbidden_origin" });

    const allowed = await handleMcpWebRequest(
      new Request("https://tenderflow.cz/api/mcp", {
        method: "POST",
        headers: { origin: "https://chatgpt.com", "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "server/discover" }),
      }),
    );
    expect(allowed.status).toBe(401);
    expect(allowed.headers.get("access-control-allow-origin")).toBe("https://chatgpt.com");
  });

  it("má lokální stdio entrypoint pro Claude Code/Codex jen s dedikovaným OAuth tokenem", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    const source = fs.readFileSync(path.join(ROOT, "scripts/mcp-stdio.js"), "utf8").replace(/\r\n/g, "\n");
    const mcpConfig = JSON.parse(fs.readFileSync(path.join(ROOT, ".mcp.json"), "utf8"));
    const serverSource = fs.readFileSync(path.join(ROOT, "server/mcp/tenderFlowMcp.js"), "utf8").replace(/\r\n/g, "\n");

    expect(pkg.scripts["mcp:stdio"]).toBe("node scripts/mcp-stdio.js");
    expect(mcpConfig.mcpServers["tender-flow"]).toEqual({
      type: "http",
      url: "https://www.tenderflow.cz/api/mcp",
    });
    expect(source).toContain("verifyLocalMcpAccessToken");
    expect(source).toContain("const accessToken = process.env.TENDER_FLOW_MCP_ACCESS_TOKEN");
    expect(source).not.toContain("process.env.SUPABASE_ACCESS_TOKEN");
    expect(source).toContain("const includeWriteTools = !readOnly");
    expect(serverSource).toContain("const includeWriteTools = options.includeWriteTools !== false;");
    expect(serverSource).toContain("if (!includeWriteTools) {\n    return server;\n  }");
  });

  it("omezuje volání distribuovaně per user/client/risk bucket", async () => {
    const auth = { userId: "user-1", clientId: "client-1" };
    let count = 0;
    const supabase = {
      rpc: vi.fn().mockImplementation(async () => {
        count += 1;
        return {
          data: {
            allowed: count <= 12,
            remaining: Math.max(12 - count, 0),
            retry_after_seconds: count <= 12 ? 0 : 42,
          },
          error: null,
        };
      }),
    };

    for (let i = 0; i < 12; i += 1) {
      await expect(checkMcpRateLimit(supabase, auth, "tf_execute_change", "high"))
        .resolves.toMatchObject({ allowed: true });
    }

    await expect(checkMcpRateLimit(supabase, auth, "tf_execute_change", "high"))
      .rejects.toThrow("Rate limit exceeded for tf_execute_change");
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

  it("povolí lokální stdio audit jen session tokenu bez OAuth client_id", () => {
    const migration = fs.readFileSync(
      path.join(ROOT, "supabase/migrations/20260808210000_allow_local_stdio_audit.sql"),
      "utf8",
    );

    expect(migration).toContain("user_id = auth.uid()");
    expect(migration).toContain("auth.jwt() ->> 'client_id' IS NULL");
    expect(migration).toContain("client_id = 'local-stdio'");
    expect(migration).not.toContain("mcp_change_proposals");
    expect(migration).not.toContain("mcp_idempotency_keys");
  });

  it("přidává kanonický MCP resource jen do OAuth access tokenu přes omezený Auth hook", () => {
    const migration = fs.readFileSync(
      path.join(ROOT, "supabase/migrations/20260808231038_add_mcp_oauth_resource_claim_hook.sql"),
      "utf8",
    );
    const config = fs.readFileSync(path.join(ROOT, "supabase/config.toml"), "utf8");

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.tender_flow_access_token_hook(event JSONB)");
    expect(migration).toContain("event -> 'claims' ->> 'client_id'");
    expect(migration).toContain("'{app_metadata,mcp_resource}'");
    expect(migration).toMatch(/'\"https:\/\/www\.tenderflow\.cz\/api\/mcp\"'::jsonb/i);
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.tender_flow_access_token_hook(JSONB) FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.tender_flow_access_token_hook(JSONB) TO supabase_auth_admin");
    expect(config).toMatch(/\[auth\.hook\.custom_access_token\][\s\S]*enabled = true[\s\S]*pg-functions:\/\/postgres\/public\/tender_flow_access_token_hook/);
  });

  it("čte OAuth client_id z claims a zachovává kompatibilní top-level fallback", () => {
    const migration = fs.readFileSync(
      path.join(ROOT, "supabase/migrations/20260809165000_fix_mcp_oauth_hook_claims_client_id.sql"),
      "utf8",
    );

    expect(migration).toContain("NULLIF(BTRIM(claims ->> 'client_id'), '')");
    expect(migration).toContain("NULLIF(BTRIM(event ->> 'client_id'), '')");
    expect(migration).toContain("TO_JSONB('tenderflow_mcp_client'::TEXT)");
    expect(migration).toContain("'{app_metadata,mcp_resource}'");
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.tender_flow_access_token_hook(JSONB) TO supabase_auth_admin",
    );
  });

  it("váže MCP resource claim na autoritativně registrovaného OAuth klienta", () => {
    const migration = fs.readFileSync(
      path.join(ROOT, "supabase/migrations/20260808233204_bind_mcp_resource_to_oauth_client.sql"),
      "utf8",
    );

    expect(migration).toContain("CREATE TABLE public.mcp_oauth_client_resources");
    expect(migration).toContain("REFERENCES auth.oauth_clients(id)");
    expect(migration).toContain("ALTER TABLE public.mcp_oauth_client_resources ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("TO supabase_auth_admin");
    expect(migration).toContain("FROM public.mcp_oauth_client_resources");
    expect(migration).toContain("JOIN auth.oauth_clients");
    expect(migration).toContain("c.deleted_at IS NULL");
    expect(migration).toContain("IF NOT mcp_client_is_registered THEN");
    expect(migration).toContain("RETURN JSONB_BUILD_OBJECT('claims', claims)");
    expect(migration).toMatch(/INSERT INTO public\.mcp_oauth_client_resources[\s\S]*SELECT c\.id,[\s\S]*FROM auth\.oauth_clients AS c/);
    expect(migration).toContain("WHERE c.id IN (");
    expect(migration).toContain("ON CONFLICT (client_id, resource) DO NOTHING");
    expect(migration).not.toMatch(/INSERT INTO public\.mcp_oauth_client_resources \(client_id, resource\)\s+VALUES/);
    expect(migration).toContain("c6d04896-33d1-4cca-a7f2-8d380ed26f0d");
    expect(migration).toContain("9a9b2e02-5e83-4c1f-8a6f-15c7a88d9066");
  });

  it("produkční canary ověřuje skutečné OAuth endpointy a serverový JWKS", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "scripts/check-mcp-production.mjs"),
      "utf8",
    );

    expect(source).toContain("authorization_endpoint");
    expect(source).toContain("token_endpoint");
    expect(source).toContain("expectedJwksUrl");
    expect(source).toContain("await fetch(expectedJwksUrl");
    expect(source).toContain("Array.isArray(jwks.keys)");
    expect(source).toContain("key.kty");
    expect(source).toContain("key.kid");
  });
});
