import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AGENT_CONTEXT_POLICY_VERSION } from "@app/agent/contextPolicy";
import { getDefaultAgentModelSelection } from "@app/agent/llmGateway";
import { getProviderModels } from "@app/agent/modelCatalog";
import { orchestrateAgentReply } from "@app/agent/orchestrator";
import { selectPreferredFemaleCzechVoice } from "@app/agent/speechSynthesisVoice";
import { base64ToObjectUrl, synthesizeVoiceReply, transcribeVoiceMessage } from "@app/agent/voiceGateway";
import { trackVikiUsageEvent } from "@app/agent/usageTracking";
import type {
  AgentAudience,
  AgentConversationMessage,
  AgentContextScope,
  AgentModelOption,
  AgentModelProvider,
  AgentModelSelection,
  AgentPendingAction,
  AgentRuntimeSnapshot,
} from "@shared/types/agent";
import type {
  VoiceBudgetStatus,
  VoiceCaptureState,
  VoiceCostMode,
  VoiceInteractionMode,
  VoiceStyle,
} from "@shared/types/voice";

interface UseAgentControllerResult {
  messages: AgentConversationMessage[];
  pendingActions: AgentPendingAction[];
  isLoading: boolean;
  defaultModel: AgentModelSelection | null;
  audience: AgentAudience;
  contextScopes: AgentContextScope[];
  contextPolicyVersion: string;
  selectedProvider: AgentModelProvider;
  selectedModel: string;
  availableModels: AgentModelOption[];
  isModelListLoading: boolean;
  voiceCaptureState: VoiceCaptureState;
  voiceCostMode: VoiceCostMode;
  voiceInteractionMode: VoiceInteractionMode;
  voiceStyle: VoiceStyle;
  voiceOutputEnabled: boolean;
  latestBudget: VoiceBudgetStatus | null;
  lastVoiceWarning: string | null;
  setSelectedProvider: (provider: AgentModelProvider) => Promise<void>;
  setSelectedModel: (model: string) => void;
  setAudience: (audience: AgentAudience) => void;
  toggleContextScope: (scope: AgentContextScope) => void;
  setVoiceOutputEnabled: (enabled: boolean) => void;
  setVoiceCostMode: (mode: VoiceCostMode) => void;
  setVoiceInteractionMode: (mode: VoiceInteractionMode) => void;
  setVoiceStyle: (voice: VoiceStyle) => void;
  sendUserMessage: (content: string) => Promise<void>;
  confirmPendingAction: (actionId: string) => void;
  dismissPendingAction: (actionId: string) => void;
  startVoiceCapture: () => Promise<void>;
  stopVoiceCapture: () => void;
  playVoiceReply: (text: string) => Promise<void>;
}

const STORAGE_KEY = "viki:modelSelection";
const AUDIENCE_STORAGE_KEY = "viki:audience";
const CONTEXT_SCOPES_STORAGE_KEY = "viki:contextScopes";
const VOICE_OUTPUT_STORAGE_KEY = "viki:voiceOutputEnabled";
const VOICE_COST_MODE_STORAGE_KEY = "viki:voiceCostMode";
const VOICE_INTERACTION_MODE_STORAGE_KEY = "viki:voiceInteractionMode";
const VOICE_STYLE_STORAGE_KEY = "viki:voiceStyle";
const MAX_VOICE_SECONDS = 30;
const DEFAULT_SCOPES: AgentContextScope[] = ["project", "memory", "manual"];

const createId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const getDurationSeconds = (blob: Blob): Promise<number> =>
  new Promise((resolve) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(blob);

    audio.preload = "metadata";
    audio.src = url;

    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      URL.revokeObjectURL(url);
      resolve(duration);
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
  });

const readPersistedModelSelection = (): {
  provider: AgentModelProvider;
  model: string;
} | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      provider?: AgentModelProvider;
      model?: string;
    };

    if (!parsed.provider || !parsed.model) return null;
    if (!["openrouter", "mistral", "google", "openai"].includes(parsed.provider)) return null;

    return {
      provider: parsed.provider,
      model: parsed.model,
    };
  } catch {
    return null;
  }
};

