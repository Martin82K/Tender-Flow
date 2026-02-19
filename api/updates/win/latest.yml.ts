import { get } from "@vercel/blob";
import {
  getBearerToken,
  rewriteLatestYamlForUpdateProxy,
  verifySupabaseAccessToken,
} from "./_lib";

const LATEST_PATH = "releases/win/latest.yml";

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
