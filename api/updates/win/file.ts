import { get } from "@vercel/blob";
import { createHmac, timingSafeEqual } from "crypto";
import { Readable } from "stream";

const readPathFromQuery = (queryValue: string | string[] | undefined): string | null => {
  if (!queryValue) return null;
  const value = Array.isArray(queryValue) ? queryValue[0] : queryValue;
  if (!value) return null;
  return decodeURIComponent(value);
};

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

const isAllowedUpdateBlobPath = (pathname: string): boolean => {
  if (!pathname) return false;
  if (pathname.includes("..")) return false;
  return pathname.startsWith("releases/win/");
};
export const config = { runtime: "nodejs" };

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

  const requestedPath = readPathFromQuery(req.query?.path);
  if (!requestedPath || !isAllowedUpdateBlobPath(requestedPath)) {
    res.status(400).json({ error: "Invalid update file path" });
    return;
  }

  const blobResult = await get(requestedPath, { access: "private" });
  if (!blobResult || blobResult.statusCode !== 200 || !blobResult.stream) {
    res.status(404).json({ error: "Update file not found" });
    return;
  }

  const contentType = blobResult.blob.contentType || "application/octet-stream";
  const contentDisposition =
    blobResult.blob.contentDisposition || `attachment; filename="${requestedPath.split("/").pop()}"`;

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", contentDisposition);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("ETag", blobResult.blob.etag);
  res.setHeader("Vary", "Authorization");

  Readable.fromWeb(blobResult.stream as any).pipe(res);
}
