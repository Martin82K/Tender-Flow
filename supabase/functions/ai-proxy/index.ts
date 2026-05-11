
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getFirstEnvSecret } from "../_shared/env.ts";
import { buildCorsHeaders, handleCors } from "../_shared/cors.ts";
import { resolveAuthorizedProjectMemoryContext } from "./memoryAccess.ts";

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
const VIKI_FEATURE_KEY = "ai_viki";
const MEMORY_BUCKET = "agent-memory";
const MAX_PROMPT_CHARS = 20_000;
const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_MESSAGE_CHARS = 4_000;
const MAX_TOTAL_INPUT_CHARS = 30_000;
const MAX_DOCUMENT_URL_CHARS = 2_048;
const MAX_OUTPUT_TOKENS = 1_500;
const MAX_AI_USER_REQUESTS_PER_HOUR = 40;
const MAX_AI_ORG_REQUESTS_PER_HOUR = 240;
const MAX_AI_USER_REQUESTS_PER_DAY = 160;
const MAX_AI_ORG_REQUESTS_PER_DAY = 1_000;

type AiProvider = "openrouter" | "google" | "openai" | "mistral" | "mistral-ocr";

const AI_MODEL_ALLOWLIST: Record<AiProvider, readonly string[]> = {
    openrouter: [
        "anthropic/claude-3-haiku",
        "anthropic/claude-3.5-sonnet",
        "anthropic/claude-sonnet-4",
        "google/gemini-2.0-flash-001",
    ],
    google: [
        "gemini-pro",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-2.0-flash-001",
        "gemini-2.0-flash-exp",
    ],
    openai: ["gpt-5-mini"],
    mistral: ["mistral-small-latest", "mistral-large-latest", "mistral-medium-latest"],
    "mistral-ocr": ["mistral-ocr-latest"],
};

const DEFAULT_AI_MODEL: Record<AiProvider, string> = {
    openrouter: "anthropic/claude-3-haiku",
    google: "gemini-1.5-flash",
    openai: "gpt-5-mini",
    mistral: "mistral-small-latest",
    "mistral-ocr": "mistral-ocr-latest",
};

const normalizeProvider = (value: unknown): AiProvider | null => {
    const provider = typeof value === "string" ? value.trim().toLowerCase() : "openrouter";
    return Object.prototype.hasOwnProperty.call(AI_MODEL_ALLOWLIST, provider)
        ? provider as AiProvider
        : null;
};

const resolveAllowedModel = (provider: AiProvider, value: unknown): string | null => {
    const requested = typeof value === "string" && value.trim()
        ? value.trim()
        : DEFAULT_AI_MODEL[provider];
    return AI_MODEL_ALLOWLIST[provider].includes(requested) ? requested : null;
};

const sanitizeText = (value: unknown, maxLength: number): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, maxLength);
};

const textFromMessage = (message: any): string | null => {
    if (typeof message?.content === "string") return sanitizeText(message.content, MAX_HISTORY_MESSAGE_CHARS);
    if (typeof message?.parts === "string") return sanitizeText(message.parts, MAX_HISTORY_MESSAGE_CHARS);
    if (Array.isArray(message?.parts)) {
        return sanitizeText(
            message.parts
                .map((part: any) => typeof part?.text === "string" ? part.text : "")
                .filter(Boolean)
                .join("\n"),
            MAX_HISTORY_MESSAGE_CHARS,
        );
    }
    return null;
};

const sanitizeHistory = (value: unknown): Array<{ role: "user" | "assistant"; content: string }> => {
    if (!Array.isArray(value)) return [];
    return value
        .slice(-MAX_HISTORY_MESSAGES)
        .map((message: any) => {
            const content = textFromMessage(message);
            if (!content) return null;
            return {
                role: message?.role === "assistant" || message?.role === "model" ? "assistant" : "user",
                content,
            };
        })
        .filter((message): message is { role: "user" | "assistant"; content: string } => Boolean(message));
};

