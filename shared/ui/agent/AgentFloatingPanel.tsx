import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAgentController } from "@app/agent/useAgentController";
import { FEATURES } from "@/config/features";
import { useFeatures } from "@/context/FeatureContext";
import type {
  AgentContextScope,
  AgentModelProvider,
  AgentRuntimeSnapshot,
} from "@shared/types/agent";
import type { VoiceCostMode, VoiceInteractionMode, VoiceStyle } from "@shared/types/voice";
import { renderMarkdownToSafeHtml } from "@shared/contracts/markdownRender";
import vikiAvatar from "@/assets/viki.png";

interface AgentFloatingPanelProps {
  runtime: AgentRuntimeSnapshot;
}

const voiceStateLabel: Record<string, string> = {
  idle: "Připraveno",
  recording: "Nahrávám...",
  uploading: "Nahrávám data...",
  transcribing: "Přepisuji hlas...",
  replying: "Přehrávám odpověď...",
};

const scopeLabels: Record<AgentContextScope, string> = {
  project: "Projekt",
  pipeline: "Pipeline",
  contacts: "Kontakty",
  memory: "Paměť",
  manual: "Příručka",
};

const voiceInteractionLabels: Record<VoiceInteractionMode, string> = {
  text_only: "Jen text",
  push_to_talk: "Push-to-talk",
  push_to_talk_auto_voice: "Push-to-talk + auto hlas",
};

const voiceStyleLabels: Record<VoiceStyle, string> = {
  nova: "Nova (doporučeno)",
  shimmer: "Shimmer",
};