const persistModelSelection = (provider: AgentModelProvider, model: string): void => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      provider,
      model,
    }),
  );
};

const buildAssistantMessage = (
  content: string,
  options?: { skillId?: string; source?: "skill" | "llm" | "tool" },
): AgentConversationMessage => ({
  id: createId(),
  role: "assistant",
  content,
  createdAt: new Date().toISOString(),
  source: options?.source,
  skillId: options?.skillId,
});

const speakBrowserFallback = (text: string): void => {
  if (!("speechSynthesis" in window)) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "cs-CZ";
  utterance.pitch = 1.2;

  const preferredVoice = selectPreferredFemaleCzechVoice(window.speechSynthesis.getVoices());
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
};

export const useAgentController = (
  runtime: AgentRuntimeSnapshot,
): UseAgentControllerResult => {
  const [messages, setMessages] = useState<AgentConversationMessage[]>([
    buildAssistantMessage(
      "Ahoj, jsem Viki. Umím shrnout projekt, výběrko, připravit email, analyzovat rozpočet a přijmout hlasovou zprávu.",
      { source: "skill" },
    ),
  ]);
  const [pendingActions, setPendingActions] = useState<AgentPendingAction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [defaultModel, setDefaultModel] = useState<AgentModelSelection | null>(null);
  const [audience, setAudienceState] = useState<AgentAudience>(() => {
    const raw = localStorage.getItem(AUDIENCE_STORAGE_KEY);
    return raw === "client" ? "client" : "internal";
  });
  const [contextScopes, setContextScopes] = useState<AgentContextScope[]>(() => {
    const raw = localStorage.getItem(CONTEXT_SCOPES_STORAGE_KEY);
    if (!raw) return DEFAULT_SCOPES;

    try {
      const parsed = JSON.parse(raw) as AgentContextScope[];
      const filtered = parsed.filter((scope) =>
        ["project", "pipeline", "contacts", "memory", "manual"].includes(scope),
      );
      return filtered.length > 0 ? filtered : DEFAULT_SCOPES;
    } catch {
      return DEFAULT_SCOPES;
    }
  });
  const [selectedProvider, setSelectedProviderState] = useState<AgentModelProvider>("openai");
  const [selectedModel, setSelectedModelState] = useState<string>("gpt-5-mini");
  const [availableModels, setAvailableModels] = useState<AgentModelOption[]>([]);
  const [isModelListLoading, setIsModelListLoading] = useState(false);
  const [voiceCaptureState, setVoiceCaptureState] = useState<VoiceCaptureState>("idle");
  const [voiceCostMode, setVoiceCostMode] = useState<VoiceCostMode>(() => {
    const raw = localStorage.getItem(VOICE_COST_MODE_STORAGE_KEY);
    return raw === "balanced" || raw === "premium" ? raw : "economy";
  });
  const [voiceInteractionMode, setVoiceInteractionModeState] = useState<VoiceInteractionMode>(() => {
    const raw = localStorage.getItem(VOICE_INTERACTION_MODE_STORAGE_KEY);
    return raw === "text_only" || raw === "push_to_talk_auto_voice" || raw === "push_to_talk"
      ? raw
      : "push_to_talk";
  });
  const [voiceStyle, setVoiceStyleState] = useState<VoiceStyle>(() => {
    const raw = localStorage.getItem(VOICE_STYLE_STORAGE_KEY);
    return raw === "shimmer" ? "shimmer" : "nova";
  });
  const [voiceOutputEnabled, setVoiceOutputEnabledState] = useState<boolean>(() => {
    return localStorage.getItem(VOICE_OUTPUT_STORAGE_KEY) === "true";
  });
  const [latestBudget, setLatestBudget] = useState<VoiceBudgetStatus | null>(null);
  const [lastVoiceWarning, setLastVoiceWarning] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const voiceTimeoutRef = useRef<number | null>(null);

  const loadProviderModels = useCallback(
    async (provider: AgentModelProvider, preferredModel?: string) => {
      setIsModelListLoading(true);
      try {
        const models = await getProviderModels(provider);
        setAvailableModels(models);

        const resolvedModel =
          preferredModel && models.some((item) => item.id === preferredModel)
            ? preferredModel
            : models[0]?.id || "";

        setSelectedModelState(resolvedModel);
        persistModelSelection(provider, resolvedModel);
      } finally {
        setIsModelListLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const result = await getDefaultAgentModelSelection();
      if (cancelled) return;

      setDefaultModel(result);

      const persisted = readPersistedModelSelection();
      const provider = persisted?.provider || result.provider;
      const model = persisted?.model || result.model;

      setSelectedProviderState(provider);
      await loadProviderModels(provider, model);
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [loadProviderModels]);

  useEffect(() => {
    localStorage.setItem(AUDIENCE_STORAGE_KEY, audience);
  }, [audience]);

  useEffect(() => {
    localStorage.setItem(CONTEXT_SCOPES_STORAGE_KEY, JSON.stringify(contextScopes));
  }, [contextScopes]);

  useEffect(() => {
    localStorage.setItem(VOICE_OUTPUT_STORAGE_KEY, voiceOutputEnabled ? "true" : "false");
  }, [voiceOutputEnabled]);

  useEffect(() => {
    localStorage.setItem(VOICE_COST_MODE_STORAGE_KEY, voiceCostMode);
  }, [voiceCostMode]);

  useEffect(() => {
    localStorage.setItem(VOICE_INTERACTION_MODE_STORAGE_KEY, voiceInteractionMode);
  }, [voiceInteractionMode]);
  useEffect(() => {
    localStorage.setItem(VOICE_STYLE_STORAGE_KEY, voiceStyle);
  }, [voiceStyle]);

  useEffect(() => {
    if (voiceInteractionMode === "text_only") {
      setVoiceOutputEnabledState(false);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      return;
    }
    if (voiceInteractionMode === "push_to_talk_auto_voice") {
      setVoiceOutputEnabledState(true);
    }
  }, [voiceInteractionMode]);

  const activeModelSelection = useMemo<AgentModelSelection | null>(() => {
    if (!selectedModel) return null;
    return {
      provider: selectedProvider,
      model: selectedModel,
      source: "override",
    };
  }, [selectedModel, selectedProvider]);

  const setAudience = useCallback((nextAudience: AgentAudience) => {
    setAudienceState(nextAudience);
    void trackVikiUsageEvent("audience_switched", { audience: nextAudience });
  }, []);

  const toggleContextScope = useCallback((scope: AgentContextScope) => {
    setContextScopes((prev) => {
      const hasScope = prev.includes(scope);
      const next = hasScope ? prev.filter((item) => item !== scope) : [...prev, scope];
      return next.length > 0 ? next : ["project", "manual"];
    });
  }, []);

  const setSelectedProvider = useCallback(
    async (provider: AgentModelProvider) => {
      setSelectedProviderState(provider);
      await loadProviderModels(provider);
      void trackVikiUsageEvent("model_switched", { provider });
    },
    [loadProviderModels],
  );

  const setSelectedModel = useCallback(
    (model: string) => {
      setSelectedModelState(model);
      persistModelSelection(selectedProvider, model);
      void trackVikiUsageEvent("model_switched", {
        provider: selectedProvider,
        model,
      });
    },
    [selectedProvider],
  );

  const setVoiceInteractionMode = useCallback((mode: VoiceInteractionMode) => {
    setVoiceInteractionModeState(mode);
  }, []);
  const setVoiceStyle = useCallback((voice: VoiceStyle) => {
    setVoiceStyleState(voice);
  }, []);

  const playVoiceReply = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean) return;

    setVoiceCaptureState("replying");

    try {
      const response = await synthesizeVoiceReply(clean, voiceCostMode, "openai", voiceStyle);
      setLatestBudget(response.budget);
      setLastVoiceWarning(response.warning || null);

      if (response.audioBase64 && response.mimeType) {
        const url = base64ToObjectUrl(response.audioBase64, response.mimeType);
        const audio = new Audio(url);
        await audio.play();
        audio.onended = () => URL.revokeObjectURL(url);
      } else {
        speakBrowserFallback(clean);
      }

      void trackVikiUsageEvent("voice_tts_played", {
        provider: response.provider,
      });
    } catch {
      speakBrowserFallback(clean);
    } finally {
      setVoiceCaptureState("idle");
    }
  }, [voiceCostMode, voiceStyle]);

  const sendUserMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isLoading) return;

      const userMessage: AgentConversationMessage = {
        id: createId(),
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };

      const nextConversation = [...messages, userMessage];
      setMessages(nextConversation);
      setIsLoading(true);

      try {
        const response = await orchestrateAgentReply({
          userMessage: trimmed,
          runtime: {
            ...runtime,
            audience,
            contextScopes,
            contextPolicyVersion: AGENT_CONTEXT_POLICY_VERSION,
          },
          conversation: nextConversation,
          modelSelection: activeModelSelection,
        });

        void trackVikiUsageEvent("context_policy_applied", {
          audience,
          contextScopes,
          contextPolicyVersion: AGENT_CONTEXT_POLICY_VERSION,
        });

        if (response.guardTriggered) {
          void trackVikiUsageEvent("output_guard_triggered", {
            audience,
            reason: response.guardReason || "unknown",
          });
        }
        if (response.manualContextUsed) {
          void trackVikiUsageEvent("manual_context_used", {
            audience,
            citations: response.manualCitations?.map((item) => item.anchor) || [],
          });
        }
        if (response.manualNoMatch) {
          void trackVikiUsageEvent("manual_no_match", {
            audience,
          });
        }
        if (response.manualCitationEmitted) {
          void trackVikiUsageEvent("manual_citation_emitted", {
            audience,
            citations: response.manualCitations?.map((item) => item.anchor) || [],
          });
        }
        if (response.toolExecutions && response.toolExecutions.length > 0) {
          void trackVikiUsageEvent("tool_executed", {
            audience,
            tools: response.toolExecutions.map((item) => `${item.tool}:${item.status}`),
          });
        }
        if (response.pendingAction?.policyDecision) {
          void trackVikiUsageEvent("policy_decision_recorded", {
            audience,
            decision: response.pendingAction.policyDecision,
            actionRisk: response.pendingAction.risk,
          });
        }
        if (response.traceId) {
          void trackVikiUsageEvent("trace_recorded", {
            audience,
            traceId: response.traceId,
          });
        }

        setMessages((prev) => [
          ...prev,
          buildAssistantMessage(response.reply, {
            skillId: response.skillId,
            source: response.source,
          }),
        ]);

        if (response.pendingAction) {
          setPendingActions((prev) => [...prev, response.pendingAction]);
        }

        if (voiceOutputEnabled) {
          void playVoiceReply(response.reply);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          buildAssistantMessage(
            "Nepodařilo se dokončit požadavek. Zkus to prosím znovu.",
            { source: "llm" },
          ),
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      activeModelSelection,
      audience,
      contextScopes,
      isLoading,
      messages,
      playVoiceReply,
      runtime,
      voiceOutputEnabled,
    ],
  );

  const handleRecordedBlob = useCallback(
    async (blob: Blob) => {
      setVoiceCaptureState("uploading");
      const durationSeconds = await getDurationSeconds(blob);

      if (durationSeconds > MAX_VOICE_SECONDS) {
        setLastVoiceWarning(`Hlasová zpráva je delší než ${MAX_VOICE_SECONDS} s. Zkrať ji prosím.`);
        setVoiceCaptureState("idle");
        return;
      }

      try {
        setVoiceCaptureState("transcribing");

        const result = await transcribeVoiceMessage(
          blob,
          Math.max(1, Math.round(durationSeconds)),
          voiceCostMode,
          "mistral",
        );

        setLatestBudget(result.budget);
        setLastVoiceWarning(result.warning || null);
        void trackVikiUsageEvent("voice_transcribed", {
          provider: result.provider,
          seconds: Math.max(1, Math.round(durationSeconds)),
        });

        await sendUserMessage(result.text);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Neznámá chyba při přepisu hlasu.";
        setLastVoiceWarning(message);
      } finally {
        setVoiceCaptureState("idle");
      }
    },
    [sendUserMessage, voiceCostMode],
  );

  const startVoiceCapture = useCallback(async () => {
    if (voiceCaptureState === "recording") return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setLastVoiceWarning("Tento prohlížeč nepodporuje nahrávání hlasu.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const preferredMime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType: preferredMime });
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: preferredMime });
        recordedChunksRef.current = [];

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }

        void handleRecordedBlob(blob);
      };

      recorder.start();
      setVoiceCaptureState("recording");
      setLastVoiceWarning(null);
      void trackVikiUsageEvent("voice_record_started");

      if (voiceTimeoutRef.current) {
        window.clearTimeout(voiceTimeoutRef.current);
      }
      voiceTimeoutRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, MAX_VOICE_SECONDS * 1000);
    } catch {
      setLastVoiceWarning("Nepodařilo se získat přístup k mikrofonu.");
      setVoiceCaptureState("idle");
    }
  }, [handleRecordedBlob, voiceCaptureState]);

  const stopVoiceCapture = useCallback(() => {
    if (voiceTimeoutRef.current) {
      window.clearTimeout(voiceTimeoutRef.current);
      voiceTimeoutRef.current = null;
    }

    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  useEffect(
    () => () => {
      if (voiceTimeoutRef.current) {
        window.clearTimeout(voiceTimeoutRef.current);
      }
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    },
    [],
  );

  const confirmPendingAction = useCallback(
    (actionId: string) => {
      const action = pendingActions.find((item) => item.id === actionId);
      if (!action) return;

      setPendingActions((prev) => prev.filter((item) => item.id !== actionId));
      setMessages((prev) => [
        ...prev,
        buildAssistantMessage(`Akce \"${action.title}\" byla potvrzena.`, {
          source: "skill",
          skillId: action.skillId,
        }),
      ]);
    },
    [pendingActions],
  );

  const dismissPendingAction = useCallback(
    (actionId: string) => {
      const action = pendingActions.find((item) => item.id === actionId);
      if (!action) return;

      setPendingActions((prev) => prev.filter((item) => item.id !== actionId));
      setMessages((prev) => [
        ...prev,
        buildAssistantMessage(`Akce \"${action.title}\" byla zrušena.`, {
          source: "skill",
          skillId: action.skillId,
        }),
      ]);
    },
    [pendingActions],
  );

  return {
    messages,
    pendingActions,
    isLoading,
    defaultModel,
    audience,
    contextScopes,
    contextPolicyVersion: AGENT_CONTEXT_POLICY_VERSION,
    selectedProvider,
    selectedModel,
    availableModels,
    isModelListLoading,
    voiceCaptureState,
    voiceCostMode,
    voiceInteractionMode,
    voiceStyle,
    voiceOutputEnabled,
    latestBudget,
    lastVoiceWarning,
    setSelectedProvider,
    setSelectedModel,
    setAudience,
    toggleContextScope,
    setVoiceOutputEnabled: setVoiceOutputEnabledState,
    setVoiceCostMode,
    setVoiceInteractionMode,
    setVoiceStyle,
    sendUserMessage,
    confirmPendingAction,
    dismissPendingAction,
    startVoiceCapture,
    stopVoiceCapture,
    playVoiceReply,
  };
};
