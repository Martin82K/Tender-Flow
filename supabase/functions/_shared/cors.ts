// ---------------------------------------------------------------------------
// Allowed origins for CORS.  Requests from unknown origins get the first
// entry as a safe default (browsers will block the response).
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS: string[] = [
  "https://tenderflow.cz",
  "https://www.tenderflow.cz",
];

// Vercel preview deployments (pattern: tender-flow-*.vercel.app)
const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  /^https:\/\/tender-flow-[a-z0-9-]+\.vercel\.app$/,
];

function isOriginAllowed(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((p) => p.test(origin));
}

/**
 * Build CORS headers with validated origin.  Always use this in responses
 * instead of the deprecated static `corsHeaders`.
 */
export const buildCorsHeaders = (req: Request): Record<string, string> => {
  const origin = req.headers.get("origin") ?? "";
  const resolvedOrigin = isOriginAllowed(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "access-control-allow-origin": resolvedOrigin,
    "access-control-allow-headers":
      "authorization, x-client-info, apikey, content-type, x-idempotency-key",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "vary": "Origin",
  };
};

/**
 * @deprecated Use `buildCorsHeaders(req)` instead.  Kept temporarily so
 * files that haven't been migrated still compile with a safe default.
 */
export const corsHeaders: Record<string, string> = {
  "access-control-allow-origin": ALLOWED_ORIGINS[0],
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type, x-idempotency-key",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "vary": "Origin",
};

export const handleCors = (req: Request): Response | null => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }
  return null;
};
