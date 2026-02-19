import { get } from "@vercel/blob";
import { Readable } from "stream";
import {
  getBearerToken,
  isAllowedUpdateBlobPath,
  verifySupabaseAccessToken,
} from "../../../server/updateApi/updateApiUtils";

const readPathFromQuery = (queryValue: string | string[] | undefined): string | null => {
  if (!queryValue) return null;
  const value = Array.isArray(queryValue) ? queryValue[0] : queryValue;
  if (!value) return null;
  return decodeURIComponent(value);
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

  Readable.fromWeb(blobResult.stream as unknown as ReadableStream).pipe(res);
}
