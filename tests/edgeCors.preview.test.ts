// @vitest-environment node
import viteConfig from "../vite.config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCorsHeaders, handleCors } from "../supabase/functions/_shared/cors";

describe("Edge Function preview CORS", () => {
  beforeEach(() => vi.stubGlobal("Deno", { env: { get: () => undefined } }));
  afterEach(() => vi.unstubAllGlobals());

  it("keeps standard preview on an existing allowed loopback origin without port fallback", async () => {
    const config = typeof viteConfig === "function"
      ? await viteConfig({ command: "serve", mode: "production", isPreview: true })
      : await viteConfig;
    expect(config.preview).toMatchObject({ host: "127.0.0.1", port: 5173, strictPort: true });
    expect(config.server?.port).toBe(3000);
    const origin = `http://${config.preview?.host}:${config.preview?.port}`;
    expect(buildCorsHeaders(new Request("https://example.test", { headers: { origin } }))["access-control-allow-origin"]).toBe(origin);
  });

  it.each(["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "https://tenderflow.cz"])(
    "allows preflight and actual responses from %s", (origin) => {
      const request = new Request("https://example.test/functions/v1/microsoft-todo-connection", {
        method: "OPTIONS", headers: { origin },
      });
      expect(handleCors(request)?.headers.get("access-control-allow-origin")).toBe(origin);
      expect(buildCorsHeaders(new Request(request.url, { method: "POST", headers: { origin } }))["access-control-allow-origin"]).toBe(origin);
      expect(buildCorsHeaders(request).vary).toBe("Origin");
    },
  );

  it.each(["http://localhost:4173", "http://127.0.0.1:4173", "http://localhost:5174", "http://localhost.attacker.test:4173", "http://127.0.0.1.attacker.test:4173", "null", "https://attacker.test"])(
    "does not authorize unlisted origin %s", (origin) => {
      expect(buildCorsHeaders(new Request("https://example.test", { headers: { origin } }))["access-control-allow-origin"]).toBe("https://tenderflow.cz");
    },
  );
});
