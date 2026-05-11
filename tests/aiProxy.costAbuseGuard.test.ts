import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ai-proxy cost-abuse guard", () => {
  const source = () =>
    readFileSync(resolve(process.cwd(), "supabase/functions/ai-proxy/index.ts"), "utf-8");

  it("vynucuje provider/model allowlist a output/input limity pred drahym volanim", () => {
    const code = source();
    const quotaIndex = code.indexOf("const quota = await checkAiQuota(");
    const firstProviderCallIndex = code.indexOf("https://generativelanguage.googleapis.com");

    expect(code).toContain("const AI_MODEL_ALLOWLIST");
    expect(code).toContain("normalizeProvider(provider)");
    expect(code).toContain("resolveAllowedModel(normalizedProvider, clientModel)");
    expect(code).toContain("MAX_TOTAL_INPUT_CHARS");
    expect(code).toContain("MAX_HISTORY_MESSAGES");
    expect(code).toContain("MAX_OUTPUT_TOKENS");
    expect(code).toContain("max_output_tokens: MAX_OUTPUT_TOKENS");
    expect(code).toContain("max_tokens: MAX_OUTPUT_TOKENS");
    expect(code).toContain("generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS }");
    expect(quotaIndex).toBeGreaterThan(-1);
    expect(firstProviderCallIndex).toBeGreaterThan(quotaIndex);
  });

  it("nebere memory storage bucket z requestu a omezuje documentUrl na Supabase host", () => {
    const code = source();

    expect(code).toContain('const MEMORY_BUCKET = "agent-memory"');
    expect(code).toContain(".from(MEMORY_BUCKET)");
    expect(code).not.toContain("body?.bucket");
    expect(code).toContain("sanitizeDocumentUrl(documentUrl, supabaseUrl)");
    expect(code).toContain("url.hostname !== allowedHost");
  });

  it("pocita per-user i per-org AI kvoty a zapisuje metadata-only usage event", () => {
    const code = source();

    expect(code).toContain("MAX_AI_USER_REQUESTS_PER_HOUR");
    expect(code).toContain("MAX_AI_ORG_REQUESTS_PER_HOUR");
    expect(code).toContain("MAX_AI_USER_REQUESTS_PER_DAY");
    expect(code).toContain("MAX_AI_ORG_REQUESTS_PER_DAY");
    expect(code).toContain('.from("ai_agent_usage_events")');
    expect(code).toContain('.eq("user_id", userId)');
    expect(code).toContain('countAiUsage(service, "organization_id", organizationId, hourAgo)');
    expect(code).toContain('countAiUsage(service, "organization_id", organizationId, dayAgo)');
    expect(code).toContain('retention: "metadata_only"');
  });
});
