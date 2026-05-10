import { buildCorsHeaders, handleCors } from "../_shared/cors.ts";
import { getFirstEnvSecret } from "../_shared/env.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";
import { getVikyInstructions } from "../_shared/vikyPersona.ts";

const MODEL = "gpt-5-mini";
const FEATURE_KEY = "feature_voice_assistant";
const MAX_TEXT_REQUESTS_PER_HOUR = 80;
const MAX_HISTORY_MESSAGES = 8;
const MAX_INPUT_LENGTH = 6_000;

const allowedViews = new Set([
  "command-center",
  "project",
  "contacts",
  "settings",
  "project-management",
  "project-overview",
  "url-shortener",
]);

const tools = [
  {
    type: "function",
    name: "list_projects",
    description: "Vypíše dostupné stavby/projekty uživatele z aktuálně načteného read-only kontextu. Použij pro dotazy typu jaké mám stavby nebo ukaž projekty.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        status: { type: "string" },
        limit: { type: "number" },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "find_project",
    description: "Najde stavby/projekty podle názvu, lokality, investora nebo stavu. Read-only.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string" },
        limit: { type: "number" },
      },
      required: ["query"],
    },
  },
  {
    type: "function",
    name: "get_project_detail",
    description: "Vrátí detail projektu včetně rozpočtů, dokumentů, VŘ a vítězů. Read-only.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "list_project_tenders",
    description: "Vypíše výběrová řízení/poptávkové kategorie v projektu. Read-only.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "get_tender_detail",
    description: "Vrátí detail konkrétního VŘ včetně nabídek, cen, poznámek, vítězů a navázaných smluv. Read-only.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
        tenderId: { type: "string" },
        tenderName: { type: "string" },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "get_tender_winner",
    description: "Najde vítěze konkrétního VŘ. Vítěz je nabídka ve stavu SOD; vrací i cenu, poznámky a navázanou smlouvu. Read-only.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
        tenderId: { type: "string" },
        tenderName: { type: "string" },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "list_tender_bids",
    description: "Vypíše nabídky v konkrétním VŘ včetně stavů a cen. Read-only.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
        tenderId: { type: "string" },
        tenderName: { type: "string" },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "list_project_winners",
    description: "Vypíše všechny vítěze VŘ v projektu. Read-only.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "find_contacts",
    description: "Najde kontakty/subdodavatele podle firmy, osoby, e-mailu nebo specializace. Read-only.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string" },
        limit: { type: "number" },
      },
      required: ["query"],
    },
  },
  {
    type: "function",
    name: "get_contact_detail",
    description: "Vrátí detail kontaktu/subdodavatele. Read-only.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        contactId: { type: "string" },
        query: { type: "string" },
        companyName: { type: "string" },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "get_schedule",
    description: "Vrátí termíny a harmonogram projektu. Read-only.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "get_tender_plan",
    description: "Vrátí plán výběrových řízení projektu. Read-only.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "get_contract_summary",
    description: "Vrátí smluvní a finanční přehled projektu včetně smluvních podmínek. Read-only.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "get_contract_detail",
    description: "Vrátí detail smlouvy podle contractId, firmy, VŘ nebo vítězné nabídky včetně pozastávek, zařízení staveniště, splatností, čerpání, faktur a poznámek. Read-only.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
        contractId: { type: "string" },
        companyName: { type: "string" },
        vendorName: { type: "string" },
        tenderId: { type: "string" },
        tenderName: { type: "string" },
        bidId: { type: "string" },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "list_upcoming_deadlines",
    description: "Vypíše blížící se termíny výběrových řízení. Read-only.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        rangeDays: { type: "number" },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "draft_followup_email",
    description: "Připraví návrh follow-up e-mailu bez odeslání. Read-only návrh.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        projectId: { type: "string" },
        contactId: { type: "string" },
        intent: { type: "string" },
      },
      required: ["projectId", "contactId"],
    },
  },
];

type MessageInput = {
  role?: unknown;
  content?: unknown;
};

type ToolOutputInput = {
  callId?: unknown;
  name?: unknown;
  output?: unknown;
};

const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), "content-type": "application/json" },
  });

const sanitizeString = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
};

const sha256Hex = async (value: string): Promise<string> => {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const sanitizeMessages = (messages: unknown): Array<{ role: string; content: string }> => {
  if (!Array.isArray(messages)) return [];
  return messages
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message: MessageInput) => {
      const role = message?.role === "assistant" ? "assistant" : "user";
      const content = sanitizeString(message?.content, 1_200);
      return content ? { role, content } : null;
    })
    .filter((message): message is { role: string; content: string } => Boolean(message));
};

const buildInitialInput = (input: string, messages: Array<{ role: string; content: string }>) => {
  const transcript = messages
    .map((message) => `${message.role === "assistant" ? "Viky" : "Uživatel"}: ${message.content}`)
    .join("\n");
  return [
    transcript ? `Dosavadní přepis:\n${transcript}` : "",
    `Aktuální textový dotaz uživatele:\n${input}`,
  ].filter(Boolean).join("\n\n");
};

const sanitizeToolOutputs = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).flatMap((item: ToolOutputInput) => {
    const callId = sanitizeString(item?.callId, 160);
    if (!callId) return [];
    const output = typeof item?.output === "string"
      ? item.output.slice(0, 20_000)
      : JSON.stringify(item?.output ?? null).slice(0, 20_000);
    return [{ type: "function_call_output", call_id: callId, output }];
  });
};