export const AgentFloatingPanel: React.FC<AgentFloatingPanelProps> = ({ runtime }) => {
  const { hasFeature, isLoading: isFeatureLoading } = useFeatures();
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const settingsFirstFieldRef = useRef<HTMLSelectElement | null>(null);
  const isAiEnabled = useMemo(() => {
    const localFlag = localStorage.getItem("aiEnabled");
    return localFlag !== "false";
  }, []);
  const canUseViki = hasFeature(FEATURES.AI_VIKI);

  const {
    messages,
    pendingActions,
    isLoading,
    defaultModel,
    audience,
    contextScopes,
    contextPolicyVersion,
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
    setVoiceOutputEnabled,
    setVoiceCostMode,
    setVoiceInteractionMode,
    setVoiceStyle,
    sendUserMessage,
    confirmPendingAction,
    dismissPendingAction,
    startVoiceCapture,
    stopVoiceCapture,
    playVoiceReply,
  } = useAgentController(runtime);

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [isOpen, messages, pendingActions]);

  useEffect(() => {
    if (!isSettingsOpen) return;
    settingsFirstFieldRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSettingsOpen]);

  if (!isAiEnabled || isFeatureLoading || !canUseViki) {
    return null;
  }

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!draft.trim()) return;

    const content = draft;
    setDraft("");
    await sendUserMessage(content);
  };

  const isRecording = voiceCaptureState === "recording";
  const showVoiceControls = voiceInteractionMode !== "text_only";
  const isVoiceOutputForced = voiceInteractionMode !== "push_to_talk";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (isOpen) {
            setIsSettingsOpen(false);
          }
        }}
        className="fixed right-[4.75rem] top-4 z-40 inline-flex size-10 items-center justify-center rounded-xl border border-white/40 bg-white/72 text-slate-800 shadow-[0_12px_35px_-16px_rgba(15,23,42,0.8)] backdrop-blur-xl transition hover:bg-white/88 dark:border-slate-700/50 dark:bg-slate-900/68 dark:text-slate-100 max-md:right-5 max-md:top-auto max-md:bottom-6"
        title={isOpen ? "Zavřít Viki" : "Otevřít Viki"}
        aria-label={isOpen ? "Zavřít Viki" : "Otevřít Viki"}
      >
        <img
          src={vikiAvatar}
          alt="Viki avatar"
          className="h-7 w-7 rounded-full object-cover"
          loading="eager"
          decoding="async"
        />
      </button>

      <div
        className={`fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[1px] transition-opacity ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => {
          setIsOpen(false);
          setIsSettingsOpen(false);
        }}
      />

      <aside
        className={`fixed z-50 transition-all duration-300 ${
          isOpen
            ? "translate-x-0 opacity-100"
            : "translate-x-10 opacity-0 pointer-events-none"
        } right-4 top-4 bottom-4 w-[clamp(420px,30vw,560px)] max-w-[calc(100vw-32px)] rounded-[24px] border border-white/30 bg-white/70 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.7)] backdrop-blur-xl max-md:inset-0 max-md:w-full max-md:max-w-none max-md:rounded-none dark:border-slate-700/50 dark:bg-slate-900/60`}
        aria-hidden={!isOpen}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[24px]">
          <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-500/10" />
          <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-500/10" />
          <div className="absolute inset-0 border border-white/20 rounded-[24px]" />
        </div>

        <div className="relative flex h-full flex-col">
          <header className="border-b border-slate-200/70 px-4 py-3 dark:border-slate-700/60">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src={vikiAvatar}
                  alt="Profil Viki"
                  className="h-11 w-11 rounded-full border border-white/40 object-cover shadow-sm"
                  loading="eager"
                  decoding="async"
                />
                <div>
                  <div className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Viki</div>
                  <div className="text-xs text-slate-500 dark:text-slate-300">
                    Asistentka pro Tender Flow
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Režim: {audience === "client" ? "Klientský výstup" : "Interní"} · Model: {selectedModel || "-"}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen((prev) => !prev)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-white/60 hover:text-slate-700 dark:hover:bg-slate-800/60"
                  title="Otevřít nastavení Viki"
                  aria-label="Otevřít nastavení Viki"
                  aria-expanded={isSettingsOpen}
                  aria-controls="viki-settings-panel"
                >
                  <span className="material-symbols-outlined text-[20px]">settings</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setIsSettingsOpen(false);
                  }}
                  className="rounded-lg p-2 text-slate-500 hover:bg-white/60 hover:text-slate-700 dark:hover:bg-slate-800/60"
                  title="Zavřít"
                  aria-label="Zavřít panel Viki"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>
          </header>

          {isSettingsOpen && (
            <div
              id="viki-settings-panel"
              role="dialog"
              aria-label="Nastavení Viki"
              className="absolute left-4 right-4 top-[86px] z-30 max-h-[50vh] overflow-y-auto rounded-2xl border border-white/50 bg-white/90 p-3 text-xs text-slate-700 shadow-[0_14px_40px_-20px_rgba(15,23,42,0.8)] backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/90 dark:text-slate-200"
            >
              <div className="rounded-2xl border border-white/40 bg-white/55 p-3 text-xs text-slate-600 shadow-sm backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-200">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="font-medium text-slate-800 dark:text-slate-100">Audience režim</div>
                  <select
                    ref={settingsFirstFieldRef}
                    value={audience}
                    onChange={(event) => setAudience(event.target.value === "client" ? "client" : "internal")}
                    className="rounded-lg border border-slate-300/70 bg-white/90 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900/80"
                  >
                    <option value="internal">Interní</option>
                    <option value="client">Klientský výstup</option>
                  </select>
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {(Object.keys(scopeLabels) as AgentContextScope[]).map((scope) => {
                    const isActive = contextScopes.includes(scope);
                    return (
                      <button
                        key={scope}
                        type="button"
                        onClick={() => toggleContextScope(scope)}
                        className={`rounded-lg border px-2 py-1 text-[11px] transition ${
                          isActive
                            ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300"
                            : "border-slate-300/70 bg-white/90 text-slate-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300"
                        }`}
                      >
                        {scopeLabels[scope]}
                      </button>
                    );
                  })}
                </div>
                <div className="mb-2 text-[11px] text-slate-500 dark:text-slate-400">
                  Policy: {contextPolicyVersion}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-slate-800 dark:text-slate-100">Model</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Default: {defaultModel ? `${defaultModel.provider} / ${defaultModel.model}` : "načítám"}
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <select
                    value={selectedProvider}
                    onChange={(event) => {
                      void setSelectedProvider(event.target.value as AgentModelProvider);
                    }}
                    className="rounded-lg border border-slate-300/70 bg-white/90 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900/80"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="mistral">Mistral</option>
                    <option value="google">Google</option>
                  </select>
                  <select
                    value={selectedModel}
                    onChange={(event) => setSelectedModel(event.target.value)}
                    disabled={isModelListLoading || availableModels.length === 0}
                    className="rounded-lg border border-slate-300/70 bg-white/90 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900/80 disabled:opacity-60"
                  >
                    {availableModels.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {isModelListLoading
                    ? "Načítám katalog modelů..."
                    : `Aktivní model: ${selectedModel || "-"}`}
                </div>
              </div>

              <div className="mt-2 rounded-2xl border border-white/40 bg-white/55 p-3 text-xs text-slate-700 shadow-sm backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-200">
                <div className="mb-2 flex items-center justify-between">
                  <div className="font-medium text-slate-800 dark:text-slate-100">Hlasový režim</div>
                  <select
                    value={voiceInteractionMode}
                    onChange={(event) => setVoiceInteractionMode(event.target.value as VoiceInteractionMode)}
                    aria-label="Hlasový režim"
                    className="rounded-md border border-slate-300/70 bg-white/90 px-1.5 py-0.5 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
                  >
                    <option value="text_only">Jen text</option>
                    <option value="push_to_talk">Push-to-talk</option>
                    <option value="push_to_talk_auto_voice">Push-to-talk + auto hlas</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="font-medium text-slate-800 dark:text-slate-100">Hlas (push-to-talk)</div>
                  <select
                    value={voiceCostMode}
                    onChange={(event) => setVoiceCostMode(event.target.value as VoiceCostMode)}
                    className="rounded-md border border-slate-300/70 bg-white/90 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900/80"
                  >
                    <option value="economy">Úsporný</option>
                    <option value="balanced">Vyvážený</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="font-medium text-slate-800 dark:text-slate-100">Hlas Viki (TTS)</div>
                  <select
                    value={voiceStyle}
                    onChange={(event) => setVoiceStyle(event.target.value as VoiceStyle)}
                    aria-label="Hlas Viki"
                    className="rounded-md border border-slate-300/70 bg-white/90 px-1.5 py-0.5 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
                  >
                    {(Object.keys(voiceStyleLabels) as VoiceStyle[]).map((style) => (
                      <option key={style} value={style}>
                        {voiceStyleLabels[style]}
                      </option>
                    ))}
                  </select>
                </div>
                {showVoiceControls ? (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onMouseDown={() => void startVoiceCapture()}
                      onMouseUp={() => stopVoiceCapture()}
                      onMouseLeave={() => stopVoiceCapture()}
                      onTouchStart={() => void startVoiceCapture()}
                      onTouchEnd={() => stopVoiceCapture()}
                      className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                        isRecording
                          ? "border-rose-400 bg-rose-500 text-white"
                          : "border-slate-300 bg-white/80 text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">mic</span>
                      Podrž a mluv
                    </button>
                    <label className={`inline-flex items-center gap-1 text-[11px] ${isVoiceOutputForced ? "opacity-70" : ""}`}>
                      <input
                        type="checkbox"
                        checked={voiceOutputEnabled}
                        disabled={isVoiceOutputForced}
                        onChange={(event) => setVoiceOutputEnabled(event.target.checked)}
                      />
                      Hlasová odpověď
                    </label>
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    Režim {voiceInteractionLabels[voiceInteractionMode]} vypíná hlasové ovládání.
                  </div>
                )}
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Stav: {voiceStateLabel[voiceCaptureState] || voiceCaptureState}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Odhad ceny: {voiceCostMode === "economy" ? "nízká" : voiceCostMode === "balanced" ? "střední" : "vyšší"}
                </div>
                {lastVoiceWarning && (
                  <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">{lastVoiceWarning}</div>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {pendingActions.length > 0 && (
              <div className="mb-4 space-y-2">
                {pendingActions.map((action) => (
                  <div
                    key={action.id}
                    className="rounded-2xl border border-amber-300/70 bg-amber-50/90 p-3 text-xs text-amber-900 shadow-sm dark:border-amber-600/50 dark:bg-amber-950/40 dark:text-amber-200"
                  >
                    <div className="font-semibold">{action.title}</div>
                    <div className="mt-1 whitespace-pre-wrap">{action.summary}</div>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => confirmPendingAction(action.id)}
                        className="rounded-lg bg-emerald-600 px-2 py-1 text-white"
                      >
                        Potvrdit
                      </button>
                      <button
                        type="button"
                        onClick={() => dismissPendingAction(action.id)}
                        className="rounded-lg bg-slate-200 px-2 py-1 text-slate-700 dark:bg-slate-700 dark:text-white"
                      >
                        Zrušit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    message.role === "user"
                      ? "ml-auto bg-slate-900 text-white"
                      : "mr-auto border border-white/40 bg-white/85 text-slate-800 dark:border-slate-700/50 dark:bg-slate-900/80 dark:text-slate-100"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <div
                      className="viki-markdown leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: renderMarkdownToSafeHtml(message.content) }}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
                  )}
                  {message.role === "assistant" && (
                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                      <span>
                        {message.source === "skill" ? "skill" : "llm"}
                        {message.skillId ? ` • ${message.skillId}` : ""}
                      </span>
                      {voiceInteractionMode !== "text_only" && (
                        <button
                          type="button"
                          onClick={() => void playVoiceReply(message.content)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300/60 px-1.5 py-0.5 text-[10px] hover:bg-white dark:border-slate-700 dark:hover:bg-slate-800"
                          title="Přehrát hlasem"
                        >
                          <span className="material-symbols-outlined text-[12px]">volume_up</span>
                          Přečíst
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <footer className="border-t border-slate-200/70 bg-white/60 p-3 dark:border-slate-700/60 dark:bg-slate-900/50">
            {latestBudget && (
              <div className="mb-2 rounded-xl border border-slate-200/80 bg-white/80 px-2 py-1 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                Dnes: user {latestBudget.userUsedSecondsToday}s / {latestBudget.userLimitSecondsToday}s · org {latestBudget.organizationUsedSecondsToday}s / {latestBudget.organizationLimitSecondsToday}s
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={2}
                  placeholder="Napiš požadavek pro Viki..."
                  className="min-h-[70px] flex-1 resize-none rounded-xl border border-slate-300/80 bg-white/95 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/80"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSubmit();
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={isLoading || !draft.trim()}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                >
                  {isLoading ? "..." : "Odeslat"}
                </button>
              </div>
            </form>
          </footer>
        </div>
      </aside>
    </>
  );
};
