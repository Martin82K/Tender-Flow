import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCorsHeaders, handleCors } from "../supabase/functions/_shared/cors";

describe("Edge Function preview CORS", () => {
  beforeEach(() => vi.stubGlobal("Deno", { env: { get: () => undefined } }));
  afterEach(() => vi.unstubAllGlobals());

  it.each(["http://localhost:4173", "http://127.0.0.1:4173", "http://localhost:3000", "https://tenderflow.cz"])(
    "allows preflight and actual responses from %s", (origin) => {
      const request = new Request("https://example.test/functions/v1/microsoft-todo-connection", {
        method: "OPTIONS", headers: { origin },
      });
      expect(handleCors(request)?.headers.get("access-control-allow-origin")).toBe(origin);
      expect(buildCorsHeaders(new Request(request.url, { method: "POST", headers: { origin } }))["access-control-allow-origin"]).toBe(origin);
      expect(buildCorsHeaders(request).vary).toBe("Origin");
    },
  );

  it.each(["http://localhost:4174", "http://localhost.attacker.test:4173", "http://127.0.0.1.attacker.test:4173", "null", "https://attacker.test"])(
    "does not authorize unlisted origin %s", (origin) => {
      expect(buildCorsHeaders(new Request("https://example.test", { headers: { origin } }))["access-control-allow-origin"]).toBe("https://tenderflow.cz");
    },
  );
});
