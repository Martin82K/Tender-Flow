import { buildCorsHeaders, handleCors } from "../_shared/cors.ts";
import { getFirstEnvSecret } from "../_shared/env.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";
import { getVikyInstructions } from "../_shared/vikyPersona.ts";

const DEFAULT_MODEL = "gpt-realtime-2";
const ALLOWED_MODELS = new Set(["gpt-realtime-2", "gpt-realtime"]);
const FEATURE_KEY = "feature_voice_assistant";
const MAX_SESSIONS_PER_HOUR = 20;
const ASSISTANT_NAME = "Viky";
const VIKY_REALTIME_VOICE = "marin";

const allowedViews = new Set([
  "command-center",
  "project",
  "contacts",
  "settings",
  "project-management",
  "project-overview",
  "url-shortener",
]);

const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), "content-type": "application/json" },
  });

const sha256Hex = async (value: string): Promise<string> => {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const sanitizeString = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
};

const resolveRealtimeModel = (value: unknown): string =>
  typeof value === "string" && ALLOWED_MODELS.has(value) ? value : DEFAULT_MODEL;

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
    const realtimeModel = resolveRealtimeModel(body?.realtimeModel);

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
      .eq("event_type", "realtime_session")
      .gte("created_at", since);

    if (rateError) return json(req, 500, { error: "Failed to verify rate limit" });
    if ((count || 0) >= MAX_SESSIONS_PER_HOUR) {
      return json(req, 429, { error: "Voice assistant rate limit exceeded" });
    }

    const { value: apiKey } = getFirstEnvSecret("OPENAI_API_KEY");
    if (!apiKey) return json(req, 500, { error: "OpenAI API key is not configured" });

    const sessionId = crypto.randomUUID();
    const safetyIdentifier = await sha256Hex(`tf:${userId}`);
    const openaiResponse = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "OpenAI-Safety-Identifier": safetyIdentifier,
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: realtimeModel,
          instructions: getVikyInstructions({ mode: "voice", currentProjectId }),
          audio: {
            input: {
              transcription: {
                model: "gpt-4o-mini-transcribe",
                language: "cs",
                prompt: "Čeština. Očekávej názvy stavebních projektů, výběrových řízení, subdodavatelů, cen, termínů a zkratky Tender Flow.",
              },
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 550,
                create_response: false,
                interrupt_response: true,
              },
            },
            output: { voice: VIKY_REALTIME_VOICE },
          },
          tools,
        },
      }),
    });

    const openaiJson = await openaiResponse.json().catch(() => ({}));
    if (!openaiResponse.ok) {
      console.error("[realtime-session-create] OpenAI client secret failed", {
        status: openaiResponse.status,
        error: typeof openaiJson?.error?.message === "string" ? openaiJson.error.message.slice(0, 300) : "unknown",
      });
      const message =
        typeof openaiJson?.error?.message === "string"
          ? openaiJson.error.message.slice(0, 300)
          : "unknown";
      return json(req, 502, {
        error: "OpenAI Realtime odmítl konfiguraci hlasové session.",
        details: message,
      });
    }

    const clientSecret =
      typeof openaiJson?.client_secret?.value === "string"
        ? openaiJson.client_secret.value
        : typeof openaiJson?.value === "string"
          ? openaiJson.value
          : null;
    const expiresAt =
      typeof openaiJson?.client_secret?.expires_at === "number"
        ? new Date(openaiJson.client_secret.expires_at * 1000).toISOString()
        : typeof openaiJson?.expires_at === "number"
          ? new Date(openaiJson.expires_at * 1000).toISOString()
          : new Date(Date.now() + 60 * 1000).toISOString();
    const effectiveModel =
      typeof openaiJson?.session?.model === "string"
        ? openaiJson.session.model
        : realtimeModel;

    if (!clientSecret) return json(req, 502, { error: "Realtime session response is missing client secret" });
    if (effectiveModel !== realtimeModel) {
      console.error("[realtime-session-create] OpenAI returned unexpected realtime model", {
        expectedModel: realtimeModel,
        receivedModel: effectiveModel,
      });
      return json(req, 502, {
        error: "OpenAI Realtime vrátil neočekávaný model hlasové session.",
        expectedModel: realtimeModel,
        receivedModel: effectiveModel,
      });
    }

    await service.from("ai_voice_usage_events").insert({
      organization_id: organizationId,
      user_id: userId,
      event_type: "realtime_session",
      provider: "openai",
      cost_mode: "premium",
      metadata: {
        sessionId,
        assistantName: ASSISTANT_NAME,
        voice: VIKY_REALTIME_VOICE,
        model: effectiveModel,
        requestedModel: realtimeModel,
        currentProjectId,
        currentView,
        expiresAt,
        retention: "metadata_only",
      },
    });

    return json(req, 200, {
      clientSecret,
      expiresAt,
      sessionId,
      model: effectiveModel,
    });
  } catch (error) {
    console.error("[realtime-session-create] unexpected error", error instanceof Error ? error.message : String(error));
    return json(req, 500, { error: "Unexpected realtime session error" });
  }
});
