import { invokeAuthedFunction } from "@/services/functionsClient";
import type { AgentModelOption, AgentModelProvider } from "@shared/types/agent";

interface AiProxyModelCatalogResponse {
  models?: AgentModelOption[];
}

const GOOGLE_MODELS: AgentModelOption[] = [
  {
    id: "gemini-1.5-flash",
    label: "Gemini 1.5 Flash",
    provider: "google",
    capabilities: ["chat", "fast"],
    pricingHint: "Úsporný",
  },
  {
    id: "gemini-1.5-pro",
    label: "Gemini 1.5 Pro",
    provider: "google",
    capabilities: ["chat", "quality"],
    pricingHint: "Vyvážený",
  },
  {
    id: "gemini-2.0-flash-001",
    label: "Gemini 2.0 Flash",
    provider: "google",
    capabilities: ["chat", "fast"],
    pricingHint: "Úsporný",
  },
];

const OPENAI_MODELS: AgentModelOption[] = [
  {
    id: "gpt-5-mini",
    label: "GPT-5 mini",
    provider: "openai",
    capabilities: ["chat", "fast"],
    pricingHint: "Úsporný",
  },
  {
    id: "gpt-5",
    label: "GPT-5",
    provider: "openai",
    capabilities: ["chat", "quality"],
    pricingHint: "Vyvážený",
  },
];

const uniqById = (items: AgentModelOption[]): AgentModelOption[] => {
  const seen = new Set<string>();
  const out: AgentModelOption[] = [];

  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }

  return out;
};

const normalizeFromApi = (
  provider: AgentModelProvider,
  items: AgentModelOption[] | undefined,
): AgentModelOption[] => {
  if (!items || items.length === 0) {
    if (provider === "google") return GOOGLE_MODELS;
    if (provider === "openai") return OPENAI_MODELS;
    return [];
  }

  return uniqById(
    items.map((item) => ({
      id: item.id,
      label: item.label || item.id,
      provider,
      capabilities: item.capabilities || ["chat"],
      pricingHint: item.pricingHint,
    })),
  );
};

export const getProviderModels = async (
  provider: AgentModelProvider,
): Promise<AgentModelOption[]> => {
  if (provider === "google") {
    return GOOGLE_MODELS;
  }
  if (provider === "openai") {
    return OPENAI_MODELS;
  }

  try {
    const response = await invokeAuthedFunction<AiProxyModelCatalogResponse>("ai-proxy", {
      body: {
        action: "list-models",
        provider,
      },
    });

    const normalized = normalizeFromApi(provider, response.models);
    if (normalized.length > 0) return normalized;
  } catch {
    // fallback below
  }

  if (provider === "mistral") {
    return [
      {
        id: "mistral-small-latest",
        label: "Mistral Small",
        provider,
        capabilities: ["chat", "fast"],
        pricingHint: "Úsporný",
      },
      {
        id: "mistral-large-latest",
        label: "Mistral Large",
        provider,
        capabilities: ["chat", "quality"],
        pricingHint: "Vyvážený",
      },
    ];
  }

  return [
    {
      id: "anthropic/claude-3.5-sonnet",
      label: "Claude 3.5 Sonnet",
      provider,
      capabilities: ["chat", "quality"],
      pricingHint: "Vyvážený",
    },
    {
      id: "x-ai/grok-4.1-fast",
      label: "Grok 4.1 Fast",
      provider,
      capabilities: ["chat", "fast"],
      pricingHint: "Úsporný",
    },
  ];
};
