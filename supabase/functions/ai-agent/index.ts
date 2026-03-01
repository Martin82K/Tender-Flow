import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

type AgentActionRisk = "read" | "write" | "delete";
type AgentPolicyDecision = "auto_execute" | "require_confirmation" | "denied";
type AgentMode = "chat" | "tool";
type AgentAutonomy = "read_only" | "semi_autonomous";
type AgentReplySource = "skill" | "llm" | "tool";

type ConversationItem = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ToolExecution = {
  tool: string;
  status: "ok" | "denied" | "error";
  reason?: string;
};

type PendingAction = {
  id: string;
  title: string;
  summary: string;
  skillId: string;
  risk: AgentActionRisk;
  requiresConfirmation: boolean;
  policyDecision?: AgentPolicyDecision;
  idempotencyKey?: string;
  payload?: Record<string, unknown>;
};

type AgentResponse = {
  reply: string;
  source: AgentReplySource;
  usedModel: {
    provider: "openai";
    model: string;
    source: "default" | "override";
  };
  toolExecutions: ToolExecution[];
  pendingAction?: PendingAction;
  guard: {
    triggered: boolean;
    reason?: string;
  };
  traceId: string;
};

type AgentRequest = {
  mode?: AgentMode;
  autonomy?: AgentAutonomy;
  idempotencyKey?: string;
  model?: {
    provider?: string;
    model?: string;
  };
  runtime?: {
    selectedProjectId?: string | null;
    organizationId?: string | null;
    userId?: string | null;
    sessionRiskLevel?: "low" | "elevated";
  };
  conversation?: Array<{
    role?: string;
    content?: unknown;
  }>;
};

type ToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5-mini";
const ALLOWED_TIERS = new Set(["pro", "enterprise", "admin"]);
const ALLOWED_PROJECT_STATUS = new Set(["tender", "realization", "archived"]);
const MAX_CONVERSATION_ITEMS = 30;
const MAX_CONTENT_LENGTH = 8_000;
const SEMI_AUTONOMOUS_WRITE_ALLOWLIST = new Set(["queue_status_update"]);

const TOOL_SPECS: Array<{
  name: string;
  description: string;
  risk: AgentActionRisk;
  parameters: Record<string, unknown>;
}> = [
  {
    name: "get_project_overview",
    description: "Vrati overeny prehled aktivniho projektu vcetne poctu kategorii a zakladnich metrik.",
    risk: "read",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "ID projektu" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "budget_anomaly_check",
    description: "Vyhleda kategorie s odchylkou mezi plan_budget a sod_budget.",
    risk: "read",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "ID projektu" },
        minAbsoluteDiff: { type: "number", description: "Minimalni absolutni odchylka v Kc" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "queue_status_update",
    description: "Navrhne nebo aplikuje zmenu statusu projektu po policy kontrole.",
    risk: "write",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "ID projektu" },
        status: { type: "string", enum: ["tender", "realization", "archived"] },
        reason: { type: "string", description: "Duvod zmeny" },
      },
      required: ["status"],
      additionalProperties: false,
    },
  },
];

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
    },
  });

const createServiceClient = () => {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
};

const normalizeString = (value: unknown, maxLength = MAX_CONTENT_LENGTH): string => {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
};

const normalizeConversation = (value: unknown): ConversationItem[] => {
  if (!Array.isArray(value)) return [];

  const normalized: ConversationItem[] = [];
  for (const item of value.slice(-MAX_CONVERSATION_ITEMS)) {
    const role = typeof item?.role === "string" ? item.role : "user";
    if (role !== "system" && role !== "user" && role !== "assistant") {
      continue;
    }

    let content = "";
    if (typeof item?.content === "string") {
      content = normalizeString(item.content);
    } else if (Array.isArray(item?.content)) {
      content = normalizeString(item.content.map((part: unknown) => String(part ?? "")).join(" "));
    } else {
      content = normalizeString(String(item?.content ?? ""));
    }

    if (!content) continue;
    normalized.push({ role, content });
  }

  return normalized;
};

