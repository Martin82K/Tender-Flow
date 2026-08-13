import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (relativePath: string): string =>
  fs.readFileSync(path.join(ROOT, relativePath), "utf8");

describe("legacy desktop MCP removal", () => {
  it("does not ship a desktop MCP server or renderer-to-main token bridge", () => {
    expect(fs.existsSync(path.join(ROOT, "desktop/main/services/mcpServer.ts"))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, "desktop/main/ipc/modules/mcpHandlers.ts"))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, "app/hooks/useDesktopMcpTokenSync.ts"))).toBe(false);

    expect(read("desktop/main/main.ts")).not.toMatch(/mcpServer|startMcpServer|tf-mcp/);
    expect(read("desktop/main/ipc/handlers.ts")).not.toMatch(/registerMcpHandlers|mcpHandlers/);
    expect(read("desktop/main/preload.ts")).not.toMatch(/mcp:set|mcp:getStatus|\bmcp:\s*\{/);
    expect(read("desktop/main/ipc/contracts.ts")).not.toMatch(/["']mcp:/);
    expect(read("services/platformAdapter.ts")).not.toMatch(/McpStatusInfo|mcpAdapter/);
    expect(read("app/AppContent.tsx")).not.toMatch(/useDesktopMcpTokenSync/);
  });

  it("cleans stale desktop output before compiling the packaged runtime", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["desktop:compile"]).toContain(
      "node scripts/clean-desktop-dist.mjs",
    );
    expect(fs.existsSync(path.join(ROOT, "scripts/clean-desktop-dist.mjs"))).toBe(true);
  });

  it("keeps MCP 2.0 remote and stdio on the canonical server factory", () => {
    expect(fs.existsSync(path.join(ROOT, "server/mcp/tenderFlowMcp.js"))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, "mcp-service/api/mcp.js"))).toBe(true);

    const stdioSource = read("scripts/mcp-stdio.js");
    expect(stdioSource).toContain("createTenderFlowMcpServer");
    expect(stdioSource).toContain("TENDER_FLOW_MCP_ACCESS_TOKEN");
  });
});
