import React, { useEffect, useRef, useState } from "react";
import { getVoiceAssistantStateLabel, useVoiceAssistant } from "../context/VoiceAssistantContext";
import {
  estimateOneMinuteSpeechCostUsd,
  formatUsd,
  GPT_5_MINI_PRICING_USD_PER_1M,
  GPT_REALTIME_PRICING_USD_PER_1M,
} from "../model/realtimePricing";
import { VIKY_BRANDING } from "../model/branding";
import type { RealtimeVoiceModel } from "../types";

const roleLabel = {
  user: "Vy",
  assistant: "Viky",
  system: "Systém",
} as const;

const realtimeModelOptions: Array<{ model: RealtimeVoiceModel; label: string; title: string }> = [
  {
    model: "gpt-realtime-2",
    label: "Realtime 2",
    title: "Schopnější hlasový model s lepším používáním nástrojů",
  },
  {
    model: "gpt-realtime",
    label: "Realtime",
    title: "Starší standardní realtime model",
  },
];

export const VoiceAssistantPanel: React.FC = () => {
  const assistant = useVoiceAssistant();
  const [text, setText] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const conversationEndRef = useRef<HTMLDivElement | null>(null);
  const isVisible = Boolean(assistant?.isAvailable && assistant.isPanelOpen);

  useEffect(() => {
    if (!isVisible) return;
    if (typeof conversationEndRef.current?.scrollIntoView === "function") {
      conversationEndRef.current.scrollIntoView({ block: "end" });
    }
  }, [
    isVisible,
    assistant?.messages.length,
    assistant?.liveTranscript?.content,
    assistant?.liveTranscript?.role,
    assistant?.error,
  ]);

  if (!assistant || !isVisible) return null;

  const handleSend = async () => {
    const value = text.trim();
    if (!value) return;
    setText("");
    await assistant.sendText(value);
  };

  const isListening = assistant.state === "listening";
  const isResponding = assistant.state === "responding";
  const isVoiceModeActive = assistant.isVoiceModeActive;
  const isBusy =
    assistant.state === "requesting-permission" ||
    assistant.state === "connecting";
  const minuteCost = estimateOneMinuteSpeechCostUsd();
  const costText = assistant.costEstimate.estimatedUsd > 0
    ? formatUsd(assistant.costEstimate.estimatedUsd)
    : formatUsd(0);
  const conversationText = assistant.messages
    .concat(assistant.liveTranscript?.content ? [{
      id: "live",
      role: assistant.liveTranscript.role,
      content: assistant.liveTranscript.content,
    }] : [])
    .map((message) => `${roleLabel[message.role]}: ${message.content}`)
    .join("\n\n");

  const handleCopyConversation = async () => {
    if (!conversationText || !navigator.clipboard) return;
    await navigator.clipboard.writeText(conversationText);
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 1600);
  };

  const handleClearConversation = () => {
    assistant.clearMessages();
    setCopyState("idle");
  };

  return (
    <aside
      className="tf-voice-assistant-panel fixed bottom-5 right-5 z-50 flex w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-[var(--tf-skin-line)] bg-[var(--tf-skin-card)] text-[var(--tf-skin-text)] shadow-2xl"
      aria-label="Viky"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--tf-skin-line)] bg-[var(--tf-skin-surface)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={VIKY_BRANDING.avatarUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-[var(--tf-skin-line)]"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--tf-skin-text)]">
              <span className="material-symbols-outlined text-[18px] text-[var(--tf-skin-accent)]">record_voice_over</span>
              {VIKY_BRANDING.name}
            </div>
            <div className="truncate text-[11px] font-medium text-[var(--tf-skin-muted)]">
              {VIKY_BRANDING.role}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--tf-skin-muted)]">
              <span>{isVoiceModeActive && assistant.state === "ready" ? "Hlasový režim zapnutý" : getVoiceAssistantStateLabel(assistant.state)}</span>
              {isVoiceModeActive && (
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isResponding && (
            <button
              type="button"
              onClick={assistant.interrupt}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--tf-skin-muted)] hover:bg-[var(--tf-skin-surface-muted)] hover:text-[var(--tf-skin-text)]"
              title="Přerušit odpověď"
              aria-label="Přerušit odpověď"
            >
              <span className="material-symbols-outlined text-[19px]">stop_circle</span>
            </button>
          )}
          <button
            type="button"
            onClick={assistant.closePanel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--tf-skin-muted)] hover:bg-[var(--tf-skin-surface-muted)] hover:text-[var(--tf-skin-text)]"
            title="Zavřít"
            aria-label="Zavřít Viky"
          >
            <span className="material-symbols-outlined text-[19px]">close</span>
          </button>
        </div>
      </div>

      <div className="border-b border-[var(--tf-skin-line)] bg-[var(--tf-skin-surface-muted)] px-4 py-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-xs font-semibold text-[var(--tf-skin-text)]">Model hlasu</div>
          <div
            className="inline-flex rounded-lg border border-[var(--tf-skin-line)] bg-[var(--tf-skin-card)] p-0.5"
            aria-label="Model hlasové relace"
          >
            {realtimeModelOptions.map((option) => {
              const selected = assistant.selectedRealtimeModel === option.model;
              return (
                <button
                  key={option.model}
                  type="button"
                  onClick={() => assistant.setRealtimeModel(option.model)}
                  disabled={isBusy || isVoiceModeActive}
                  className={`h-7 rounded-md px-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${
                    selected
                      ? "bg-[var(--tf-skin-accent)] text-white"
                      : "text-[var(--tf-skin-text-2)] hover:bg-[var(--tf-skin-surface-muted)]"
                  }`}
                  aria-pressed={selected}
                  title={option.title}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-[var(--tf-skin-line)] bg-[var(--tf-skin-card)] px-3 py-2">
            <div className="font-semibold text-[var(--tf-skin-text)]">Odhad relace</div>
            <div className="mt-0.5 text-[var(--tf-skin-muted)]">{costText}</div>
          </div>
          <div className="rounded-lg border border-[var(--tf-skin-line)] bg-[var(--tf-skin-card)] px-3 py-2">
            <div className="font-semibold text-[var(--tf-skin-text)]">Audio minuta</div>
            <div className="mt-0.5 text-[var(--tf-skin-muted)]">cca {formatUsd(minuteCost.totalUsd)}</div>
          </div>
        </div>
        <div className="mt-2 text-[11px] leading-snug text-[var(--tf-skin-muted)]">
          {assistant.selectedRealtimeModel} audio: in ${GPT_REALTIME_PRICING_USD_PER_1M.audioInput}/1M tok., out ${GPT_REALTIME_PRICING_USD_PER_1M.audioOutput}/1M tok.
          {" "}Text: GPT-5 mini in ${GPT_5_MINI_PRICING_USD_PER_1M.textInput}/1M, out ${GPT_5_MINI_PRICING_USD_PER_1M.textOutput}/1M.
        </div>
        <label className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[var(--tf-skin-line)] bg-[var(--tf-skin-card)] px-3 py-2 text-xs">
          <span className="min-w-0">
            <span className="block font-semibold text-[var(--tf-skin-text)]">Jen do konverzace</span>
            <span className="block text-[var(--tf-skin-muted)]">Viky vloží výsledek, čísla a kontakty sem bez čtení nahlas.</span>
          </span>
          <input
            type="checkbox"
            checked={assistant.responseMode === "conversation"}
            onChange={(event) => assistant.setResponseMode(event.target.checked ? "conversation" : "voice")}
            className="h-4 w-4 shrink-0 accent-[var(--tf-skin-accent)]"
            aria-label="Odpovídat jen do konverzace"
          />
        </label>
      </div>

      <div className="flex min-h-44 flex-col border-b border-[var(--tf-skin-line)] bg-[var(--tf-skin-card)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--tf-skin-line)] px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--tf-skin-muted)]">
            <span className="material-symbols-outlined text-[16px]">notes</span>
            Konverzace
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleClearConversation}
              disabled={!conversationText && !assistant.error}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--tf-skin-line)] bg-[var(--tf-skin-surface)] text-[var(--tf-skin-text-2)] transition-colors hover:bg-[var(--tf-skin-surface-muted)] disabled:cursor-not-allowed disabled:opacity-45"
              title="Vymazat konverzaci"
              aria-label="Vymazat konverzaci"
            >
              <span className="material-symbols-outlined text-[15px]">delete</span>
            </button>
            <button
              type="button"
              onClick={() => void handleCopyConversation()}
              disabled={!conversationText}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--tf-skin-line)] bg-[var(--tf-skin-surface)] px-2 text-xs font-semibold text-[var(--tf-skin-text-2)] transition-colors hover:bg-[var(--tf-skin-surface-muted)] disabled:cursor-not-allowed disabled:opacity-45"
              aria-label="Kopírovat konverzaci"
            >
              <span className="material-symbols-outlined text-[15px]">
                {copyState === "copied" ? "check" : "content_copy"}
              </span>
              {copyState === "copied" ? "Zkopírováno" : "Kopírovat"}
            </button>
          </div>
        </div>

        <div
          className="max-h-64 min-h-32 flex-1 space-y-3 overflow-y-auto px-4 py-3"
        >
          {assistant.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {assistant.error}
            </div>
          )}
          {assistant.messages.length === 0 && !assistant.liveTranscript ? (
            <div className="flex h-24 items-center justify-center text-center text-sm text-[var(--tf-skin-muted)]">
              {isVoiceModeActive
                ? "Viky poslouchá."
                : "Zatím bez konverzace."}
            </div>
          ) : (
            <>
              {assistant.messages.map((message) => (
                <div key={message.id} className="select-text rounded-lg border border-[var(--tf-skin-line)] bg-[var(--tf-skin-surface-muted)] px-3 py-2 text-sm">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--tf-skin-muted)]">
                    {roleLabel[message.role]}
                  </div>
                  <div className="whitespace-pre-wrap text-[var(--tf-skin-text)]">{message.content}</div>
                </div>
              ))}
              {assistant.liveTranscript && (
                <div className="select-text rounded-lg border border-[var(--tf-skin-accent)]/40 bg-[var(--tf-skin-surface-muted)] px-3 py-2 text-sm shadow-sm">
                  <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--tf-skin-muted)]">
                    <span>{roleLabel[assistant.liveTranscript.role]}</span>
                    <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--tf-skin-accent)]" aria-hidden="true" />
                  </div>
                  <div className="whitespace-pre-wrap text-[var(--tf-skin-text)]">
                    {assistant.liveTranscript.content || (assistant.liveTranscript.role === "assistant" ? "Viky připravuje odpověď..." : "Rozpoznávám řeč...")}
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={conversationEndRef} aria-hidden="true" />
        </div>
      </div>

      <div className="bg-[var(--tf-skin-surface)] px-4 py-3">
        <button
          type="button"
          onClick={() => {
            if (isVoiceModeActive) {
              assistant.stopVoiceMode();
            } else {
              void assistant.startVoiceMode();
            }
          }}
          disabled={isBusy}
          className={`flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold transition-all ${
            isVoiceModeActive
              ? "tf-voice-danger-button"
              : "tf-voice-primary-button disabled:cursor-not-allowed disabled:opacity-60"
          }`}
          aria-pressed={isVoiceModeActive}
          aria-label={isVoiceModeActive ? "Vypnout hlasový režim" : "Zapnout hlasový režim"}
        >
          <span className={`material-symbols-outlined text-[20px] ${isVoiceModeActive ? "animate-pulse" : ""}`}>
            {isVoiceModeActive ? "mic" : "hearing"}
          </span>
          {isVoiceModeActive ? "Vypnout Viky" : isBusy ? "Připojuji..." : "Zapnout Viky"}
        </button>

        {!isVoiceModeActive && (
          <button
            type="button"
            onMouseDown={() => void assistant.startListening()}
            onMouseUp={assistant.stopListening}
            onMouseLeave={() => {
              if (isListening) assistant.stopListening();
            }}
            onTouchStart={() => void assistant.startListening()}
            onTouchEnd={assistant.stopListening}
            disabled={isBusy}
            className={`mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[var(--tf-skin-line)] text-sm font-semibold transition-all ${
              isListening
                ? "tf-voice-danger-soft-button"
                : "bg-[var(--tf-skin-card)] text-[var(--tf-skin-text)] hover:bg-[var(--tf-skin-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
            }`}
            aria-label={isListening ? "Pustit mikrofon" : "Držet a mluvit"}
          >
            <span className={`material-symbols-outlined text-[19px] ${isListening ? "animate-pulse" : ""}`}>
              {isListening ? "mic" : "keyboard_voice"}
            </span>
            {isListening ? "Pusťte pro odpověď" : "Push-to-talk"}
          </button>
        )}

        <div className="mt-3 flex items-center gap-2">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleSend();
            }}
            placeholder="Nebo napište dotaz…"
            className="min-w-0 flex-1 rounded-lg border border-[var(--tf-skin-line)] bg-[var(--tf-skin-card)] px-3 py-2 text-sm text-[var(--tf-skin-text)] outline-none placeholder:text-[var(--tf-skin-muted)] focus:border-[var(--tf-skin-accent)]"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!text.trim()}
            className="tf-voice-primary-button inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-50"
            title="Odeslat text"
            aria-label="Odeslat textový dotaz"
          >
            <span className="material-symbols-outlined text-[19px]">send</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