const extractTextFromResponse = (raw: any): string => {
  if (typeof raw?.output_text === "string" && raw.output_text.trim()) {
    return raw.output_text.trim();
  }

  const chunks: string[] = [];
  if (Array.isArray(raw?.output)) {
    for (const item of raw.output) {
      if (typeof item?.text === "string" && item.text.trim()) {
        chunks.push(item.text.trim());
      }
      if (Array.isArray(item?.content)) {
        for (const part of item.content) {
          if (typeof part?.text === "string" && part.text.trim()) {
            chunks.push(part.text.trim());
          }
        }
      }
    }
  }

  return chunks.join("\n\n").trim();
};

const parseToolCalls = (raw: any): ToolCall[] => {
  if (!Array.isArray(raw?.output)) return [];

  const calls: ToolCall[] = [];
  for (const item of raw.output) {
    const callLike = item?.type === "function_call" || item?.type === "tool_call";
    if (!callLike) continue;

    const name = normalizeString(item?.name, 120);
    if (!name) continue;

    let args: Record<string, unknown> = {};
    const rawArgs = item?.arguments;
    if (typeof rawArgs === "string" && rawArgs.trim()) {
      try {
        const parsed = JSON.parse(rawArgs);
        if (parsed && typeof parsed === "object") {
          args = parsed as Record<string, unknown>;
        }
      } catch {
        args = {};
      }
    } else if (rawArgs && typeof rawArgs === "object") {
      args = rawArgs as Record<string, unknown>;
    }

    calls.push({
      id: normalizeString(item?.id || crypto.randomUUID(), 120),
      name,
      args,
    });
  }

  return calls;
};

const buildOpenAiTools = () => {
  return TOOL_SPECS.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
};

const resolvePolicyDecision = (args: {
  risk: AgentActionRisk;
  autonomy: AgentAutonomy;
  tool: string;
  sessionRiskLevel: "low" | "elevated";
}): AgentPolicyDecision => {
  if (args.risk === "read") {
    return "auto_execute";
  }
  if (args.risk === "delete") {
    return "require_confirmation";
  }
  if (args.risk === "write") {
    if (
      args.autonomy === "semi_autonomous" &&
      args.sessionRiskLevel === "low" &&
      SEMI_AUTONOMOUS_WRITE_ALLOWLIST.has(args.tool)
    ) {
      return "auto_execute";
    }
    return "require_confirmation";
  }
  return "denied";
};

const getProjectIdFromArgs = (
  toolArgs: Record<string, unknown>,
  fallbackProjectId: string | null,
): string | null => {
  const fromArgs = normalizeString(toolArgs.projectId, 120);
  if (fromArgs) return fromArgs;
  return fallbackProjectId;
};

const loadProjectForTenant = async (service: ReturnType<typeof createServiceClient>, args: {
  projectId: string;
  organizationId: string;
}) => {
  const { data, error } = await service
    .from("projects")
    .select("id,name,status,location,organization_id")
    .eq("id", args.projectId)
    .eq("organization_id", args.organizationId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Projekt nebyl nalezen nebo neni v pristupu organizace.");
  }

  return data as {
    id: string;
    name: string;
    status: string;
    location: string | null;
    organization_id: string;
  };
};

const loadCategoriesForProject = async (service: ReturnType<typeof createServiceClient>, projectId: string) => {
  const { data, error } = await service
    .from("demand_categories")
    .select("id,title,sod_budget,plan_budget,status")
    .eq("project_id", projectId);

  if (error) {
    throw new Error("Nepodarilo se nacist kategorie projektu.");
  }

  return Array.isArray(data) ? data : [];
};

