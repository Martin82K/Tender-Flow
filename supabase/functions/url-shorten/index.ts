import { buildCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient } from "../_shared/supabase.ts";

const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), "content-type": "application/json" },
  });

type ShortenRequest = {
  url?: string;
};

const RESERVED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".test",
  ".invalid",
  ".example",
];

const isPrivateOrReservedIpv4 = (hostname: string): boolean => {
  const parts = hostname.split(".");
  if (parts.length !== 4) return false;

  const octets = parts.map((part) => {
    if (!/^\d+$/.test(part)) return Number.NaN;
    const value = Number(part);
    return value >= 0 && value <= 255 ? value : Number.NaN;
  });

  if (octets.some(Number.isNaN)) return false;

  const [first, second, third] = octets;
  if (first === 0 || first === 10 || first === 127) return true;
  if (first === 100 && second >= 64 && second <= 127) return true;
  if (first === 169 && second === 254) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  if (first === 192 && second === 0 && third === 0) return true;
  if (first === 192 && second === 0 && third === 2) return true;
  if (first === 198 && (second === 18 || second === 19)) return true;
  if (first === 198 && second === 51 && third === 100) return true;
  if (first === 203 && second === 0 && third === 113) return true;
  return first >= 224;
};

const isLocalOrReservedHostname = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!normalized) return true;
  if (normalized === "localhost") return true;
  if (!normalized.includes(".") && !normalized.includes(":")) return true;
  if (RESERVED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) return true;
  if (isPrivateOrReservedIpv4(normalized)) return true;

  if (normalized.includes(":")) {
    const firstHextet = normalized.split(":").find(Boolean) || "0";
    const first = Number.parseInt(firstHextet, 16);
    if (normalized === "::" || normalized === "::1") return true;
    if (Number.isNaN(first)) return true;
    if (first >= 0xfc00 && first <= 0xfdff) return true;
    if (first >= 0xfe80 && first <= 0xfebf) return true;
    if (first >= 0xff00) return true;
    if (normalized.startsWith("2001:db8:") || normalized === "2001:db8::") return true;
  }

  return false;
};

const normalizeSafeShortRedirectUrl = (targetUrl: string): string | null => {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;
  if (isLocalOrReservedHostname(parsed.hostname)) return null;
  return parsed.toString();
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return json(req, 405, { error: "Method not allowed" });
  }

  try {
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) {
      return json(req, 401, { error: "Unauthorized" });
    }

    const body = (await req.json().catch(() => null)) as ShortenRequest | null;
    const targetUrl = String(body?.url || "").trim();
    if (!targetUrl) {
      return json(req, 400, { error: "Missing url" });
    }

    const normalizedUrl = normalizeSafeShortRedirectUrl(targetUrl);
    if (!normalizedUrl) {
      return json(req, 400, {
        error: "Only public HTTPS URLs without credentials are allowed",
      });
    }

    const tinyUrlApiKey = (Deno.env.get("TINYURL_API_KEY") || "").trim();
    if (!tinyUrlApiKey) {
      return json(req, 500, { error: "Missing TINYURL_API_KEY in Supabase Secrets" });
    }

    const tinyUrlResponse = await fetch("https://api.tinyurl.com/create", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tinyUrlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: normalizedUrl,
        domain: "tinyurl.com",
      }),
    });

    const tinyUrlJson = await tinyUrlResponse.json().catch(() => null);
    if (!tinyUrlResponse.ok) {
      const details = tinyUrlJson?.errors || tinyUrlJson?.error || tinyUrlJson;
      return json(req, tinyUrlResponse.status, {
        error: "TinyURL API error",
        details,
      });
    }

    const shortUrl = String(tinyUrlJson?.data?.tiny_url || "").trim();
    if (!shortUrl) {
      return json(req, 502, { error: "TinyURL response missing short URL" });
    }

    return json(req, 200, {
      success: true,
      shortUrl,
      originalUrl: normalizedUrl,
      provider: "tinyurl",
    });
  } catch (error) {
    return json(req, 500, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
