
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

type MemoryVisibility = "public" | "internal";

interface AgentProjectMemoryDocument {
    meta: {
        projectId: string;
        updatedAt: string;
        updatedBy: string;
        version: number;
        sectionsVisibility: Record<string, MemoryVisibility>;
    };
    sections: Array<{
        title: string;
        visibility: MemoryVisibility;
        content: string;
    }>;
}

const defaultMemorySections: Array<{ title: string; visibility: MemoryVisibility }> = [
    { title: "Fakta (ověřená)", visibility: "internal" },
    { title: "Otevřené body", visibility: "internal" },
    { title: "Rozhodnutí", visibility: "internal" },
    { title: "Rizika", visibility: "internal" },
    { title: "Klientsky publikovatelné shrnutí", visibility: "public" },
];

const parseFrontmatter = (source: string): { frontmatter: Record<string, string>; body: string } => {
    if (!source.startsWith("---\n")) return { frontmatter: {}, body: source };

    const endMarker = source.indexOf("\n---\n", 4);
    if (endMarker === -1) return { frontmatter: {}, body: source };

    const raw = source.slice(4, endMarker);
    const body = source.slice(endMarker + 5);
    const frontmatter: Record<string, string> = {};

    raw.split("\n").forEach((line) => {
        const separator = line.indexOf(":");
        if (separator <= 0) return;
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim();
        frontmatter[key] = value;
    });

    return { frontmatter, body };
};