const extractText = (data: any): string => {
  if (typeof data?.output_text === "string") return data.output_text.trim();
  if (!Array.isArray(data?.output)) return "";
  return data.output
    .flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
    .map((content: any) => typeof content?.text === "string" ? content.text : "")
    .join("\n")
    .trim();
};

const extractToolCalls = (data: any) => {
  if (!Array.isArray(data?.output)) return [];
  return data.output
    .filter((item: any) => item?.type === "function_call" && typeof item?.name === "string")
    .map((item: any) => ({
      id: String(item.id || item.call_id || crypto.randomUUID()),
      callId: String(item.call_id || item.id || ""),
      name: String(item.name),
      arguments: typeof item.arguments === "string" ? item.arguments : JSON.stringify(item.arguments || {}),
    }))
    .filter((item: { callId: string }) => item.callId);
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return json(req, 405, { error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(req, 401, { error: "Unauthorized" });

    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) return json(req, 401, { error: "Unauthorized" });

    const service = createServiceClient();
    const userId = userData.user.id;
    const body = await req.json().catch(() => ({}));
    const currentProjectId = sanitizeString(body?.currentProjectId, 80);
    const requestedView = sanitizeString(body?.currentView, 80);
    const currentView = requestedView && allowedViews.has(requestedView) ? requestedView : "command-center";
    const input = sanitizeString(body?.input, MAX_INPUT_LENGTH);
    const previousResponseId = sanitizeString(body?.previousResponseId, 160);
    const toolOutputs = sanitizeToolOutputs(body?.toolOutputs);

    if (!input && !previousResponseId) {
      return json(req, 400, { error: "Missing text input" });
    }

    if (previousResponseId && toolOutputs.length === 0) {
      return json(req, 400, { error: "Missing tool outputs" });
    }

    const { data: membership, error: membershipError } = await service
      .from("organization_members")
      .select("organization_id,is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (membershipError) return json(req, 500, { error: "Failed to verify organization" });
    const organizationId = membership?.organization_id;
    if (!organizationId) return json(req, 403, { error: "Organization membership required" });

    const { data: platformAdmin, error: adminError } = await service
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (adminError) return json(req, 500, { error: "Failed to verify admin access" });
    if (!platformAdmin) return json(req, 403, { error: "Voice assistant is admin-only" });

    const { data: hasAccess, error: accessError } = await service.rpc("user_id_has_feature", {
      target_user_id: userId,
      feature_key: FEATURE_KEY,
    });

    if (accessError) return json(req, 500, { error: "Failed to verify feature access" });
    if (!hasAccess) return json(req, 403, { error: "Voice assistant is not enabled" });

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: rateError } = await service
      .from("ai_voice_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .in("event_type", ["text_response", "text_tool_call"])
      .gte("created_at", since);

    if (rateError) return json(req, 500, { error: "Failed to verify rate limit" });
    if ((count || 0) >= MAX_TEXT_REQUESTS_PER_HOUR) {
      return json(req, 429, { error: "Text assistant rate limit exceeded" });
    }

    const { value: apiKey } = getFirstEnvSecret("OPENAI_API_KEY");
    if (!apiKey) return json(req, 500, { error: "OpenAI API key is not configured" });

    const safetyIdentifier = await sha256Hex(`tf:${userId}`);
    const messages = sanitizeMessages(body?.messages);
    const responseInput = previousResponseId
      ? toolOutputs
      : buildInitialInput(input || "", messages);
    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "OpenAI-Safety-Identifier": safetyIdentifier,
      },
      body: JSON.stringify({
        model: MODEL,
        instructions: getVikyInstructions({ mode: "text", currentProjectId }),
        input: responseInput,
        previous_response_id: previousResponseId || undefined,
        tools,
        tool_choice: "auto",
        parallel_tool_calls: false,
        max_output_tokens: 1400,
        reasoning: { effort: "minimal" },
        text: { format: { type: "text" }, verbosity: "low" },
        metadata: {
          assistant: "viky",
          mode: "text",
          currentView,
          organizationId,
        },
      }),
    });

    const openAiJson = await openAiResponse.json().catch(() => ({}));
    if (!openAiResponse.ok) {
      const message =
        typeof openAiJson?.error?.message === "string"
          ? openAiJson.error.message.slice(0, 300)
          : "unknown";
      return json(req, openAiResponse.status, {
        error: "OpenAI odmítl textovou odpověď Viky.",
        details: message,
      });
    }

    const responseId = typeof openAiJson?.id === "string" ? openAiJson.id : crypto.randomUUID();
    const toolCalls = extractToolCalls(openAiJson);
    const usage = openAiJson?.usage && typeof openAiJson.usage === "object" ? openAiJson.usage : undefined;

    await service.from("ai_voice_usage_events").insert({
      organization_id: organizationId,
      user_id: userId,
      event_type: toolCalls.length > 0 ? "text_tool_call" : "text_response",
      provider: "openai",
      cost_mode: "standard",
      metadata: {
        assistantName: "Viky",
        model: MODEL,
        currentProjectId,
        currentView,
        responseId,
        toolNames: toolCalls.map((call: { name: string }) => call.name),
        retention: "metadata_only",
      },
    });

    if (toolCalls.length > 0) {
      return json(req, 200, {
        kind: "tool_calls",
        responseId,
        model: MODEL,
        toolCalls,
        usage,
      });
    }

    return json(req, 200, {
      kind: "message",
      responseId,
      model: MODEL,
      text: extractText(openAiJson),
      usage,
    });
  } catch (error) {
    console.error("[viky-text-response] unexpected error", error instanceof Error ? error.message : String(error));
    return json(req, 500, { error: "Unexpected text assistant error" });
  }
});
