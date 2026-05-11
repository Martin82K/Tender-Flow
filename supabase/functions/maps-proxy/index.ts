
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getFirstEnvSecret } from "../_shared/env.ts";
import { buildCorsHeaders, handleCors } from "../_shared/cors.ts";

// Action → Mapy.cz endpoint mapping
const ACTION_ENDPOINTS: Record<string, string> = {
    geocode: "https://api.mapy.com/v1/geocode",
    rgeocode: "https://api.mapy.com/v1/rgeocode",
    suggest: "https://api.mapy.com/v1/suggest",
    route: "https://api.mapy.com/v1/routing/route",
    matrix: "https://api.mapy.com/v1/routing/matrix",
};

// Actions that require pro+ tier (routing features)
const PRO_ACTIONS = new Set(["route", "matrix"]);

// Tiers allowed for basic map features (MODULE_MAPS)
const STARTER_TIERS = ["starter", "pro", "enterprise", "admin"];

// Tiers allowed for routing/matrix features
const PRO_TIERS = ["pro", "enterprise", "admin"];

type MapAction = "geocode" | "rgeocode" | "suggest" | "route" | "matrix" | "tile-config";

const MAPS_LIMITS: Record<"standard" | "routing", {
    userHour: number;
    orgHour: number;
    userDay: number;
    orgDay: number;
}> = {
    standard: { userHour: 300, orgHour: 2_000, userDay: 1_000, orgDay: 8_000 },
    routing: { userHour: 60, orgHour: 500, userDay: 250, orgDay: 2_000 },
};

const FEATURE_KEY_BY_ACTION: Record<Exclude<MapAction, "tile-config">, string> = {
    geocode: "maps_bulk_geocode",
    rgeocode: "maps_bulk_geocode",
    suggest: "module_maps",
    route: "maps_routing",
    matrix: "maps_routing",
};

const PARAM_ALLOWLIST: Record<Exclude<MapAction, "tile-config">, readonly string[]> = {
    geocode: ["query", "lang", "limit", "type"],
    rgeocode: ["lat", "lon", "lang"],
    suggest: ["query", "lang", "limit", "type", "location", "bbox"],
    route: ["start", "end", "routeType", "lang"],
    matrix: ["start", "end", "routeType"],
};

const ALLOWED_LANGS = new Set(["cs", "en", "sk", "de", "pl"]);
const ALLOWED_ROUTE_TYPES = new Set(["car_fast", "car_short"]);
const MAX_QUERY_CHARS = 300;
const MAX_PARAM_CHARS = 500;
const MAX_MAPS_LIMIT = 10;
const MAX_MATRIX_POINTS = 10;

const json = (req: Request, status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
    });

const sanitizeString = (value: unknown, maxLength: number): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, maxLength);
};

const normalizeNumber = (value: unknown): number | null => {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : null;
};

const isCoordinate = (value: string): boolean => {
    const [lonRaw, latRaw] = value.split(",");
    const lon = normalizeNumber(lonRaw);
    const lat = normalizeNumber(latRaw);
    return lon !== null && lat !== null && lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
};

const isCoordinateList = (value: string, maxPoints: number): boolean => {
    const points = value.split("|").filter(Boolean);
    return points.length > 0 && points.length <= maxPoints && points.every(isCoordinate);
};

const sanitizeMapsParams = (
    action: Exclude<MapAction, "tile-config">,
    params: Record<string, unknown> | undefined,
): { ok: true; value: Record<string, string> } | { ok: false; error: string } => {
    const allowed = new Set(PARAM_ALLOWLIST[action]);
    const sanitized: Record<string, string> = {};

    for (const [key, rawValue] of Object.entries(params || {})) {
        if (!allowed.has(key)) {
            return { ok: false, error: `Unsupported parameter: ${key}` };
        }
        const value = sanitizeString(rawValue, key === "query" ? MAX_QUERY_CHARS : MAX_PARAM_CHARS);
        if (value) sanitized[key] = value;
    }

    if ((action === "geocode" || action === "suggest") && !sanitized.query) {
        return { ok: false, error: "Missing query" };
    }
    if (sanitized.lang && !ALLOWED_LANGS.has(sanitized.lang)) {
        return { ok: false, error: "Invalid lang" };
    }
    if (sanitized.limit) {
        const limit = Math.floor(normalizeNumber(sanitized.limit) || 0);
        if (limit < 1) return { ok: false, error: "Invalid limit" };
        sanitized.limit = String(Math.min(limit, MAX_MAPS_LIMIT));
    }
    if (sanitized.routeType && !ALLOWED_ROUTE_TYPES.has(sanitized.routeType)) {
        return { ok: false, error: "Invalid routeType" };
    }
    if (action === "rgeocode") {
        const lon = normalizeNumber(sanitized.lon);
        const lat = normalizeNumber(sanitized.lat);
        if (lon === null || lat === null || lon < -180 || lon > 180 || lat < -90 || lat > 90) {
            return { ok: false, error: "Invalid coordinates" };
        }
    }
    if (action === "route" && (!sanitized.start || !sanitized.end || !isCoordinate(sanitized.start) || !isCoordinate(sanitized.end))) {
        return { ok: false, error: "Invalid route coordinates" };
    }
    if (action === "matrix" && (!sanitized.start || !sanitized.end || !isCoordinateList(sanitized.start, MAX_MATRIX_POINTS) || !isCoordinateList(sanitized.end, MAX_MATRIX_POINTS))) {
        return { ok: false, error: "Invalid matrix coordinates" };
    }

    return { ok: true, value: sanitized };
};