const runTool = async (args: {
  toolName: string;
  toolArgs: Record<string, unknown>;
  service: ReturnType<typeof createServiceClient>;
  organizationId: string;
  fallbackProjectId: string | null;
}): Promise<{ text: string; payload?: Record<string, unknown> }> => {
  const projectId = getProjectIdFromArgs(args.toolArgs, args.fallbackProjectId);

  if (args.toolName === "get_project_overview") {
    if (!projectId) throw new Error("Chybi projectId.");

    const project = await loadProjectForTenant(args.service, {
      projectId,
      organizationId: args.organizationId,
    });
    const categories = await loadCategoriesForProject(args.service, projectId);

    const anomalies = categories.filter((category: any) => {
      const sod = Number(category.sod_budget || 0);
      const plan = Number(category.plan_budget || 0);
      return Math.abs(sod - plan) >= 100_000;
    }).length;

    return {
      text: [
        `Projekt: ${project.name}`,
        `Status: ${project.status || "neznamy"}`,
        `Lokalita: ${project.location || "neuvedena"}`,
        `Kategorie: ${categories.length}`,
        `Anomalie rozpoctu: ${anomalies}`,
      ].join("\n"),
      payload: {
        projectId,
        categories: categories.length,
        anomalies,
      },
    };
  }

  if (args.toolName === "budget_anomaly_check") {
    if (!projectId) throw new Error("Chybi projectId.");
    await loadProjectForTenant(args.service, {
      projectId,
      organizationId: args.organizationId,
    });

    const minAbsoluteDiff = Number(args.toolArgs.minAbsoluteDiff || 100_000);
    const categories = await loadCategoriesForProject(args.service, projectId);

    const anomalous = categories
      .map((category: any) => {
        const sod = Number(category.sod_budget || 0);
        const plan = Number(category.plan_budget || 0);
        return {
          title: String(category.title || "Bez nazvu"),
          diff: sod - plan,
          status: String(category.status || "open"),
        };
      })
      .filter((category) => Math.abs(category.diff) >= minAbsoluteDiff)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    if (anomalous.length === 0) {
      return {
        text: "Nenasla jsem zadne anomalie nad nastavenym prahem.",
        payload: { projectId, anomalies: [] },
      };
    }

    const lines = anomalous.slice(0, 8).map((item) => {
      const sign = item.diff >= 0 ? "+" : "-";
      return `- ${item.title}: ${sign}${Math.abs(Math.round(item.diff)).toLocaleString("cs-CZ")} Kc (stav: ${item.status})`;
    });

    return {
      text: [`Nalezene anomalie (${anomalous.length}):`, ...lines].join("\n"),
      payload: {
        projectId,
        anomalies: anomalous,
      },
    };
  }

  if (args.toolName === "queue_status_update") {
    if (!projectId) throw new Error("Chybi projectId.");
    const nextStatus = normalizeString(args.toolArgs.status, 40);
    if (!ALLOWED_PROJECT_STATUS.has(nextStatus)) {
      throw new Error("Nepodporovany cilovy status projektu.");
    }

    await loadProjectForTenant(args.service, {
      projectId,
      organizationId: args.organizationId,
    });

    const { error } = await args.service
      .from("projects")
      .update({ status: nextStatus })
      .eq("id", projectId)
      .eq("organization_id", args.organizationId);

    if (error) {
      throw new Error("Zmenu statusu se nepodarilo ulozit.");
    }

    const reason = normalizeString(args.toolArgs.reason, 200);
    return {
      text: `Status projektu byl aktualizovan na \"${nextStatus}\".${reason ? ` Duvod: ${reason}` : ""}`,
      payload: {
        projectId,
        status: nextStatus,
        reason,
      },
    };
  }

  throw new Error("Nepodporovany tool.");
};

const extractUsage = (
  raw: any,
): {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
} => {
  const usage = raw?.usage || {};
  const inputTokens = Number(usage?.input_tokens || usage?.prompt_tokens || 0);
  const outputTokens = Number(usage?.output_tokens || usage?.completion_tokens || 0);
  const totalTokens = Number(usage?.total_tokens || inputTokens + outputTokens);

  return {
    inputTokens: Number.isFinite(inputTokens) ? Math.max(0, Math.round(inputTokens)) : 0,
    outputTokens: Number.isFinite(outputTokens) ? Math.max(0, Math.round(outputTokens)) : 0,
    totalTokens: Number.isFinite(totalTokens) ? Math.max(0, Math.round(totalTokens)) : 0,
  };
};

