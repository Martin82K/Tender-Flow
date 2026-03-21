import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("desktop MCP server hardening", () => {
  it("fail-closed bez auth konfigurace a omezuje CORS originy", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "desktop/main/services/mcpServer.ts"),
      "utf8",
    );

    expect(source).toContain("const authorizeRequest = async (req: http.IncomingMessage): Promise<TokenInfo> => {");
    expect(source).toContain("throw new Error('MCP auth is not configured on this desktop app instance.');");
    expect(source).toContain("const isAllowedOrigin = (origin: string): boolean => {");
    expect(source).toContain("if (origin === 'null') {");
    expect(source).toContain("return /^https?:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?$/i.test(origin);");
    expect(source).toContain("sendJson(res, 403, { error: 'Origin not allowed' });");
    expect(source).toContain("res.setHeader('vary', 'origin');");
  });
});