const resolveUserOrganizationId = async (service: any, userId: string): Promise<string | null> => {
    const { data, error } = await service
        .from("organization_members")
        .select("organization_id,is_active")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

    if (error) throw new Error("Failed to verify organization");
    return typeof data?.organization_id === "string" ? data.organization_id : null;
};

const countMapUsage = async (
    service: any,
    featureKey: string,
    column: "user_id" | "organization_id",
    value: string,
    sinceIso: string,
): Promise<number> => {
    const { count, error } = await service
        .from("feature_usage_events")
        .select("id", { count: "exact", head: true })
        .eq("feature_key", featureKey)
        .eq(column, value)
        .gte("created_at", sinceIso);

    if (error) throw new Error("Failed to verify maps quota");
    return count || 0;
};

const checkMapsQuota = async (service: any, action: Exclude<MapAction, "tile-config">, userId: string, organizationId: string) => {
    const featureKey = FEATURE_KEY_BY_ACTION[action];
    const limits = PRO_ACTIONS.has(action) ? MAPS_LIMITS.routing : MAPS_LIMITS.standard;
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [userHour, orgHour, userDay, orgDay] = await Promise.all([
        countMapUsage(service, featureKey, "user_id", userId, hourAgo),
        countMapUsage(service, featureKey, "organization_id", organizationId, hourAgo),
        countMapUsage(service, featureKey, "user_id", userId, dayAgo),
        countMapUsage(service, featureKey, "organization_id", organizationId, dayAgo),
    ]);

    if (userHour >= limits.userHour) return { ok: false, scope: "user_hour" };
    if (orgHour >= limits.orgHour) return { ok: false, scope: "org_hour" };
    if (userDay >= limits.userDay) return { ok: false, scope: "user_day" };
    if (orgDay >= limits.orgDay) return { ok: false, scope: "org_day" };
    return { ok: true, scope: null };
};

const recordMapUsage = async (
    service: any,
    action: Exclude<MapAction, "tile-config">,
    userId: string,
    organizationId: string,
    params: Record<string, string>,
) => {
    const { error } = await service.from("feature_usage_events").insert({
        organization_id: organizationId,
        user_id: userId,
        feature_key: FEATURE_KEY_BY_ACTION[action],
        event_key: "success",
        metadata: {
            action,
            paramKeys: Object.keys(params).sort(),
            retention: "metadata_only",
        },
    });

    if (error) {
        console.error("Failed to record maps usage:", error.message || error);
    }
};

