import { buildCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient } from "../_shared/supabase.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), "content-type": "application/json" },
  });

type ShortenRequest = {
  url?: string;
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) {
      return json(401, { error: "Unauthorized" });
    }

    const body = (await req.json().catch(() => null)) as ShortenRequest | null;
    const targetUrl = String(body?.url || "").trim();
    if (!targetUrl) {
      return json(400, { error: "Missing url" });
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return json(400, { error: "Invalid URL format" });
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return json(400, { error: "Only http/https URLs are allowed" });
    }

    const tinyUrlApiKey = (Deno.env.get("TINYURL_API_KEY") || "").trim();
    if (!tinyUrlApiKey) {
      return json(500, { error: "Missing TINYURL_API_KEY in Supabase Secrets" });
    }

    const tinyUrlResponse = await fetch("https://api.tinyurl.com/create", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tinyUrlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: parsed.toString(),
        domain: "tinyurl.com",
      }),
    });

    const tinyUrlJson = await tinyUrlResponse.json().catch(() => null);
    if (!tinyUrlResponse.ok) {
      const details = tinyUrlJson?.errors || tinyUrlJson?.error || tinyUrlJson;
      return json(tinyUrlResponse.status, {
        error: "TinyURL API error",
        details,
      });
    }

    const shortUrl = String(tinyUrlJson?.data?.tiny_url || "").trim();
    if (!shortUrl) {
      return json(502, { error: "TinyURL response missing short URL" });
    }

    return json(200, {
      success: true,
      shortUrl,
      originalUrl: parsed.toString(),
      provider: "tinyurl",
    });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
