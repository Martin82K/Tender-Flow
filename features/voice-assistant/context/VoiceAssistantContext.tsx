import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FEATURES } from "@/config/features";
import { useFeatures } from "@/context/FeatureContext";
import { createRealtimeVoiceSession } from "../api/realtimeSession";
import { createTextAssistantResponse } from "../api/textResponse";
import { connectRealtimeVoice, type RealtimeConnection } from "../api/webrtcClient";
import { isVoiceAssistantAvailable } from "../model/availability";
import {
  addRealtimeUsageToCostEstimate,
  addTextModelUsageToCostEstimate,
  emptyVoiceAssistantCostEstimate,
  type RealtimeUsageLike,
  type VoiceAssistantCostEstimate,
} from "../model/realtimePricing";
import { resolveRealtimeResponseMode } from "../model/responseMode";
import { executeVoiceAssistantTool } from "../model/toolGateway";
import type {
  RealtimeVoiceModel,
  VoiceAssistantResponseMode,
  VoiceAssistantContextData,
  VoiceAssistantLiveTranscript,
  VoiceAssistantMessage,
  VoiceAssistantSources,
  VoiceAssistantTextResponse,
  VoiceAssistantTextToolOutput,
  VoiceAssistantState,
} from "../types";
import { DEFAULT_REALTIME_VOICE_MODEL } from "../types";
import type { View } from "@/types";

type VoiceAssistantContextValue = {
  isAvailable: boolean;
  isPanelOpen: boolean;
  state: VoiceAssistantState;
  isVoiceModeActive: boolean;
  selectedRealtimeModel: RealtimeVoiceModel;
  responseMode: VoiceAssistantResponseMode;
  messages: VoiceAssistantMessage[];
  liveTranscript: VoiceAssistantLiveTranscript | null;
  error: string | null;
  costEstimate: VoiceAssistantCostEstimate;
  openPanel: () => void;
  closePanel: () => void;
  startVoiceMode: () => Promise<void>;
  stopVoiceMode: () => void;
  startListening: () => Promise<void>;
  stopListening: () => void;
  setRealtimeModel: (model: RealtimeVoiceModel) => void;
  setResponseMode: (mode: VoiceAssistantResponseMode) => void;
  clearMessages: () => void;
  sendText: (text: string) => Promise<void>;
  interrupt: () => void;
};

const VoiceAssistantContext = createContext<VoiceAssistantContextValue | null>(null);

const MAX_MESSAGES = 8;
const IDLE_TIMEOUT_MS = 90_000;
const TRANSCRIPTION_RESPONSE_FALLBACK_MS = 1_400;

const responseModalitiesForMode = (mode: VoiceAssistantResponseMode): string[] =>
  mode === "conversation" ? ["text"] : ["audio"];

const createResponseModeSessionUpdate = (mode: VoiceAssistantResponseMode): Record<string, unknown> => ({
  type: "session.update",
  session: {
    type: "realtime",
    output_modalities: responseModalitiesForMode(mode),
  },
});

const stateLabels: Record<VoiceAssistantState, string> = {
  idle: "Připraveno",
  "requesting-permission": "Čekám na mikrofon",
  connecting: "Připojuji",
  ready: "Připraveno",
  listening: "Poslouchám",
  responding: "Odpovídám",
  error: "Chyba",
};

const appendMessage = (
  current: VoiceAssistantMessage[],
  role: VoiceAssistantMessage["role"],
  content: string,
): VoiceAssistantMessage[] => {
  const trimmed = content.trim();
  if (!trimmed) return current;
  return [
    ...current,
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role,
      content: trimmed,
    },
  ].slice(-MAX_MESSAGES);
};

