import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (relativePath: string): string =>
  fs.readFileSync(path.join(ROOT, relativePath), "utf8").replace(/\r\n/g, "\n");

const domainModules = [
  "discovery",
  "projects",
  "tenders",
  "contracts",
  "subcontractors",
  "tasks",
  "outlook",
  "changes",
] as const;

describe("MCP 2.0 domain modules", () => {
  it("composes tools from explicit domain modules", () => {
    const composition = read("server/mcp/modules/index.js");

    for (const moduleName of domainModules) {
      const modulePath = `server/mcp/modules/${moduleName}.js`;
      expect(fs.existsSync(path.join(ROOT, modulePath)), modulePath).toBe(true);
      expect(composition).toContain(`./${moduleName}.js`);
      const moduleSource = read(modulePath);
      expect(moduleSource).not.toContain("server.registerTool");
      expect(moduleSource).not.toContain("server.registerResource");
    }
  });

  it("keeps the server factory free of domain tool registrations", () => {
    const factory = read("server/mcp/tenderFlowMcp.js");

    expect(factory).toContain("registerTenderFlowMcpModules");
    expect(factory).not.toContain("registerScopedTool(server, auth,");
    expect(factory).not.toContain("'tf_list_projects'");
    expect(factory).not.toContain("'tf_list_contacts'");
    expect(factory).not.toContain("'tf_execute_change'");
  });

  it("keeps shared authorization, audit and rate limiting in the core runtime", () => {
    const runtime = read("server/mcp/core/toolRuntime.js");

    expect(runtime).toContain("assertMcpPermissions");
    expect(runtime).toContain("checkMcpRateLimit");
    expect(runtime).toContain("logMcpAuditEvent");
    expect(runtime).toContain("getMcpToolPolicy");
  });

  it("does not retain the obsolete Claude repository guide", () => {
    expect(fs.existsSync(path.join(ROOT, "CLAUDE.md"))).toBe(false);
  });
});
