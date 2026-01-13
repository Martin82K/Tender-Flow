
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createServiceClient } from "../_shared/supabase.ts";

// CORS headers
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Message {
    role: string;
    content: string | any[];
}


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

        const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
        if (!supabaseUrl) {
            return new Response(
                JSON.stringify({ error: "Server configuration error" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Verify token directly against Auth API to avoid env mismatches
        const apikey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
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

        // 3. Subscription Check
        // We can use the RPC function `get_user_subscription_tier` or query `user_profiles` directly.
        // RPC is safer as it encapsulates logic.
        const service = createServiceClient();
        const { data: tier, error: tierError } = await service.rpc('get_user_subscription_tier', { target_user_id: user.id });

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

        // 4. Proxy Logic
        const { prompt, history, model: clientModel, provider = 'openrouter', apiKey: clientApiKey } = await req.json();

        // Helper to get system secrets
        async function getSystemSecrects() {
            try {
                const service = createServiceClient();
                const { data, error } = await service
                    .from('app_secrets')
                    .select('google_api_key, openrouter_api_key')
                    .eq('id', 'default')
                    .single();
                if (error || !data) return {};
                return data;
            } catch (e) {
                console.error("Failed to fetch system secrets:", e);
                return {};
            }
        }

        const secrets = (!clientApiKey) ? await getSystemSecrects() : {};

        // --- GOOGLE GEMINI HANDLER ---
        if (provider === 'google') {
            const apiKey = clientApiKey || secrets.google_api_key || Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
            if (!apiKey) {
                return new Response(
                    JSON.stringify({ error: "Missing Google API Key (System or Provided)" }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const model = (clientModel || "gemini-pro").trim();
            console.log(`Using Google Model: ${model}`);

            // Map messages to Google format (contents: [{role, parts: [{text}] }])
            // Google roles: 'user', 'model'
            let contents = [];

            if (history && Array.isArray(history)) {
                contents = history.map((msg: any) => ({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: Array.isArray(msg.parts) ? msg.parts.map((p: any) => p.text).join('') : (typeof msg.parts === 'string' ? msg.parts : JSON.stringify(msg.parts)) }]
                }));
            }

            if (prompt) {
                contents.push({
                    role: 'user',
                    parts: [{ text: prompt }]
                });
            }

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents }),
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Google API Error:", data);
                return new Response(
                    JSON.stringify({ error: "Google API Error", details: data }),
                    { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Extract text from Google response
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

            return new Response(
                JSON.stringify({ text, raw: data }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // --- OPENROUTER HANDLER (Default) ---
        const apiKey = clientApiKey || secrets.openrouter_api_key || Deno.env.get("OPENROUTER_API_KEY");

        if (!apiKey) {
            console.error("Missing OPENROUTER_API_KEY");
            return new Response(
                JSON.stringify({ error: "Server configuration error" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Default to Grok 4.1 Fast as requested, allow client override
        const model = (clientModel || "x-ai/grok-4.1-fast").trim();
        console.log(`Using AI Model: ${model}`);

        // Construct messages for OpenAI-compatible API
        let messages = [];
        if (history && Array.isArray(history)) {
            messages = history.map(msg => ({
                role: msg.role === 'model' ? 'assistant' : msg.role, // Map 'model' -> 'assistant'
                content: msg.parts // Assuming parts is string in simplified history
            }));
            // fixup content if it's not string
            messages = messages.map(m => {
                if (typeof m.content !== 'string' && Array.isArray(m.content)) {
                    return { ...m, content: m.content.map((p: any) => p.text || '').join('') };
                }
                return m;
            });
        }

        // Add current prompt
        if (prompt) {
            messages.push({
                role: 'user',
                content: prompt
            });
        }

        const url = "https://openrouter.ai/api/v1/chat/completions";

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://tenderflow.cz", // Required by OpenRouter
                "X-Title": "Tender Flow", // Optional by OpenRouter
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("OpenRouter API Error:", data);
            return new Response(
                JSON.stringify({ error: "AI Provider Error", details: data }),
                { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Extract text from OpenAI format
        const text = data.choices?.[0]?.message?.content || "";

        return new Response(
            JSON.stringify({ text, raw: data }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );

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