Deno.serve(async (req) => {
    // Handle CORS preflight request
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    try {
        // 1. Authentication
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Missing Authorization header" }),
                { status: 401, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
            );
        }

        const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
        const supabaseServiceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
            return new Response(
                JSON.stringify({ error: "Server configuration error" }),
                { status: 500, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
            );
        }

        // Verify token directly against Auth API
        const apikey = (req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "").trim();
        const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                apikey,
                Authorization: authHeader,
            },
        });

        if (!authRes.ok) {
            return new Response(
                JSON.stringify({ error: "Invalid token" }),
                { status: 401, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
            );
        }
        const user = await authRes.json();

        // 2. Parse request body
        let body;
        try {
            body = await req.json();
        } catch (e) {
            console.error("Failed to parse request body:", e);
            return new Response(
                JSON.stringify({ error: "Invalid JSON body" }),
                { status: 400, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
            );
        }

        const { action, params } = body as {
            action: MapAction;
            params?: Record<string, unknown>;
        };

        if (!action) {
            return new Response(
                JSON.stringify({ error: "Missing 'action' in request body" }),
                { status: 400, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
            );
        }

        // 3. Check subscription tier
        const service = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

        const { data: tier, error: tierError } = await service.rpc("get_user_subscription_tier", { target_user_id: user.id });

        if (tierError) {
            console.error("Tier check error:", tierError);
            return new Response(
                JSON.stringify({ error: "Failed to verify subscription" }),
                { status: 500, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
            );
        }

        // Route/matrix require pro+, everything else requires starter+
        const requiredTiers = PRO_ACTIONS.has(action) ? PRO_TIERS : STARTER_TIERS;
        if (!requiredTiers.includes(tier)) {
            const tierLabel = PRO_ACTIONS.has(action) ? "PRO" : "Starter";
            return new Response(
                JSON.stringify({
                    error: "Subscription required",
                    message: `This feature requires a ${tierLabel} or higher subscription.`,
                    tier: tier,
                }),
                {
                    status: 403,
                    headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
                }
            );
        }

        const organizationId = await resolveUserOrganizationId(service, user.id);
        if (!organizationId) {
            return json(req, 403, { error: "Organization membership required" });
        }

        // 4. Get API key from secrets
        const { value: mapyApiKey } = getFirstEnvSecret("MAPY_API_KEY", "MAPY_COM_API_KEY");
        if (!mapyApiKey) {
            return new Response(
                JSON.stringify({
                    error: "Missing Mapy.com API Key",
                    message: "Set the MAPY_API_KEY secret in Supabase: supabase secrets set MAPY_API_KEY=your_key",
                }),
                { status: 500, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
            );
        }

        // 5. Handle tile-config action (returns tile URL templates with embedded API key)
        if (action === "tile-config") {
            const base = "https://api.mapy.com/v1/maptiles";
            const suffix = `256/{z}/{x}/{y}?apikey=${mapyApiKey}`;
            return new Response(
                JSON.stringify({
                    tileUrl: `${base}/basic/${suffix}`,
                    darkTileUrl: `${base}/outdoor/${suffix}`,
                    layers: {
                        standard: `${base}/basic/${suffix}`,
                        outdoor: `${base}/outdoor/${suffix}`,
                        aerial: `${base}/aerial/${suffix}`,
                        winter: `${base}/winter/${suffix}`,
                    },
                }),
                { headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
            );
        }

        // 6. Validate action and build Mapy.cz URL
        const endpoint = ACTION_ENDPOINTS[action];
        if (!endpoint) {
            return new Response(
                JSON.stringify({
                    error: "Invalid action",
                    message: `Supported actions: ${Object.keys(ACTION_ENDPOINTS).join(", ")}, tile-config`,
                }),
                { status: 400, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
            );
        }
        const proxiedAction = action as Exclude<MapAction, "tile-config">;

        const sanitizedParams = sanitizeMapsParams(proxiedAction, params);
        if (!sanitizedParams.ok) {
            return json(req, 400, { error: sanitizedParams.error });
        }

        const quota = await checkMapsQuota(service, proxiedAction, user.id, organizationId);
        if (!quota.ok) {
            return json(req, 429, {
                error: "Maps rate limit exceeded",
                scope: quota.scope,
            });
        }

        // Build query string from params
        const queryParams = new URLSearchParams(sanitizedParams.value);
        queryParams.set("apikey", mapyApiKey);

        const mapyUrl = `${endpoint}?${queryParams.toString()}`;
        console.log(`[maps-proxy] ${action} -> ${endpoint}`);

        // 7. Forward request to Mapy.cz API
        const mapyResponse = await fetch(mapyUrl, {
            method: "GET",
            headers: {
                "Accept": "application/json",
            },
        });

        const mapyData = await mapyResponse.json();

        // Forward error responses (including 429 rate limit)
        if (!mapyResponse.ok) {
            console.error(`Mapy.cz API error (${mapyResponse.status}):`, mapyData);
            return new Response(
                JSON.stringify({
                    error: "Mapy.cz API Error",
                    status: mapyResponse.status,
                    details: mapyData,
                }),
                {
                    status: mapyResponse.status,
                    headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
                }
            );
        }

        // 8. Return successful response
        await recordMapUsage(service, proxiedAction, user.id, organizationId, sanitizedParams.value);
        return new Response(
            JSON.stringify(mapyData),
            { headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Edge Function Error:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Unknown Error" }),
            {
                status: 500,
                headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
            }
        );
    }
});