const estimateCostUsd = (args: {
  model: string;
  inputTokens: number;
  outputTokens: number;
}): number => {
  // Conservative static estimates (USD per 1M tokens) for dashboard trend.
  // Billing source of truth should be reconciled with OpenAI Costs API.
  const pricingPerMillion: Record<string, { in: number; out: number }> = {
    "gpt-5-mini": { in: 0.25, out: 2.0 },
    "gpt-5": { in: 1.25, out: 10.0 },
    "gpt-4.1-mini": { in: 0.4, out: 1.6 },
    "gpt-4.1": { in: 2.0, out: 8.0 },
    "gpt-4o-mini": { in: 0.15, out: 0.6 },
  };

  const normalizedModel = args.model.toLowerCase();
  const matched = Object.keys(pricingPerMillion).find((key) => normalizedModel.includes(key));
  const pricing = matched ? pricingPerMillion[matched] : pricingPerMillion["gpt-5-mini"];

  const inputCost = (args.inputTokens / 1_000_000) * pricing.in;
  const outputCost = (args.outputTokens / 1_000_000) * pricing.out;
  return Number((inputCost + outputCost).toFixed(6));
};

const logUsageEvent = async (service: ReturnType<typeof createServiceClient>, payload: {
  organizationId: string;
  userId: string;
  traceId: string;
  idempotencyKey: string;
  mode: AgentMode;
  source: AgentReplySource;
  model: string;
  policyDecision: AgentPolicyDecision;
  guardTriggered: boolean;
  toolExecutions: ToolExecution[];
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}) => {
  try {
    await service.from("ai_agent_usage_events").upsert(
      {
        organization_id: payload.organizationId,
        user_id: payload.userId,
        trace_id: payload.traceId,
        idempotency_key: payload.idempotencyKey,
        request_mode: payload.mode,
        response_source: payload.source,
        model: payload.model,
        input_tokens: payload.inputTokens,
        output_tokens: payload.outputTokens,
        total_tokens: payload.totalTokens,
        estimated_cost_usd: payload.estimatedCostUsd,
        tool_calls: payload.toolExecutions,
        policy_decision: payload.policyDecision,
        guard_triggered: payload.guardTriggered,
        metadata: {},
      },
      { onConflict: "organization_id,idempotency_key" },
    );
  } catch {
    // usage table is optional in this phase
  }
};

