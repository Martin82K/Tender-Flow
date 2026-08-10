import fs from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import {
  shouldBuildApplication,
  shouldBuildMcpService,
} from "../scripts/vercel-build-scope.mjs";
import {
  proxyNodeMcpRequest,
  resolveMcpUpstreamUrl,
} from "../server/mcp/upstreamProxy.js";

const ROOT = process.cwd();

describe("MCP deployment boundary", () => {
  it("publishes MCP as a standalone Vercel service without an application build", () => {
    const rootPackage = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    const rootLock = JSON.parse(fs.readFileSync(path.join(ROOT, "package-lock.json"), "utf8"));
    const servicePackage = JSON.parse(fs.readFileSync(
      path.join(ROOT, "mcp-service/package.json"),
      "utf8",
    ));
    const serviceConfig = JSON.parse(fs.readFileSync(
      path.join(ROOT, "mcp-service/vercel.json"),
      "utf8",
    ));
    const mcpEntrypoint = fs.readFileSync(
      path.join(ROOT, "mcp-service/api/mcp.js"),
      "utf8",
    );
    const metadataEntrypoint = fs.readFileSync(
      path.join(ROOT, "mcp-service/api/mcp-resource.js"),
      "utf8",
    );

    expect(servicePackage.private).toBe(true);
    expect(rootPackage.workspaces).toContain("mcp-service");
    expect(rootLock.packages["mcp-service"]?.name).toBe("@tenderflow/remote-mcp");
    expect(fs.existsSync(path.join(ROOT, "mcp-service/package-lock.json"))).toBe(false);
    expect(servicePackage.type).toBe("module");
    expect(servicePackage.scripts?.build).toBeUndefined();
    expect(servicePackage.dependencies).toEqual({
      "@modelcontextprotocol/server": "2.0.0",
      "@supabase/supabase-js": "2.86.0",
      jose: "6.2.3",
      zod: "4.4.3",
    });
    expect(serviceConfig.functions).toMatchObject({
      "api/mcp.js": { maxDuration: 60 },
    });
    expect(serviceConfig.rewrites).toEqual(expect.arrayContaining([
      {
        source: "/.well-known/oauth-protected-resource",
        destination: "/api/mcp-resource",
      },
    ]));
    expect(mcpEntrypoint).toContain("../../server/mcp/nodeHandler.js");
    expect(metadataEntrypoint).toContain("../../server/mcp/response.js");
  });

  it("skips the application build for MCP-only changes and fails safe for mixed changes", () => {
    const mcpOnly = [
      "server/mcp/tenderFlowMcp.js",
      "shared/mcp/toolCatalog.js",
      "mcp-service/vercel.json",
      "docs/mcp/architecture.md",
      "tests/mcpToolCatalog.test.ts",
      "supabase/migrations/20260810120000_mcp_example.sql",
    ];

    expect(shouldBuildApplication(mcpOnly)).toBe(false);
    expect(shouldBuildApplication(["api/mcp.js"])).toBe(true);
    expect(shouldBuildApplication(["api/mcp-resource.js"])).toBe(true);
    expect(shouldBuildApplication([...mcpOnly, "features/tasks/TasksPage.tsx"])).toBe(true);
    expect(shouldBuildApplication([])).toBe(true);
  });

  it("deploys the MCP service only for runtime-relevant changes", () => {
    expect(shouldBuildMcpService(["server/mcp/data.js"])).toBe(true);
    expect(shouldBuildMcpService(["shared/mcp/toolCatalog.js"])).toBe(true);
    expect(shouldBuildMcpService(["mcp-service/package.json"])).toBe(true);
    expect(shouldBuildMcpService(["package-lock.json"])).toBe(true);
    expect(shouldBuildMcpService(["docs/mcp/architecture.md"])).toBe(false);
    expect(shouldBuildMcpService(["features/settings/McpAccessSettings.tsx"])).toBe(false);
    expect(shouldBuildMcpService([])).toBe(true);
  });

  it("accepts only an explicit HTTPS MCP upstream and keeps the canonical endpoint stable", () => {
    expect(resolveMcpUpstreamUrl(undefined)).toBeNull();
    expect(resolveMcpUpstreamUrl("https://mcp.tenderflow.cz/api/mcp").href)
      .toBe("https://mcp.tenderflow.cz/api/mcp");
    expect(() => resolveMcpUpstreamUrl("http://mcp.tenderflow.cz/api/mcp"))
      .toThrow("HTTPS");
    expect(() => resolveMcpUpstreamUrl("https://user:secret@mcp.tenderflow.cz/api/mcp"))
      .toThrow("credentials");
    expect(() => resolveMcpUpstreamUrl("https://mcp.tenderflow.cz/admin"))
      .toThrow("/api/mcp");

    const legacyEntrypoint = fs.readFileSync(path.join(ROOT, "api/mcp.js"), "utf8");
    expect(legacyEntrypoint).toContain("MCP_UPSTREAM_URL");
    expect(legacyEntrypoint).toContain("proxyNodeMcpRequest");
    expect(legacyEntrypoint).toContain("handleNodeMcpRequest");
  });

  it("forwards the OAuth request without following redirects or exposing the upstream host", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("ok", {
      status: 200,
      headers: { "content-type": "text/plain" },
    }));
    const headers = new Map<string, string>();
    let responseBody = "";
    const response = {
      statusCode: 0,
      setHeader: (key: string, value: string) => headers.set(key, value),
      end: (body?: Buffer) => { responseBody = body?.toString("utf8") || ""; },
    };

    await proxyNodeMcpRequest({
      method: "POST",
      url: "/api/mcp",
      headers: {
        authorization: "Bearer test-token",
        host: "www.tenderflow.cz",
        "content-type": "application/json",
        "x-forwarded-host": "www.tenderflow.cz",
        "x-forwarded-proto": "https",
      },
      body: { jsonrpc: "2.0", id: 1, method: "tools/list" },
      socket: {},
    }, response, new URL("https://mcp.tenderflow.cz/api/mcp"));

    const [url, init] = fetchMock.mock.calls[0];
    const forwardedHeaders = init?.headers as Headers;
    expect(String(url)).toBe("https://mcp.tenderflow.cz/api/mcp");
    expect(init?.redirect).toBe("manual");
    expect(forwardedHeaders.get("authorization")).toBe("Bearer test-token");
    expect(forwardedHeaders.get("host")).toBeNull();
    expect(forwardedHeaders.get("x-forwarded-host")).toBe("www.tenderflow.cz");
    expect(response.statusCode).toBe(200);
    expect(responseBody).toBe("ok");
    fetchMock.mockRestore();
  });

  it("removes standard and Connection-declared hop-by-hop request headers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("ok"));
    const response = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn(),
    };

    await proxyNodeMcpRequest({
      method: "POST",
      url: "/api/mcp",
      headers: {
        authorization: "Bearer test-token",
        connection: "keep-alive, x-internal-hop",
        "content-type": "application/json",
        host: "www.tenderflow.cz",
        "keep-alive": "timeout=5",
        te: "trailers",
        trailer: "x-checksum",
        "transfer-encoding": "chunked",
        upgrade: "websocket",
        "x-internal-hop": "remove-me",
        "x-request-id": "request-1",
        "x-forwarded-host": "www.tenderflow.cz",
        "x-forwarded-proto": "https",
      },
      body: { jsonrpc: "2.0", id: 1, method: "tools/list" },
      socket: {},
    }, response, new URL("https://mcp.tenderflow.cz/api/mcp"));

    const forwardedHeaders = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(forwardedHeaders.get("authorization")).toBe("Bearer test-token");
    expect(forwardedHeaders.get("content-type")).toBe("application/json");
    expect(forwardedHeaders.get("x-request-id")).toBe("request-1");
    for (const header of [
      "connection",
      "keep-alive",
      "te",
      "trailer",
      "transfer-encoding",
      "upgrade",
      "x-internal-hop",
    ]) {
      expect(forwardedHeaders.get(header)).toBeNull();
    }
    fetchMock.mockRestore();
  });

  it("removes stale compression headers from a decompressed upstream response", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("ok", {
      status: 200,
      headers: {
        "content-encoding": "gzip",
        "content-length": "42",
        "content-type": "application/json",
        "x-request-id": "request-1",
      },
    }));
    const headers = new Map<string, string>();
    const response = {
      statusCode: 0,
      setHeader: (key: string, value: string) => headers.set(key, value),
      end: vi.fn(),
    };

    await proxyNodeMcpRequest({
      method: "GET",
      url: "/api/mcp",
      headers: {
        host: "www.tenderflow.cz",
        "x-forwarded-host": "www.tenderflow.cz",
        "x-forwarded-proto": "https",
      },
      socket: {},
    }, response, new URL("https://mcp.tenderflow.cz/api/mcp"));

    expect(headers.has("content-encoding")).toBe(false);
    expect(headers.has("content-length")).toBe(false);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-request-id")).toBe("request-1");
    fetchMock.mockRestore();
  });

  it("preserves an unknown content encoding that fetch does not decode", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("encoded", {
      status: 200,
      headers: {
        "content-encoding": "custom",
        "content-length": "7",
      },
    }));
    const headers = new Map<string, string>();
    const response = {
      statusCode: 0,
      setHeader: (key: string, value: string) => headers.set(key, value),
      end: vi.fn(),
    };

    await proxyNodeMcpRequest({
      method: "GET",
      url: "/api/mcp",
      headers: {
        host: "www.tenderflow.cz",
        "x-forwarded-host": "www.tenderflow.cz",
        "x-forwarded-proto": "https",
      },
      socket: {},
    }, response, new URL("https://mcp.tenderflow.cz/api/mcp"));

    expect(headers.get("content-encoding")).toBe("custom");
    expect(headers.get("content-length")).toBe("7");
    fetchMock.mockRestore();
  });
});