const getEventString = (
  event: Record<string, unknown>,
  keys: string[],
): string | null => {
  for (const key of keys) {
    const value = event[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
};

export const VoiceAssistantProvider: React.FC<{
  children: React.ReactNode;
  sources: VoiceAssistantSources;
  currentProjectId: string | null;
  currentView: View;
  isDesktop: boolean;
  isAdmin: boolean;
}> = ({ children, sources, currentProjectId, currentView, isDesktop, isAdmin }) => {
  const featureContext = useFeatures();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [state, setState] = useState<VoiceAssistantState>("idle");
  const [isVoiceModeActive, setIsVoiceModeActive] = useState(false);
  const [selectedRealtimeModel, setSelectedRealtimeModel] = useState<RealtimeVoiceModel>(DEFAULT_REALTIME_VOICE_MODEL);
  const [responseMode, setResponseModeState] = useState<VoiceAssistantResponseMode>("voice");
  const [messages, setMessages] = useState<VoiceAssistantMessage[]>([]);
  const [liveTranscript, setLiveTranscript] = useState<VoiceAssistantLiveTranscript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [costEstimate, setCostEstimate] = useState<VoiceAssistantCostEstimate>(() =>
    emptyVoiceAssistantCostEstimate(),
  );

  const connectionRef = useRef<RealtimeConnection | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assistantDeltaRef = useRef("");
  const userDeltaRef = useRef("");
  const isVoiceModeActiveRef = useRef(false);
  const responseModeRef = useRef<VoiceAssistantResponseMode>(responseMode);
  const activeRealtimeResponseModeRef = useRef<VoiceAssistantResponseMode>(responseMode);
  const pendingRealtimeResponseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasCreatedRealtimeResponseRef = useRef(false);

  const contextData = useMemo<VoiceAssistantContextData>(
    () => ({
      currentProjectId,
      currentView,
      sources,
    }),
    [currentProjectId, currentView, sources],
  );
  const contextDataRef = useRef(contextData);
  contextDataRef.current = contextData;
  responseModeRef.current = responseMode;

  const voiceFeatureKey = FEATURES.FEATURE_VOICE_ASSISTANT;
  const hasVoiceFeature =
    typeof voiceFeatureKey === "string" &&
    typeof featureContext.hasFeature === "function" &&
    featureContext.hasFeature(voiceFeatureKey);
  const isAvailable = isVoiceAssistantAvailable({
    isDesktop,
    isAdmin,
    hasFeature: hasVoiceFeature,
    isFeatureLoading: featureContext.isLoading,
  });

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (isVoiceModeActiveRef.current) {
      idleTimerRef.current = null;
      return;
    }
    idleTimerRef.current = setTimeout(() => {
      connectionRef.current?.close();
      connectionRef.current = null;
      setState("idle");
    }, IDLE_TIMEOUT_MS);
  }, []);

  const clearPendingRealtimeResponseTimer = useCallback(() => {
    if (pendingRealtimeResponseTimerRef.current) {
      clearTimeout(pendingRealtimeResponseTimerRef.current);
      pendingRealtimeResponseTimerRef.current = null;
    }
  }, []);

  const createRealtimeResponse = useCallback((inputTranscript = "") => {
    clearPendingRealtimeResponseTimer();
    if (hasCreatedRealtimeResponseRef.current) return;
    hasCreatedRealtimeResponseRef.current = true;
    const mode = resolveRealtimeResponseMode(inputTranscript, responseModeRef.current);
    activeRealtimeResponseModeRef.current = mode;
    connectionRef.current?.sendEvent({
      type: "response.create",
      response: {
        modalities: responseModalitiesForMode(mode),
        ...(mode === "conversation"
          ? {
              instructions:
                "Uživatel chce výsledek pouze do konverzace/chatu. Odpověz textově, strukturovaně a nečti dlouhé informace nahlas.",
            }
          : {}),
      },
    });
  }, [clearPendingRealtimeResponseTimer]);

  const scheduleRealtimeResponseFallback = useCallback((inputTranscript = "") => {
    clearPendingRealtimeResponseTimer();
    pendingRealtimeResponseTimerRef.current = setTimeout(() => {
      createRealtimeResponse(inputTranscript);
    }, TRANSCRIPTION_RESPONSE_FALLBACK_MS);
  }, [clearPendingRealtimeResponseTimer, createRealtimeResponse]);

  const handleRealtimeEvent = useCallback((event: Record<string, unknown>) => {
    const type = String(event.type || "");

    if (type === "error") {
      const message = String((event.error as { message?: string } | undefined)?.message || "Realtime chyba.");
      setError(message);
      setState("error");
      return;
    }

    if (type.includes("input_audio_buffer.speech_started")) {
      clearPendingRealtimeResponseTimer();
      assistantDeltaRef.current = "";
      userDeltaRef.current = "";
      hasCreatedRealtimeResponseRef.current = false;
      setState((current) => (current === "error" ? current : "listening"));
      return;
    }

    if (type.includes("input_audio_buffer.speech_stopped")) {
      setState((current) => (current === "error" ? current : "responding"));
      scheduleRealtimeResponseFallback(userDeltaRef.current);
      return;
    }

    if (type.includes("response.created")) {
      setState((current) => (current === "error" ? current : "responding"));
      setLiveTranscript({ role: "assistant", content: "", isPending: true });
      return;
    }

    if (type.includes("function_call_arguments.done")) {
      const name = String(event.name || "");
      const callId = String(event.call_id || "");
      const args = typeof event.arguments === "string" ? event.arguments : "{}";
      const output = executeVoiceAssistantTool(name, args, contextDataRef.current);
      connectionRef.current?.sendEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify(output),
        },
      });
      connectionRef.current?.sendEvent({
        type: "response.create",
        response: {
          modalities: responseModalitiesForMode(activeRealtimeResponseModeRef.current),
        },
      });
      return;
    }

    if (type.includes("input_audio_transcription.delta")) {
      const delta = getEventString(event, ["delta", "transcript", "text"]);
      if (delta) {
        userDeltaRef.current += delta;
        setLiveTranscript({ role: "user", content: userDeltaRef.current, isPending: true });
      }
      return;
    }

    if (type.includes("input_audio_transcription.completed")) {
      const text = getEventString(event, ["transcript", "text"]);
      if (text) setMessages((current) => appendMessage(current, "user", text));
      userDeltaRef.current = "";
      setLiveTranscript((current) => (current?.role === "user" ? null : current));
      createRealtimeResponse(text || "");
      return;
    }

    if (
      type.includes("response.output_audio_transcript.delta") ||
      type.includes("response.audio_transcript.delta") ||
      type.includes("response.text.delta")
    ) {
      const delta = getEventString(event, ["delta", "text"]);
      if (delta) {
        assistantDeltaRef.current += delta;
        setLiveTranscript({ role: "assistant", content: assistantDeltaRef.current, isPending: true });
      }
      return;
    }

    if (
      type.includes("response.output_audio_transcript.done") ||
      type.includes("response.audio_transcript.done") ||
      type.includes("response.text.done")
    ) {
      const text = getEventString(event, ["transcript", "text"]) || assistantDeltaRef.current;
      assistantDeltaRef.current = "";
      if (text) setMessages((current) => appendMessage(current, "assistant", text));
      setLiveTranscript((current) => (current?.role === "assistant" ? null : current));
      return;
    }

    if (type.includes("response.done")) {
      const response = event.response as { usage?: RealtimeUsageLike } | undefined;
      const usage = response?.usage || (event.usage as RealtimeUsageLike | undefined);
      if (usage) {
        setCostEstimate((current) => addRealtimeUsageToCostEstimate(current, usage));
      }
      setLiveTranscript(null);
      setState((current) => (current === "error" ? current : "ready"));
    }
  }, [clearPendingRealtimeResponseTimer, createRealtimeResponse, scheduleRealtimeResponseFallback]);

  const closeConnection = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
    clearPendingRealtimeResponseTimer();
    connectionRef.current?.close();
    connectionRef.current = null;
  }, [clearPendingRealtimeResponseTimer]);

  const ensureConnection = useCallback(async () => {
    if (connectionRef.current) return connectionRef.current;

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Mikrofon není v tomto prostředí dostupný.");
    }

    setError(null);
    setState("requesting-permission");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setState("connecting");
    const session = await createRealtimeVoiceSession({
      currentProjectId,
      currentView,
      realtimeModel: selectedRealtimeModel,
    });
    const connection = await connectRealtimeVoice({
      session,
      stream,
      onEvent: handleRealtimeEvent,
    });
    connection.sendEvent(createResponseModeSessionUpdate(responseMode));
    connectionRef.current = connection;
    setState("ready");
    resetIdleTimer();
    return connection;
  }, [currentProjectId, currentView, handleRealtimeEvent, resetIdleTimer, responseMode, selectedRealtimeModel]);

  const startVoiceMode = useCallback(async () => {
    if (!isAvailable) return;
    setIsPanelOpen(true);
    try {
      isVoiceModeActiveRef.current = true;
      setIsVoiceModeActive(true);
      const connection = await ensureConnection();
      connection.setMicEnabled(true);
      setState("ready");
      resetIdleTimer();
    } catch (err) {
      isVoiceModeActiveRef.current = false;
      setIsVoiceModeActive(false);
      const message = err instanceof Error ? err.message : "Nepodařilo se spustit hlasový režim.";
      setError(message);
      setState("error");
      closeConnection();
    }
  }, [closeConnection, ensureConnection, isAvailable, resetIdleTimer]);

  const stopVoiceMode = useCallback(() => {
    isVoiceModeActiveRef.current = false;
    setIsVoiceModeActive(false);
    closeConnection();
    setState("idle");
  }, [closeConnection]);

  const startListening = useCallback(async () => {
    if (!isAvailable || isVoiceModeActiveRef.current) return;
    setIsPanelOpen(true);
    try {
      const connection = await ensureConnection();
      connection.setMicEnabled(true);
      setState("listening");
      resetIdleTimer();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nepodařilo se spustit hlasového asistenta.";
      setError(message);
      setState("error");
      closeConnection();
    }
  }, [closeConnection, ensureConnection, isAvailable, resetIdleTimer]);

  const stopListening = useCallback(() => {
    if (isVoiceModeActiveRef.current) return;
    connectionRef.current?.setMicEnabled(false);
    scheduleRealtimeResponseFallback(userDeltaRef.current);
    setState((current) => (current === "listening" ? "responding" : current));
    resetIdleTimer();
  }, [resetIdleTimer, scheduleRealtimeResponseFallback]);

  const setRealtimeModel = useCallback((model: RealtimeVoiceModel) => {
    setSelectedRealtimeModel((current) => {
      if (current === model) return current;
      isVoiceModeActiveRef.current = false;
      setIsVoiceModeActive(false);
      closeConnection();
      setState("idle");
      return model;
    });
  }, [closeConnection]);

  const setResponseMode = useCallback((mode: VoiceAssistantResponseMode) => {
    setResponseModeState(mode);
    responseModeRef.current = mode;
    connectionRef.current?.sendEvent(createResponseModeSessionUpdate(mode));
  }, []);

  const clearMessages = useCallback(() => {
    assistantDeltaRef.current = "";
    userDeltaRef.current = "";
    clearPendingRealtimeResponseTimer();
    setMessages([]);
    setLiveTranscript(null);
    setError(null);
  }, [clearPendingRealtimeResponseTimer]);

  const runTextAssistant = useCallback(async (
    input: string,
    history: VoiceAssistantMessage[],
  ): Promise<string> => {
    let response: VoiceAssistantTextResponse = await createTextAssistantResponse({
      input,
      messages: history,
      currentProjectId,
      currentView,
    });

    for (let step = 0; step < 4; step += 1) {
      if (response.usage) {
        setCostEstimate((current) => addTextModelUsageToCostEstimate(current, response.usage!));
      }

      if (response.kind === "message") {
        return response.text || "";
      }

      const toolOutputs: VoiceAssistantTextToolOutput[] = (response.toolCalls || []).map((call) => ({
        callId: call.callId,
        name: call.name,
        output: executeVoiceAssistantTool(call.name, call.arguments, contextDataRef.current),
      }));

      response = await createTextAssistantResponse({
        currentProjectId,
        currentView,
        previousResponseId: response.responseId,
        toolOutputs,
      });
    }

    throw new Error("Textová Viky potřebovala příliš mnoho kroků nástrojů.");
  }, [currentProjectId, currentView]);

  const sendText = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !isAvailable) return;
    setIsPanelOpen(true);
    const history = messages.slice(-MAX_MESSAGES);
    try {
      setError(null);
      setMessages((current) => appendMessage(current, "user", trimmed));
      setLiveTranscript({ role: "assistant", content: "", isPending: true });
      setState("responding");
      const responseText = await runTextAssistant(trimmed, history);
      setLiveTranscript(null);
      setMessages((current) => appendMessage(current, "assistant", responseText));
      setState("ready");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Textový fallback selhal.";
      setLiveTranscript(null);
      setError(message);
      setState("error");
    }
  }, [isAvailable, messages, runTextAssistant]);

  const interrupt = useCallback(() => {
    connectionRef.current?.sendEvent({ type: "response.cancel" });
    setState((current) => (current === "responding" ? "ready" : current));
  }, []);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
    isVoiceModeActiveRef.current = false;
    setIsVoiceModeActive(false);
    closeConnection();
    setState("idle");
  }, [closeConnection]);

  useEffect(() => {
    if (!isAvailable) {
      isVoiceModeActiveRef.current = false;
      setIsVoiceModeActive(false);
      closeConnection();
      setIsPanelOpen(false);
      setState("idle");
    }
  }, [closeConnection, isAvailable]);

  useEffect(() => closeConnection, [closeConnection]);

  const value = useMemo<VoiceAssistantContextValue>(
    () => ({
      isAvailable,
      isPanelOpen,
      state,
      isVoiceModeActive,
      selectedRealtimeModel,
      responseMode,
      messages,
      liveTranscript,
      error,
      costEstimate,
      openPanel: () => setIsPanelOpen(true),
      closePanel,
      startVoiceMode,
      stopVoiceMode,
      startListening,
      stopListening,
      setRealtimeModel,
      setResponseMode,
      clearMessages,
      sendText,
      interrupt,
    }),
    [
      closePanel,
      clearMessages,
      error,
      costEstimate,
      interrupt,
      isAvailable,
      isPanelOpen,
      isVoiceModeActive,
      liveTranscript,
      messages,
      responseMode,
      selectedRealtimeModel,
      sendText,
      setRealtimeModel,
      setResponseMode,
      startVoiceMode,
      startListening,
      state,
      stopVoiceMode,
      stopListening,
    ],
  );

  return (
    <VoiceAssistantContext.Provider value={value}>
      {children}
    </VoiceAssistantContext.Provider>
  );
};

export const useVoiceAssistant = (): VoiceAssistantContextValue | null =>
  useContext(VoiceAssistantContext);

export const getVoiceAssistantStateLabel = (state: VoiceAssistantState): string =>
  stateLabels[state];