const parseSections = (
    body: string,
    sectionsVisibility: Record<string, MemoryVisibility>,
): AgentProjectMemoryDocument["sections"] => {
    const matches = Array.from(body.matchAll(/^##\s+(.+)$/gm));
    if (matches.length === 0) return [];

    return matches.map((match, index) => {
        const title = String(match[1] || "").trim();
        const start = (match.index || 0) + match[0].length;
        const end = index + 1 < matches.length ? (matches[index + 1].index || body.length) : body.length;
        const content = body.slice(start, end).trim();

        return {
            title,
            content,
            visibility: sectionsVisibility[title] || "internal",
        };
    });
};

const createDefaultMemoryDocument = (projectId: string, userId: string): AgentProjectMemoryDocument => ({
    meta: {
        projectId,
        updatedAt: new Date().toISOString(),
        updatedBy: userId,
        version: 1,
        sectionsVisibility: defaultMemorySections.reduce((acc, item) => {
            acc[item.title] = item.visibility;
            return acc;
        }, {} as Record<string, MemoryVisibility>),
    },
    sections: defaultMemorySections.map((item) => ({
        title: item.title,
        visibility: item.visibility,
        content: "",
    })),
});

const parseMemoryDocument = (
    projectId: string,
    source: string,
    userId: string,
): AgentProjectMemoryDocument => {
    const { frontmatter, body } = parseFrontmatter(source);
    let sectionsVisibility: Record<string, MemoryVisibility> = {};

    try {
        sectionsVisibility = JSON.parse(frontmatter.sections_visibility || "{}");
    } catch {
        sectionsVisibility = {};
    }

    const sections = parseSections(body, sectionsVisibility);
    if (sections.length === 0) {
        return createDefaultMemoryDocument(projectId, userId);
    }

    return {
        meta: {
            projectId: frontmatter.project_id || projectId,
            updatedAt: frontmatter.updated_at || new Date().toISOString(),
            updatedBy: frontmatter.updated_by || userId,
            version: Number(frontmatter.version || 1) || 1,
            sectionsVisibility,
        },
        sections,
    };
};

const memoryDocumentToMarkdown = (document: AgentProjectMemoryDocument): string => {
    const header = [
        "---",
        `project_id: ${document.meta.projectId}`,
        `updated_at: ${document.meta.updatedAt}`,
        `updated_by: ${document.meta.updatedBy}`,
        `version: ${document.meta.version}`,
        `sections_visibility: ${JSON.stringify(document.meta.sectionsVisibility || {})}`,
        "---",
        "",
    ];

    const sectionBlocks = document.sections.map((section) => (
        [`## ${section.title}`, section.content.trim(), ""].join("\n")
    ));

    return [...header, ...sectionBlocks].join("\n").trimEnd() + "\n";
};

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

        const {
            action,
            prompt,
            history,
            model: clientModel,
            provider = 'openrouter',
            documentUrl
        } = body;
        console.log(`[Proxy] Processing request for provider: ${provider}, model: ${clientModel || 'default'}`);

        if (action === "memory-load" || action === "memory-save") {
            const projectId = typeof body?.projectId === "string" ? body.projectId.trim() : "";
            const bucket = typeof body?.bucket === "string" && body.bucket.trim().length > 0
                ? body.bucket.trim()
                : "agent-memory";

            if (!projectId) {
                return new Response(
                    JSON.stringify({ error: "Missing projectId" }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const { data: orgMember, error: orgError } = await service
                .from("organization_members")
                .select("organization_id")
                .eq("user_id", user.id)
                .limit(1)
                .maybeSingle();

            if (orgError || !orgMember?.organization_id) {
                return new Response(
                    JSON.stringify({ error: "Organization context not found" }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const storagePath = `org/${orgMember.organization_id}/projects/${projectId}/viki-memory.md`;

            if (action === "memory-load") {
                const { data: fileData, error: fileError } = await service.storage
                    .from(bucket)
                    .download(storagePath);

                if (fileError) {
                    const message = (fileError.message || "").toLowerCase();
                    if (message.includes("not found") || message.includes("does not exist")) {
                        return new Response(
                            JSON.stringify({ document: null }),
                            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                        );
                    }

                    return new Response(
                        JSON.stringify({ error: "Failed to load project memory", details: fileError.message }),
                        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }

                const source = await fileData.text();
                const document = parseMemoryDocument(projectId, source, user.id);

                return new Response(
                    JSON.stringify({ document }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const incomingDocument = body?.document as AgentProjectMemoryDocument | undefined;
            if (!incomingDocument || !Array.isArray(incomingDocument.sections)) {
                return new Response(
                    JSON.stringify({ error: "Invalid memory document payload" }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const normalizedSections = incomingDocument.sections.map((section) => ({
                title: String(section?.title || "").trim(),
                visibility: section?.visibility === "public" ? "public" : "internal",
                content: String(section?.content || "").trim(),
            })).filter((section) => section.title.length > 0);

            const normalizedDocument: AgentProjectMemoryDocument = {
                meta: {
                    projectId,
                    updatedAt: new Date().toISOString(),
                    updatedBy: user.id,
                    version: Math.max(1, Number(incomingDocument.meta?.version || 1)),
                    sectionsVisibility: normalizedSections.reduce((acc, section) => {
                        acc[section.title] = section.visibility;
                        return acc;
                    }, {} as Record<string, MemoryVisibility>),
                },
                sections: normalizedSections,
            };

            const markdown = memoryDocumentToMarkdown(normalizedDocument);
            const { error: uploadError } = await service.storage.from(bucket).upload(storagePath, markdown, {
                upsert: true,
                contentType: "text/markdown; charset=utf-8",
            });

            if (uploadError) {
                return new Response(
                    JSON.stringify({ error: "Failed to save project memory", details: uploadError.message }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            return new Response(
                JSON.stringify({ document: normalizedDocument }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (action === "list-models") {
            if (provider === "google") {
                const models = [
                    {
                        id: "gemini-1.5-flash",
                        label: "Gemini 1.5 Flash",
                        provider: "google",
                        capabilities: ["chat", "fast"],
                        pricingHint: "Úsporný"
                    },
                    {
                        id: "gemini-1.5-pro",
                        label: "Gemini 1.5 Pro",
                        provider: "google",
                        capabilities: ["chat", "quality"],
                        pricingHint: "Vyvážený"
                    },
                    {
                        id: "gemini-2.0-flash-001",
                        label: "Gemini 2.0 Flash",
                        provider: "google",
                        capabilities: ["chat", "fast"],
                        pricingHint: "Úsporný"
                    }
                ];

                return new Response(
                    JSON.stringify({ models }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            if (provider === "mistral") {
                const apiKey = (Deno.env.get("MISTRAL_API_KEY") || "").trim();
                if (!apiKey) {
                    return new Response(
                        JSON.stringify({ error: "Missing Mistral API Key", models: [] }),
                        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }

                const response = await fetch("https://api.mistral.ai/v1/models", {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`
                    },
                });
                const data = await response.json();

                if (!response.ok) {
                    return new Response(
                        JSON.stringify({ error: "Mistral model list error", details: data, models: [] }),
                        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }

                const rawModels = Array.isArray(data?.data) ? data.data : [];
                const models = rawModels
                    .map((model: any) => {
                        const id = typeof model?.id === "string" ? model.id : "";
                        if (!id) return null;
                        const lower = id.toLowerCase();
                        if (lower.includes("ocr") || lower.includes("embed") || lower.includes("moderation")) {
                            return null;
                        }
                        return {
                            id,
                            label: id,
                            provider: "mistral",
                            capabilities: ["chat"],
                            pricingHint: lower.includes("small") ? "Úsporný" : "Vyvážený"
                        };
                    })
                    .filter(Boolean);

                return new Response(
                    JSON.stringify({ models }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const apiKey = (Deno.env.get("OPENROUTER_API_KEY") || "").trim();
            const response = await fetch("https://openrouter.ai/api/v1/models", {
                method: "GET",
                headers: {
                    ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {}),
                    "Content-Type": "application/json",
                },
            });
            const data = await response.json();

            if (!response.ok) {
                return new Response(
                    JSON.stringify({ error: "OpenRouter model list error", details: data, models: [] }),
                    { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const rawModels = Array.isArray(data?.data) ? data.data : [];
            const models = rawModels
                .map((model: any) => {
                    const id = typeof model?.id === "string" ? model.id : "";
                    if (!id) return null;
                    return {
                        id,
                        label: typeof model?.name === "string" && model.name.length > 0 ? model.name : id,
                        provider: "openrouter",
                        capabilities: ["chat"],
                        pricingHint: "Dle modelu",
                    };
                })
                .filter(Boolean);

            return new Response(
                JSON.stringify({ models }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // --- GOOGLE GEMINI HANDLER ---
        if (provider === 'google') {
            const apiKey = (
                Deno.env.get("GEMINI_API_KEY")
                || Deno.env.get("GOOGLE_API_KEY")
                || ""
            ).trim();
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
            const apiKey = (Deno.env.get("MISTRAL_API_KEY") || "").trim();
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
            const apiKey = (Deno.env.get("MISTRAL_API_KEY") || "").trim();
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
        const apiKey = (Deno.env.get("OPENROUTER_API_KEY") || "").trim();
        if (!apiKey) {
            return new Response(
                JSON.stringify({ error: "Missing OpenRouter API Key" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const model = clientModel || "anthropic/claude-3-haiku";
        console.log(`Using OpenRouter Model: ${model}`);

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
                    details: data
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