const inputLength = (promptText: string | null, messages: Array<{ content: string }>) =>
    (promptText?.length || 0) + messages.reduce((sum, message) => sum + message.content.length, 0);

const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

const sha256Hex = async (value: string): Promise<string> => {
    const encoded = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
};

const sanitizeDocumentUrl = (value: unknown, supabaseUrl: string): string | null => {
    const candidate = sanitizeText(value, MAX_DOCUMENT_URL_CHARS);
    if (!candidate) return null;

    try {
        const url = new URL(candidate);
        const allowedHost = new URL(supabaseUrl).hostname;
        if (!["https:", "http:"].includes(url.protocol)) return null;
        if (url.hostname !== allowedHost) return null;
        return url.toString();
    } catch {
        return null;
    }
};

const json = (req: Request, status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
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

const countAiUsage = async (
    service: any,
    column: "user_id" | "organization_id",
    value: string,
    sinceIso: string,
): Promise<number> => {
    const { count, error } = await service
        .from("ai_agent_usage_events")
        .select("id", { count: "exact", head: true })
        .eq(column, value)
        .gte("created_at", sinceIso);

    if (error) throw new Error("Failed to verify AI quota");
    return count || 0;
};

const checkAiQuota = async (service: any, userId: string, organizationId: string) => {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [userHour, orgHour, userDay, orgDay] = await Promise.all([
        countAiUsage(service, "user_id", userId, hourAgo),
        countAiUsage(service, "organization_id", organizationId, hourAgo),
        countAiUsage(service, "user_id", userId, dayAgo),
        countAiUsage(service, "organization_id", organizationId, dayAgo),
    ]);

    if (userHour >= MAX_AI_USER_REQUESTS_PER_HOUR) return { ok: false, scope: "user_hour" };
    if (orgHour >= MAX_AI_ORG_REQUESTS_PER_HOUR) return { ok: false, scope: "org_hour" };
    if (userDay >= MAX_AI_USER_REQUESTS_PER_DAY) return { ok: false, scope: "user_day" };
    if (orgDay >= MAX_AI_ORG_REQUESTS_PER_DAY) return { ok: false, scope: "org_day" };
    return { ok: true, scope: null };
};

const recordAiUsage = async (
    service: any,
    input: {
        organizationId: string;
        userId: string;
        provider: AiProvider;
        model: string;
        promptText: string | null;
        historyMessages: Array<{ content: string }>;
        outputText: string;
        action?: string;
        hasDocumentUrl: boolean;
        usage?: any;
    },
) => {
    const inputTokens = Number(input.usage?.input_tokens || input.usage?.prompt_tokens)
        || estimateTokens([
            input.promptText || "",
            ...input.historyMessages.map((message) => message.content),
        ].join("\n"));
    const outputTokens = Number(input.usage?.output_tokens || input.usage?.completion_tokens)
        || estimateTokens(input.outputText);
    const totalTokens = Number(input.usage?.total_tokens) || inputTokens + outputTokens;

    const { error } = await service.from("ai_agent_usage_events").insert({
        organization_id: input.organizationId,
        user_id: input.userId,
        trace_id: crypto.randomUUID(),
        idempotency_key: crypto.randomUUID(),
        request_mode: "chat",
        response_source: "llm",
        model: `${input.provider}:${input.model}`,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        estimated_cost_usd: 0,
        tool_calls: [],
        policy_decision: "auto_execute",
        guard_triggered: false,
        metadata: {
            provider: input.provider,
            model: input.model,
            action: input.action || "chat",
            hasDocumentUrl: input.hasDocumentUrl,
            retention: "metadata_only",
        },
    });

    if (error) {
        console.error("Failed to record AI usage:", error.message || error);
    }
};

// Native Deno.serve (more robust)
Deno.serve(async (req) => {
    // Handle CORS preflight request
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

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
                    headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
                }
            );
        }

        // 2. Authentication & Authorization
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

        // Helper: Create Service Client
        const createServiceClient = () => createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

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
        const authed = createClient(supabaseUrl, apikey, {
            auth: { persistSession: false },
            global: {
                headers: {
                    apikey,
                    Authorization: authHeader,
                },
            },
        });

        // 3. Parse request body before access control so Viki-specific actions can
        // follow ai_viki feature flags instead of generic tier gating.
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

        const service = createServiceClient();

        const {
            action,
            prompt,
            history,
            model: clientModel,
            provider = 'openrouter',
            documentUrl
        } = body;
        const normalizedProvider = normalizeProvider(provider);
        if (!normalizedProvider) {
            return json(req, 400, {
                error: "Invalid AI provider",
                allowedProviders: Object.keys(AI_MODEL_ALLOWLIST),
            });
        }

        const promptText = sanitizeText(prompt, MAX_PROMPT_CHARS);
        const historyMessages = sanitizeHistory(history);
        const totalInputChars = inputLength(promptText, historyMessages);
        if (totalInputChars > MAX_TOTAL_INPUT_CHARS) {
            return json(req, 413, {
                error: "AI input is too large",
                maxInputCharacters: MAX_TOTAL_INPUT_CHARS,
            });
        }

        const safeDocumentUrl = documentUrl
            ? sanitizeDocumentUrl(documentUrl, supabaseUrl)
            : null;
        if (documentUrl && !safeDocumentUrl) {
            return json(req, 400, { error: "Invalid documentUrl" });
        }

        const resolvedModel = resolveAllowedModel(normalizedProvider, clientModel);
        if (!resolvedModel) {
            return json(req, 400, {
                error: "AI model is not allowed",
                provider: normalizedProvider,
                allowedModels: AI_MODEL_ALLOWLIST[normalizedProvider],
            });
        }

        console.log(`[Proxy] Processing request for provider: ${normalizedProvider}, model: ${resolvedModel}`);

        const isVikiScopedAction = action === "memory-load" || action === "memory-save" || action === "list-models";

        if (isVikiScopedAction) {
            const { data: hasVikiAccess, error: accessError } = await service.rpc("user_id_has_feature", {
                target_user_id: user.id,
                feature_key: VIKI_FEATURE_KEY,
            });

            if (accessError) {
                console.error("Viki access check error:", accessError);
                return new Response(
                    JSON.stringify({ error: "Failed to verify Viki access" }),
                    { status: 500, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
                );
            }

            if (!hasVikiAccess) {
                return new Response(
                    JSON.stringify({
                        error: "Viki feature disabled",
                        feature: VIKI_FEATURE_KEY,
                    }),
                    {
                        status: 403,
                        headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" }
                    }
                );
            }
        } else {
            const { data: tier, error: tierError } = await service.rpc('get_user_subscription_tier', { target_user_id: user.id });

            if (tierError) {
                console.error("Tier check error:", tierError);
                return new Response(
                    JSON.stringify({ error: "Failed to verify subscription" }),
                    { status: 500, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
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
                        headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" }
                    }
                );
            }
        }

        if (action === "memory-load" || action === "memory-save") {
            const projectId = typeof body?.projectId === "string" ? body.projectId.trim() : "";
            if (!projectId) {
                return new Response(
                    JSON.stringify({ error: "Missing projectId" }),
                    { status: 400, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
                );
            }

            const projectAccess = await resolveAuthorizedProjectMemoryContext(
                authed,
                projectId,
                user.id,
                action === "memory-save" ? "edit" : "view",
            );
            if (!projectAccess.ok) {
                const error = projectAccess.error === "PROJECT_ORGANIZATION_MISSING"
                    ? "Project organization context not found"
                    : "No access to project";
                const status = projectAccess.error === "PROJECT_ORGANIZATION_MISSING" ? 400 : 403;

                return new Response(
                    JSON.stringify({ error }),
                    { status, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
                );
            }

            const storagePath = `org/${projectAccess.value.organizationId}/projects/${projectAccess.value.projectId}/viki-memory.md`;

            if (action === "memory-load") {
                const { data: fileData, error: fileError } = await service.storage
                    .from(MEMORY_BUCKET)
                    .download(storagePath);

                if (fileError) {
                    const message = (fileError.message || "").toLowerCase();
                    if (message.includes("not found") || message.includes("does not exist")) {
                        return new Response(
                            JSON.stringify({ document: null }),
                            { headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
                        );
                    }

                    return new Response(
                        JSON.stringify({ error: "Failed to load project memory", details: fileError.message }),
                        { status: 500, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
                    );
                }

                const source = await fileData.text();
                const document = parseMemoryDocument(projectId, source, user.id);

                return new Response(
                    JSON.stringify({ document }),
                    { headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
                );
            }

            const incomingDocument = body?.document as AgentProjectMemoryDocument | undefined;
            if (!incomingDocument || !Array.isArray(incomingDocument.sections)) {
                return new Response(
                    JSON.stringify({ error: "Invalid memory document payload" }),
                    { status: 400, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
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
            const { error: uploadError } = await service.storage.from(MEMORY_BUCKET).upload(storagePath, markdown, {
                upsert: true,
                contentType: "text/markdown; charset=utf-8",
            });

            if (uploadError) {
                return new Response(
                    JSON.stringify({ error: "Failed to save project memory", details: uploadError.message }),
                    { status: 500, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
                );
            }

            return new Response(
                JSON.stringify({ document: normalizedDocument }),
                { headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
            );
        }

        if (action === "list-models") {
            const models = AI_MODEL_ALLOWLIST[normalizedProvider].map((id) => ({
                id,
                label: id,
                provider: normalizedProvider,
                capabilities: normalizedProvider === "mistral-ocr" ? ["ocr"] : ["chat"],
                pricingHint: id.includes("small") || id.includes("flash") || id.includes("haiku") || id.includes("mini")
                    ? "Úsporný"
                    : "Vyvážený",
            }));

            return new Response(
                JSON.stringify({ models }),
                { headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
            );
        }

        if (!promptText && historyMessages.length === 0 && !safeDocumentUrl) {
            return json(req, 400, { error: "Missing AI input" });
        }

        const organizationId = await resolveUserOrganizationId(service, user.id);
        if (!organizationId) {
            return json(req, 403, { error: "Organization membership required" });
        }

        const quota = await checkAiQuota(service, user.id, organizationId);
        if (!quota.ok) {
            return json(req, 429, {
                error: "AI rate limit exceeded",
                scope: quota.scope,
            });
        }

        const safetyIdentifier = await sha256Hex(`tf:${user.id}`);

        // --- GOOGLE GEMINI HANDLER ---
        if (normalizedProvider === 'google') {
            const { value: apiKey } = getFirstEnvSecret("GEMINI_API_KEY", "GOOGLE_API_KEY");
            if (!apiKey) {
                return new Response(
                    JSON.stringify({ error: "Missing Google API Key" }),
                    { status: 500, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
                );
            }

            const model = resolvedModel;
            const contents = historyMessages.map((msg) => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            }));
            if (promptText) contents.push({ role: 'user', parts: [{ text: promptText }] });

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents,
                    generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
                }),
            });
            const data = await response.json();

            if (!response.ok) {
                 return new Response(
                    JSON.stringify({ error: "Google API Error", details: data }),
                    { status: response.status, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
                );
            }
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            await recordAiUsage(service, {
                organizationId,
                userId: user.id,
                provider: normalizedProvider,
                model,
                promptText,
                historyMessages,
                outputText: text,
                action,
                hasDocumentUrl: Boolean(safeDocumentUrl),
                usage: data?.usageMetadata,
            });
            return new Response(
                JSON.stringify({ text, raw: data }),
                { headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
            );
        }

        // --- OPENAI HANDLER ---
        if (normalizedProvider === "openai") {
            const { value: apiKey, key: apiKeySource } = getFirstEnvSecret("OPENAI_API_KEY", "OPEN_AI_API_KEY");
            if (!apiKey) {
                return new Response(
                    JSON.stringify({ error: "Missing OpenAI API Key (OPENAI_API_KEY/OPEN_AI_API_KEY)" }),
                    { status: 500, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
                );
            }

            const model = resolvedModel;
            const input = promptText
                ? promptText
                : historyMessages
                    .map((msg) => `${msg.role}: ${msg.content}`)
                    .join("\n");

            const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                    "OpenAI-Safety-Identifier": safetyIdentifier,
                },
                body: JSON.stringify({
                    model,
                    input,
                    max_output_tokens: MAX_OUTPUT_TOKENS,
                    text: { format: { type: "text" } }
                }),
            });

            const data = await openAiResponse.json();
            if (!openAiResponse.ok) {
                return new Response(
                    JSON.stringify({
                        error: "OpenAI API Error",
                        details: data,
                        hint: openAiResponse.status === 401
                            ? `OpenAI returned 401. Verify Supabase Secret ${apiKeySource || "OPENAI_API_KEY"} has a valid key without extra quotes and redeploy ai-proxy.`
                            : undefined
                    }),
                    { status: openAiResponse.status, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
                );
            }

            const text =
                typeof data?.output_text === "string"
                    ? data.output_text
                    : Array.isArray(data?.output)
                        ? data.output
                            .flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
                            .map((content: any) => (typeof content?.text === "string" ? content.text : ""))
                            .join("\n")
                            .trim()
                        : "";

            await recordAiUsage(service, {
                organizationId,
                userId: user.id,
                provider: normalizedProvider,
                model,
                promptText,
                historyMessages,
                outputText: text,
                action,
                hasDocumentUrl: Boolean(safeDocumentUrl),
                usage: data?.usage,
            });
            return new Response(
                JSON.stringify({ text, raw: data }),
                { headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
            );
        }

            // --- MISTRAL OCR HANDLER ---
        if (normalizedProvider === 'mistral-ocr') {
            const { value: apiKey, key: apiKeySource } = getFirstEnvSecret("MISTRAL_API_KEY", "MISTRAL_OCR_API_KEY");
            if (!apiKey) {
                return new Response(
                    JSON.stringify({ error: "Missing Mistral API Key (MISTRAL_API_KEY/MISTRAL_OCR_API_KEY)" }),
                    { status: 500, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
                );
            }

            if (!safeDocumentUrl) {
                return new Response(
                    JSON.stringify({ error: "Missing documentUrl for Mistral OCR" }),
                    { status: 400, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
                );
            }

            const ocrModelName = resolvedModel;

            console.log("Calling Mistral OCR. Model:", ocrModelName);

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
                            document_url: safeDocumentUrl
                        }
                    })
                });

                const data = await ocrResponse.json();

                if (!ocrResponse.ok) {
                    console.error("Mistral OCR Error Response:", data);
                    return new Response(
                        JSON.stringify({
                            error: "Mistral OCR API Error",
                            details: data,
                            hint: ocrResponse.status === 401
                                ? `Mistral returned 401 Unauthorized. Verify Supabase Secret ${apiKeySource || "MISTRAL_API_KEY"} contains a valid key without extra quotes and redeploy ai-proxy.`
                                : undefined
                        }),
                        { status: ocrResponse.status, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
                    );
                }

                console.log("Mistral OCR Success. Pages:", data.pages?.length || 0);
                const pages = data.pages || [];
                const text = pages.map((p: any) => p.markdown).join("\n\n");

                await recordAiUsage(service, {
                    organizationId,
                    userId: user.id,
                    provider: normalizedProvider,
                    model: ocrModelName,
                    promptText,
                    historyMessages,
                    outputText: text,
                    action,
                    hasDocumentUrl: true,
                    usage: data?.usage,
                });
                return new Response(
                    JSON.stringify({ text, raw: data }),
                    { headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
                );
            } catch (mistralErr) {
                console.error("Mistral Fetched Failed:", mistralErr);
                return new Response(
                    JSON.stringify({ error: `Mistral Network Error: ${mistralErr instanceof Error ? mistralErr.message : String(mistralErr)}` }),
                    { status: 502, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
                );
            }
        }

        // --- MISTRAL CHAT HANDLER ---
        if (normalizedProvider === 'mistral') {
            const { value: apiKey, key: apiKeySource } = getFirstEnvSecret("MISTRAL_API_KEY", "MISTRAL_OCR_API_KEY");
            if (!apiKey) {
                return new Response(
                    JSON.stringify({ error: "Missing Mistral API Key (MISTRAL_API_KEY/MISTRAL_OCR_API_KEY)" }),
                    { status: 500, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
                );
            }

            const model = resolvedModel;
            console.log(`Using Mistral Model: ${model}`);
            const messages = promptText
                ? [{ role: "user", content: promptText }]
                : historyMessages.map((msg) => ({ role: msg.role, content: msg.content }));

            const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model,
                    messages,
                    max_tokens: MAX_OUTPUT_TOKENS,
                })
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Mistral API Error:", data);
                return new Response(
                    JSON.stringify({
                        error: "Mistral API Error",
                        details: data,
                        hint: response.status === 401
                            ? `Mistral returned 401 Unauthorized. Verify Supabase Secret ${apiKeySource || "MISTRAL_API_KEY"} contains a valid key without extra quotes and redeploy ai-proxy.`
                            : undefined
                    }),
                    { status: response.status, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
                );
            }

            const text = data.choices[0].message.content;
            await recordAiUsage(service, {
                organizationId,
                userId: user.id,
                provider: normalizedProvider,
                model,
                promptText,
                historyMessages,
                outputText: text,
                action,
                hasDocumentUrl: Boolean(safeDocumentUrl),
                usage: data?.usage,
            });
            return new Response(
                JSON.stringify({ text, raw: data }),
                { headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
            );
        }

        // --- OPENROUTER HANDLER (Default) ---
        const { value: apiKey, key: apiKeySource } = getFirstEnvSecret("OPENROUTER_API_KEY", "OPEN_ROUTER_API_KEY");
        if (!apiKey) {
            return new Response(
                JSON.stringify({ error: "Missing OpenRouter API Key (OPENROUTER_API_KEY/OPEN_ROUTER_API_KEY)" }),
                { status: 500, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
            );
        }

        const model = resolvedModel;
        console.log(`Using OpenRouter Model: ${model}`);

        const defaultOcrPrompt = "Extract all readable text from the document. Return plain text only.";
        const messages = safeDocumentUrl
            ? [
                {
                    role: "user",
                    content: [
                        { type: "text", text: promptText || defaultOcrPrompt },
                        { type: "image_url", image_url: { url: safeDocumentUrl } }
                    ]
                }
            ]
            : (promptText
                ? [{ role: "user", content: promptText }]
                : historyMessages.map((msg) => ({ role: msg.role, content: msg.content })));

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                messages,
                max_tokens: MAX_OUTPUT_TOKENS,
            }),
        });

        const data = await response.json();
        if (!response.ok) {
            console.error("OpenRouter API Error:", data);
            return new Response(
                JSON.stringify({ 
                    error: "OpenRouter API Error", 
                    details: data,
                    hint: response.status === 401
                        ? `OpenRouter returned 401. Verify Supabase Secret ${apiKeySource || "OPENROUTER_API_KEY"} has a valid key without extra quotes and redeploy ai-proxy.`
                        : undefined
                }),
                { status: response.status, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
            );
        }

        const text = data.choices[0].message.content;
        await recordAiUsage(service, {
            organizationId,
            userId: user.id,
            provider: normalizedProvider,
            model,
            promptText,
            historyMessages,
            outputText: text,
            action,
            hasDocumentUrl: Boolean(safeDocumentUrl),
            usage: data?.usage,
        });
        return new Response(
            JSON.stringify({ text, raw: data }),
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
