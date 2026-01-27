
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// CORS headers
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Define message interface for clarity
interface Message {
    role: string;
    content: string | any[];
}

// Native Deno.serve (more robust)
Deno.serve(async (req) => {
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
        const supabaseServiceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
        
        if (!supabaseUrl || !supabaseServiceKey) {
            console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
            return new Response(
                JSON.stringify({ error: "Server configuration error" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Helper: Create Service Client
        const createServiceClient = () => createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

        // Verify token directly against Auth API
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
        const service = createServiceClient();
        const { data: tier, error: tierError } = await service.rpc('get_user_subscription_tier', { target_user_id: user.id });

        if (tierError) {
            console.error("Tier check error:", tierError);
            return new Response(
                JSON.stringify({ error: "Failed to verify subscription" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

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

        const { prompt, history, model: clientModel, provider = 'openrouter', apiKey: clientApiKey, documentUrl } = body;
        console.log(`[Proxy] Processing request for provider: ${provider}, model: ${clientModel || 'default'}`);

        // Helper to get system secrets
        async function getSystemSecrects() {
            try {
                const service = createServiceClient();
                const { data, error } = await service
                    .from('app_secrets')
                    .select('google_api_key, openrouter_api_key, mistral_api_key')
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
                    JSON.stringify({ error: "Missing Google API Key" }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const model = (clientModel || "gemini-pro").trim();
            let contents = [];
            if (history && Array.isArray(history)) {
                contents = history.map((msg: any) => ({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: Array.isArray(msg.parts) ? msg.parts.map((p: any) => p.text).join('') : (typeof msg.parts === 'string' ? msg.parts : JSON.stringify(msg.parts)) }]
                }));
            }
            if (prompt) contents.push({ role: 'user', parts: [{ text: prompt }] });

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents }),
            });
            const data = await response.json();

            if (!response.ok) {
                 return new Response(
                    JSON.stringify({ error: "Google API Error", details: data }),
                    { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            return new Response(
                JSON.stringify({ text, raw: data }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

            // --- MISTRAL OCR HANDLER ---
        if (provider === 'mistral-ocr') {
            const apiKey = clientApiKey || secrets.mistral_api_key || Deno.env.get("MISTRAL_API_KEY");
            if (!apiKey) {
                return new Response(
                    JSON.stringify({ error: "Missing Mistral API Key" }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            if (!documentUrl) {
                return new Response(
                    JSON.stringify({ error: "Missing documentUrl for Mistral OCR" }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Sanitize model (prevent OpenRouter-style IDs from crashing native Mistral API)
            let ocrModelName = clientModel || "mistral-ocr-latest";
            if (ocrModelName.includes("mistralai/mistral-ocr") || ocrModelName === "mistralai/mistral-ocr") {
                ocrModelName = "mistral-ocr-latest";
            }

            console.log("Calling Mistral OCR for URL:", documentUrl, "Model:", ocrModelName);

            try {
                const ocrResponse = await fetch("https://api.mistral.ai/v1/ocr", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: ocrModelName,
                        document: {
                            type: "document_url",
                            document_url: documentUrl
                        }
                    })
                });

                const data = await ocrResponse.json();

                if (!ocrResponse.ok) {
                    console.error("Mistral OCR Error Response:", data);
                    return new Response(
                        JSON.stringify({ error: "Mistral OCR API Error", details: data }),
                        { status: ocrResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }

                console.log("Mistral OCR Success. Pages:", data.pages?.length || 0);
                const pages = data.pages || [];
                const text = pages.map((p: any) => p.markdown).join("\n\n");

                return new Response(
                    JSON.stringify({ text, raw: data }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            } catch (mistralErr) {
                console.error("Mistral Fetched Failed:", mistralErr);
                return new Response(
                    JSON.stringify({ error: `Mistral Network Error: ${mistralErr instanceof Error ? mistralErr.message : String(mistralErr)}` }),
                    { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
        }

        // --- MISTRAL CHAT HANDLER ---
        if (provider === 'mistral') {
            const apiKey = clientApiKey || secrets.mistral_api_key || Deno.env.get("MISTRAL_API_KEY");
            if (!apiKey) {
                return new Response(
                    JSON.stringify({ error: "Missing Mistral API Key" }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const model = clientModel || "mistral-small-latest";
            console.log(`Using Mistral Model: ${model}`);

            const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model,
                    messages: prompt ? [{ role: "user", content: prompt }] : history,
                })
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Mistral API Error:", data);
                return new Response(
                    JSON.stringify({ error: "Mistral API Error", details: data }),
                    { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const text = data.choices[0].message.content;
            return new Response(
                JSON.stringify({ text, raw: data }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // --- OPENROUTER HANDLER (Default) ---
        const apiKey = clientApiKey || secrets.openrouter_api_key || Deno.env.get("OPENROUTER_API_KEY");
        if (!apiKey) {
            return new Response(
                JSON.stringify({ error: "Missing OpenRouter API Key" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const model = clientModel || "anthropic/claude-3-haiku";
        console.log(`Using OpenRouter Model: ${model}`);
        
        // Debug key (safe)
        const keyDebug = {
            length: apiKey.length,
            prefix: apiKey.substring(0, 7) + '...',
            suffix: '...' + apiKey.substring(apiKey.length - 4)
        };
        console.log("Using OpenRouter Key:", keyDebug);

        const defaultOcrPrompt = "Extract all readable text from the document. Return plain text only.";
        const messages = documentUrl
            ? [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt || defaultOcrPrompt },
                        { type: "image_url", image_url: { url: documentUrl } }
                    ]
                }
            ]
            : (prompt ? [{ role: "user", content: prompt }] : history);

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                messages,
            }),
        });

        const data = await response.json();
        if (!response.ok) {
            console.error("OpenRouter API Error:", data);
            return new Response(
                JSON.stringify({ 
                    error: "OpenRouter API Error", 
                    details: data,
                    debug: {
                        key_info: keyDebug,
                        provider: provider
                    }
                }),
                { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const text = data.choices[0].message.content;
        return new Response(
            JSON.stringify({ text, raw: data }),
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
