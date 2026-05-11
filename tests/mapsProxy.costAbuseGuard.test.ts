import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("maps-proxy cost-abuse guard", () => {
  const source = () =>
    readFileSync(resolve(process.cwd(), "supabase/functions/maps-proxy/index.ts"), "utf-8");

  it("vynucuje allowlist parametru a bounded Mapy limity pred proxy volanim", () => {
    const code = source();
    const sanitizeIndex = code.indexOf("const sanitizedParams = sanitizeMapsParams(");
    const fetchIndex = code.indexOf("const mapyResponse = await fetch(mapyUrl");

    expect(code).toContain("const PARAM_ALLOWLIST");
    expect(code).toContain("MAX_QUERY_CHARS");
    expect(code).toContain("MAX_MAPS_LIMIT");
    expect(code).toContain("MAX_MATRIX_POINTS");
    expect(code).toContain("Unsupported parameter");
    expect(code).toContain("isCoordinateList(sanitized.start, MAX_MATRIX_POINTS)");
    expect(sanitizeIndex).toBeGreaterThan(-1);
    expect(fetchIndex).toBeGreaterThan(sanitizeIndex);
  });

  it("pocita per-user i per-org kvoty pro mapove placene akce pred volanim Mapy API", () => {
    const code = source();
    const quotaIndex = code.indexOf("const quota = await checkMapsQuota(");
    const fetchIndex = code.indexOf("const mapyResponse = await fetch(mapyUrl");

    expect(code).toContain("const MAPS_LIMITS");
    expect(code).toContain("const FEATURE_KEY_BY_ACTION");
    expect(code).toContain('.from("feature_usage_events")');
    expect(code).toContain('.eq("user_id", userId)');
    expect(code).toContain('countMapUsage(service, featureKey, "organization_id", organizationId, hourAgo)');
    expect(code).toContain('countMapUsage(service, featureKey, "organization_id", organizationId, dayAgo)');
    expect(code).toContain("MAPS_LIMITS.routing");
    expect(quotaIndex).toBeGreaterThan(-1);
    expect(fetchIndex).toBeGreaterThan(quotaIndex);
  });

  it("zapisuje pouze metadata bez citlivych mapovych hodnot po uspesnem volani", () => {
    const code = source();

    expect(code).toContain("recordMapUsage(service, proxiedAction, user.id, organizationId, sanitizedParams.value)");
    expect(code).toContain("paramKeys: Object.keys(params).sort()");
    expect(code).toContain('retention: "metadata_only"');
    expect(code).not.toContain("metadata: params");
  });
});