const logAuditEvent = async (service: ReturnType<typeof createServiceClient>, payload: {
  traceId: string;
  organizationId: string;
  userId: string;
  toolCalls: ToolExecution[];
  decision: AgentPolicyDecision;
  mode: AgentMode;
}) => {
  console.log("[ai-agent-audit]", JSON.stringify(payload));

  try {
    await service.from("ai_agent_audit_logs").insert({
      trace_id: payload.traceId,
      organization_id: payload.organizationId,
      user_id: payload.userId,
      decision: payload.decision,
      mode: payload.mode,
      tool_calls: payload.toolCalls,
    });
  } catch {
    // audit table is optional in this phase
  }
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const traceId = crypto.randomUUID();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, {
        error: "Missing Authorization header",
        traceId,
      });
    }

    const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
    if (!supabaseUrl) {
      return jsonResponse(500, {
        error: "Missing SUPABASE_URL",
        traceId,
      });
    }

    const apikey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey,
        Authorization: authHeader,
      },
    });

    if (!authRes.ok) {
      return jsonResponse(401, {
        error: "Invalid token",
        traceId,
      });
    }

    const user = (await authRes.json()) as { id: string };
    const service = createServiceClient();

    const { data: tier, error: tierError } = await service.rpc("get_user_subscription_tier", {
      target_user_id: user.id,
    });

    if (tierError) {
      return jsonResponse(500, {
        error: "Failed to verify subscription",
        traceId,
      });
    }

    if (!ALLOWED_TIERS.has(String(tier || ""))) {
      return jsonResponse(403, {
        error: "Subscription required",
        tier: String(tier || "unknown"),
        traceId,
      });
    }

    const { data: orgMember, error: orgError } = await service
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (orgError || !orgMember?.organization_id) {
      return jsonResponse(403, {
        error: "Organization context not found",
        traceId,
      });
    }

    let body: AgentRequest;
    try {
      body = (await req.json()) as AgentRequest;
    } catch {
      return jsonResponse(400, {
        error: "Invalid JSON body",
        traceId,
      });
    }

    const idempotencyKey = normalizeString(
      req.headers.get("x-idempotency-key") || body?.idempotencyKey || "",
      120,
    );

    if (!idempotencyKey) {
      return jsonResponse(400, {
        error: "Missing idempotencyKey",
        traceId,
      });
    }

    const mode: AgentMode = body.mode === "tool" ? "tool" : "chat";
    const autonomy: AgentAutonomy = body.autonomy === "read_only" ? "read_only" : "semi_autonomous";
    const sessionRiskLevel = body.runtime?.sessionRiskLevel === "elevated" ? "elevated" : "low";

    const model = normalizeString(body?.model?.model, 120) || DEFAULT_MODEL;
    const conversation = normalizeConversation(body?.conversation);

    if (conversation.length === 0) {
      return jsonResponse(400, {
        error: "Missing conversation",
        traceId,
      });
    }

    const apiKey = (Deno.env.get("OPENAI_API_KEY") || "").trim();
    if (!apiKey) {
      return jsonResponse(500, {
        error: "Missing OPENAI_API_KEY",
        traceId,
      });
    }

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: conversation,
        tools: buildOpenAiTools(),
        tool_choice: mode === "tool" ? "required" : "auto",
        metadata: {
          trace_id: traceId,
          organization_id: orgMember.organization_id,
          user_id: user.id,
          idempotency_key: idempotencyKey,
        },
      }),
    });

    const raw = await response.json();
    if (!response.ok) {
      return jsonResponse(response.status, {
        error: "OpenAI Responses API error",
        details: raw,
        traceId,
      });
    }

    const baseText = extractTextFromResponse(raw);
    const toolCalls = parseToolCalls(raw);
    const toolExecutions: ToolExecution[] = [];
    const usage = extractUsage(raw);
    const estimatedCostUsd = estimateCostUsd({
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });

    const persistDecision = async (args: {
      decision: AgentPolicyDecision;
      source: AgentReplySource;
      guardTriggered: boolean;
    }) => {
      await Promise.all([
        logAuditEvent(service, {
          traceId,
          organizationId: orgMember.organization_id,
          userId: user.id,
          toolCalls: toolExecutions,
          decision: args.decision,
          mode,
        }),
        logUsageEvent(service, {
          organizationId: orgMember.organization_id,
          userId: user.id,
          traceId,
          idempotencyKey,
          mode,
          source: args.source,
          model,
          policyDecision: args.decision,
          guardTriggered: args.guardTriggered,
          toolExecutions,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
          estimatedCostUsd,
        }),
      ]);
    };

    const toolCall = toolCalls[0];
    if (!toolCall) {
      const out: AgentResponse = {
        reply: baseText || "Nemam dost podkladu pro odpoved.",
        source: "llm",
        usedModel: {
          provider: "openai",
          model,
          source: body?.model?.model ? "override" : "default",
        },
        toolExecutions,
        guard: { triggered: false },
        traceId,
      };
      await persistDecision({
        decision: "auto_execute",
        source: out.source,
        guardTriggered: false,
      });
      return jsonResponse(200, out);
    }

    const toolSpec = TOOL_SPECS.find((item) => item.name === toolCall.name);
    if (!toolSpec) {
      toolExecutions.push({
        tool: toolCall.name,
        status: "denied",
        reason: "tool_not_allowlisted",
      });

      const out: AgentResponse = {
        reply: "Tento typ akce nemohu z bezpecnostnich duvodu vykonat.",
        source: "llm",
        usedModel: {
          provider: "openai",
          model,
          source: body?.model?.model ? "override" : "default",
        },
        toolExecutions,
        guard: {
          triggered: true,
          reason: "tool_not_allowlisted",
        },
        traceId,
      };

      await persistDecision({
        decision: "denied",
        source: out.source,
        guardTriggered: true,
      });

      return jsonResponse(200, out);
    }

    const decision = resolvePolicyDecision({
      risk: toolSpec.risk,
      autonomy,
      tool: toolSpec.name,
      sessionRiskLevel,
    });

    if (decision === "denied") {
      toolExecutions.push({
        tool: toolSpec.name,
        status: "denied",
        reason: "policy_denied",
      });

      const out: AgentResponse = {
        reply: "Akci nelze provest kvuli bezpecnostni policy.",
        source: "llm",
        usedModel: {
          provider: "openai",
          model,
          source: body?.model?.model ? "override" : "default",
        },
        toolExecutions,
        guard: {
          triggered: true,
          reason: "policy_denied",
        },
        traceId,
      };

      await persistDecision({
        decision,
        source: out.source,
        guardTriggered: true,
      });

      return jsonResponse(200, out);
    }

    if (decision === "require_confirmation") {
      toolExecutions.push({
        tool: toolSpec.name,
        status: "denied",
        reason: "requires_confirmation",
      });

      const pendingAction: PendingAction = {
        id: toolCall.id || crypto.randomUUID(),
        title: `Potvrdit akci: ${toolSpec.name}`,
        summary: `Agent navrhuje akci ${toolSpec.name}. Pred provedenim je nutne uzivatelske potvrzeni.`,
        skillId: "ai-agent",
        risk: toolSpec.risk,
        requiresConfirmation: true,
        policyDecision: decision,
        idempotencyKey,
        payload: toolCall.args,
      };

      const out: AgentResponse = {
        reply: baseText || "Pripravila jsem navrh akce a cekam na tve potvrzeni.",
        source: "tool",
        usedModel: {
          provider: "openai",
          model,
          source: body?.model?.model ? "override" : "default",
        },
        toolExecutions,
        pendingAction,
        guard: { triggered: false },
        traceId,
      };

      await persistDecision({
        decision,
        source: out.source,
        guardTriggered: false,
      });

      return jsonResponse(200, out);
    }

    try {
      const toolResult = await runTool({
        toolName: toolSpec.name,
        toolArgs: toolCall.args,
        service,
        organizationId: orgMember.organization_id,
        fallbackProjectId: normalizeString(body.runtime?.selectedProjectId, 120) || null,
      });

      toolExecutions.push({
        tool: toolSpec.name,
        status: "ok",
      });

      const out: AgentResponse = {
        reply: [baseText, toolResult.text].filter(Boolean).join("\n\n").trim() || "Akce probehla uspesne.",
        source: "tool",
        usedModel: {
          provider: "openai",
          model,
          source: body?.model?.model ? "override" : "default",
        },
        toolExecutions,
        guard: { triggered: false },
        traceId,
      };

      await persistDecision({
        decision,
        source: out.source,
        guardTriggered: false,
      });

      return jsonResponse(200, out);
    } catch (error) {
      toolExecutions.push({
        tool: toolSpec.name,
        status: "error",
        reason: error instanceof Error ? error.message : "tool_execution_failed",
      });

      const out: AgentResponse = {
        reply: "Akce byla z bezpecnostnich duvodu zastavena nebo se nepodarila dokoncit.",
        source: "tool",
        usedModel: {
          provider: "openai",
          model,
          source: body?.model?.model ? "override" : "default",
        },
        toolExecutions,
        guard: {
          triggered: true,
          reason: "tool_execution_failed",
        },
        traceId,
      };

      await persistDecision({
        decision,
        source: out.source,
        guardTriggered: true,
      });

      return jsonResponse(200, out);
    }
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Unknown error",
      traceId,
    });
  }
});
