import { get } from "@vercel/blob";
import { createHmac, timingSafeEqual } from "crypto";

const LATEST_PATH = "releases/win/latest.yml";
export const config = { runtime: "nodejs" };

const getBearerToken = (authorizationHeader: string | undefined): string | null => {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
};

const base64UrlToBuffer = (value: string): Buffer => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLength);
  return Buffer.from(padded, "base64");
};

const verifySupabaseAccessToken = (token: string, jwtSecret: string): boolean => {
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const headerText = base64UrlToBuffer(encodedHeader).toString("utf-8");
  const payloadText = base64UrlToBuffer(encodedPayload).toString("utf-8");
  let header: { alg?: string } | null = null;
  let payload: { exp?: number; nbf?: number } | null = null;
  try {
    header = JSON.parse(headerText);
    payload = JSON.parse(payloadText);
  } catch {
    return false;
  }
  if (!header || header.alg !== "HS256" || !payload) return false;

  const signedPart = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = createHmac("sha256", jwtSecret).update(signedPart).digest();
  const tokenSignature = base64UrlToBuffer(encodedSignature);
  if (expectedSignature.length !== tokenSignature.length) return false;
  if (!timingSafeEqual(expectedSignature, tokenSignature)) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < nowSeconds) return false;
  if (typeof payload.nbf === "number" && payload.nbf > nowSeconds) return false;

  return true;
};

const rewriteLatestYamlForUpdateProxy = (yamlContent: string): string => {
  const replacer = (_: string, rawPath: string): string => {
    const cleaned = rawPath.trim().replace(/^['"]|['"]$/g, "");
    const normalized = cleaned.startsWith("releases/win/")
      ? cleaned
      : `releases/win/${cleaned.replace(/^\/+/, "").replace(/^\.\//, "")}`;
    return `file?path=${encodeURIComponent(normalized)}`;
  };

  let output = yamlContent.replace(/^path:\s*(.+)\s*$/m, (_line, rawPath) => `path: ${replacer("", rawPath)}`);
  output = output.replace(/^(\s*(?:-\s*)?url:\s*)(.+)\s*$/gm, (_line, prefix, rawPath) => {
    return `${prefix}${replacer("", rawPath)}`;
  });
  return output;
};

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) {
    res.status(500).json({ error: "Server is not configured for update authentication" });
    return;
  }

  const token = getBearerToken(req.headers?.authorization);
  if (!token || !verifySupabaseAccessToken(token, jwtSecret)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const blobResult = await get(LATEST_PATH, { access: "private" });
  if (!blobResult || blobResult.statusCode !== 200 || !blobResult.stream) {
    res.status(404).json({ error: "latest.yml not found" });
    return;
  }

  const rawYaml = await new Response(blobResult.stream).text();
  const rewrittenYaml = rewriteLatestYamlForUpdateProxy(rawYaml);

  res.setHeader("Content-Type", "text/yaml; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Vary", "Authorization");
  res.status(200).send(rewrittenYaml);
}
