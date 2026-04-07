
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getFirstEnvSecret } from "../_shared/env.ts";

// CORS headers
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Action → Mapy.cz endpoint mapping
const ACTION_ENDPOINTS: Record<string, string> = {
    geocode: "https://api.mapy.cz/v1/geocode",
    rgeocode: "https://api.mapy.cz/v1/rgeocode",
    suggest: "https://api.mapy.cz/v1/suggest",
    route: "https://api.mapy.cz/v1/routing/route",
    matrix: "https://api.mapy.cz/v1/routing/matrix",
};

// Actions that require pro+ tier (routing features)
const PRO_ACTIONS = new Set(["route", "matrix"]);

// Tiers allowed for basic map features (MODULE_MAPS)
const STARTER_TIERS = ["starter", "pro", "enterprise", "admin"];

// Tiers allowed for routing/matrix features
const PRO_TIERS = ["pro", "enterprise", "admin"];

Deno.serve(async (req) => {
    // Handle CORS preflight request
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // 1. Authentication
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Missing Authorization header" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
        const supabaseServiceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
            return new Response(
                JSON.stringify({ error: "Server configuration error" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { action, params } = body as {
            action: "geocode" | "rgeocode" | "suggest" | "route" | "matrix" | "tile-config";
            params?: Record<string, string>;
        };

        if (!action) {
            return new Response(
                JSON.stringify({ error: "Missing 'action' in request body" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 3. Check subscription tier
        const service = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

        const { data: tier, error: tierError } = await service.rpc("get_user_subscription_tier", { target_user_id: user.id });

        if (tierError) {
            console.error("Tier check error:", tierError);
            return new Response(
                JSON.stringify({ error: "Failed to verify subscription" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // 4. Get API key from secrets
        const { value: mapyApiKey } = getFirstEnvSecret("MAPY_API_KEY", "MAPY_COM_API_KEY");
        if (!mapyApiKey) {
            return new Response(
                JSON.stringify({
                    error: "Missing Mapy.com API Key",
                    message: "Set the MAPY_API_KEY secret in Supabase: supabase secrets set MAPY_API_KEY=your_key",
                }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 5. Handle tile-config action (returns tile URL templates with embedded API key)
        if (action === "tile-config") {
            return new Response(
                JSON.stringify({
                    tileUrl: `https://api.mapy.cz/v1/maptiles/basic/256/{z}/{x}/{y}?apikey=${mapyApiKey}`,
                    darkTileUrl: `https://api.mapy.cz/v1/maptiles/dark/256/{z}/{x}/{y}?apikey=${mapyApiKey}`,
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Build query string from params
        const queryParams = new URLSearchParams(params || {});
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
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // 8. Return successful response
        return new Response(
            JSON.stringify(mapyData),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Edge Function Error:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Unknown Error" }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
