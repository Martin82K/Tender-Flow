
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// CORS headers
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    // Handle CORS preflight request
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // 1. Kill Switch Check
        const killSwitch = Deno.env.get("AI_FEATURE_ENABLED") ?? "true";
        if (killSwitch === "false") {
            return new Response(
                JSON.stringify({
                    error: "Service temporarily unavailable",
                    message: "AI features are currently disabled for maintenance. Please try again later.",
                }),
                {
                    status: 503,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // 2. Authentication & Authorization
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Missing Authorization header" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Initialize Supabase Client
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
        });

        // Get User User
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: "Invalid token" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 3. Subscription Check
        // We can use the RPC function `get_user_subscription_tier` or query `user_profiles` directly.
        // RPC is safer as it encapsulates logic.
        const { data: tier, error: tierError } = await supabase.rpc('get_user_subscription_tier', { target_user_id: user.id });

        if (tierError) {
            console.error("Tier check error:", tierError);
            return new Response(
                JSON.stringify({ error: "Failed to verify subscription" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Allowed tiers: 'pro', 'enterprise', 'admin'
        // 'demo' and 'free' are blocked from AI features
        const ALLOWED_TIERS = ['pro', 'enterprise', 'admin'];
        if (!ALLOWED_TIERS.includes(tier)) {
            return new Response(
                JSON.stringify({
                    error: "Subscription required",
                    message: "This feature requires a PRO or Enterprise subscription.",
                    tier: tier
                }),
                {
                    status: 403,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                }
            );
        }

        // 4. Proxy to Gemini
        const { prompt, history } = await req.json();
        const apiKey = Deno.env.get("GEMINI_API_KEY");

        if (!apiKey) {
            console.error("Missing GEMINI_API_KEY");
            return new Response(
                JSON.stringify({ error: "Server configuration error" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Call Gemini API (GenerateContent)
        // Using fetch directly to allow streaming (if we want) or simple JSON
        // Start with simple JSON for robustness
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        // Construct contents from history + prompt
        let contents = [];
        if (history && Array.isArray(history)) {
            contents = history.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.parts }] // Assuming simplified history structure
            }));
        }
        // Add current prompt
        if (prompt) {
            contents.push({
                role: 'user',
                parts: [{ text: prompt }]
            });
        }

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Gemini API Error:", data);
            return new Response(
                JSON.stringify({ error: "AI Provider Error", details: data }),
                { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Extract text for simplified client consumption
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

        return new Response(
            JSON.stringify({ text, raw: data }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );

    } catch (error) {
        console.error("Edge Function Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
