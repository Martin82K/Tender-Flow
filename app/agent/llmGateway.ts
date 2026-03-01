import { invokeAuthedFunction } from "@/services/functionsClient";
import { dbAdapter } from "@/services/dbAdapter";
import type {
  AgentManualCitation,
  AgentConversationMessage,
  AgentPendingAction,
  AgentReplySource,
  AgentToolExecution,
  AgentModelProvider,
  AgentModelSelection,
  AgentRuntimeSnapshot,
} from "@shared/types/agent";
import { buildSystemPrompt } from "@app/agent/contextPolicy";
import { loadProjectMemory } from "@app/agent/memoryStore";
import {
  ensureManualCitationInReply,
  formatManualContextForPrompt,
  type RetrievedManualSection,
  retrieveManualSections,
  toManualCitations,
} from "@app/agent/manualKnowledge";

type AiAgentResponse = {
  reply?: string;
  source?: AgentReplySource;
  usedModel?: AgentModelSelection;
  toolExecutions?: AgentToolExecution[];
  pendingAction?: AgentPendingAction;
  traceId?: string;
  guard?: {
    triggered: boolean;
    reason?: string;
  };
};

const DEFAULT_PROVIDER: AgentModelProvider = "openai";
const DEFAULT_MODEL = "gpt-5-mini";
const MODEL_CACHE_TTL = 1000 * 60 * 5;

let modelCache: {
  value: AgentModelSelection;
  expiresAt: number;
} | null = null;

const toProvider = (value: unknown): AgentModelProvider => {
  if (value === "mistral" || value === "google" || value === "openrouter" || value === "openai") {
    return value;
  }
  return DEFAULT_PROVIDER;
};

export const getDefaultAgentModelSelection = async (
  forceRefresh = false,
): Promise<AgentModelSelection> => {
  if (!forceRefresh && modelCache && Date.now() < modelCache.expiresAt) {
    return modelCache.value;
  }

  try {
    const { data } = await dbAdapter
      .from("app_settings")
      .select("ai_extraction_provider, ai_extraction_model")
      .eq("id", "default")
      .single();

    const selection: AgentModelSelection = {
      provider: toProvider(data?.ai_extraction_provider),
      model: data?.ai_extraction_model || DEFAULT_MODEL,
      source: "default",
    };

    modelCache = {
      value: selection,
      expiresAt: Date.now() + MODEL_CACHE_TTL,
    };

    return selection;
  } catch {
    const fallback: AgentModelSelection = {
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      source: "default",
    };

    modelCache = {
      value: fallback,
      expiresAt: Date.now() + MODEL_CACHE_TTL,
    };

    return fallback;
  }
};

interface SendAgentFallbackMessageArgs {
  runtime: AgentRuntimeSnapshot;
  conversation: AgentConversationMessage[];
  modelSelection?: AgentModelSelection | null;
}

export interface AgentFallbackResponse {
  text: string;
  source: AgentReplySource;
  usedModel: AgentModelSelection;
  memoryLoaded: boolean;
  manualContextUsed: boolean;
  manualNoMatch: boolean;
  manualCitations: AgentManualCitation[];
  manualCitationEmitted: boolean;
  toolExecutions: AgentToolExecution[];
  pendingAction?: AgentPendingAction;
  traceId?: string;
  guard?: {
    triggered: boolean;
    reason?: string;
  };
}

const createIdempotencyKey = (): string =>
  `viki-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const sendAgentFallbackMessage = async ({
  runtime,
  conversation,
  modelSelection,
}: SendAgentFallbackMessageArgs): Promise<AgentFallbackResponse> => {
  const baseModel = await getDefaultAgentModelSelection();
  const selectedModel: AgentModelSelection = modelSelection
    ? {
        ...modelSelection,
        source: "override",
      }
    : baseModel;

  let projectMemory = null;
  if (runtime.selectedProjectId && runtime.contextScopes.includes("memory")) {
    try {
      projectMemory = await loadProjectMemory(runtime.selectedProjectId);
    } catch {
      projectMemory = null;
    }
  }

  let manualSections: RetrievedManualSection[] = [];
  if (runtime.contextScopes.includes("manual")) {
    try {
      const latestUserMessage =
        [...conversation]
          .reverse()
          .find((message) => message.role === "user")
          ?.content || "";
      manualSections = await retrieveManualSections(latestUserMessage, runtime);
    } catch {
      manualSections = [];
    }
  }
  const manualCitations = toManualCitations(manualSections);

  const conversationWithSystem = [
    {
      role: "system",
      content: buildSystemPrompt({
        runtime,
        memory: projectMemory,
        manualContext: formatManualContextForPrompt(manualSections),
      }),
    },
    ...conversation.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];

  const idempotencyKey = createIdempotencyKey();
  const modelForAiAgent =
    selectedModel.provider === "openai" && selectedModel.model.trim().length > 0
      ? selectedModel.model
      : DEFAULT_MODEL;

  const result = await invokeAuthedFunction<AiAgentResponse>("ai-agent", {
    body: {
      mode: "chat",
      autonomy: "semi_autonomous",
      idempotencyKey,
      runtime,
      conversation: conversationWithSystem,
      model: {
        provider: "openai",
        model: modelForAiAgent,
      },
    },
    idempotencyKey,
    timeoutMs: 45_000,
    retries: 1,
  });

  const normalizedReply = (result.reply || "Nedostala jsem odpověď od AI modelu.").trim();
  const replyWithCitation = ensureManualCitationInReply(normalizedReply, manualCitations);

  return {
    text: replyWithCitation.text,
    source: result.source || "llm",
    usedModel: result.usedModel || selectedModel,
    memoryLoaded: Boolean(projectMemory),
    manualContextUsed: manualSections.length > 0,
    manualNoMatch: runtime.contextScopes.includes("manual") && manualSections.length === 0,
    manualCitations,
    manualCitationEmitted: replyWithCitation.emitted,
    toolExecutions: result.toolExecutions || [],
    pendingAction: result.pendingAction,
    traceId: result.traceId,
    guard: result.guard,
  };
};
