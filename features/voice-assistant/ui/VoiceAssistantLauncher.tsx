import React from "react";
import { getVoiceAssistantStateLabel, useVoiceAssistant } from "../context/VoiceAssistantContext";
import { VIKY_BRANDING } from "../model/branding";

export const VoiceAssistantLauncher: React.FC = () => {
  const assistant = useVoiceAssistant();
  if (!assistant?.isAvailable) return null;

  const isActive =
    assistant.state === "listening" ||
    assistant.state === "responding" ||
    assistant.state === "connecting" ||
    assistant.state === "requesting-permission";

  return (
    <button
      type="button"
      onClick={assistant.openPanel}
      className={`relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-all ${
        isActive
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-[var(--tf-skin-line)] bg-[var(--tf-skin-surface-muted)] text-[var(--tf-skin-text-2)] hover:bg-[var(--tf-skin-surface-deep)]"
      }`}
      title={`Viky: ${getVoiceAssistantStateLabel(assistant.state)}`}
      aria-label={VIKY_BRANDING.name}
      aria-pressed={assistant.isPanelOpen}
    >
      <img
        src={VIKY_BRANDING.avatarUrl}
        alt=""
        className={`h-8 w-8 rounded-full object-cover ring-1 ring-[var(--tf-skin-line)] ${
          assistant.state === "listening" ? "animate-pulse" : ""
        }`}
        aria-hidden="true"
      />
      {isActive && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white ring-2 ring-white dark:ring-slate-900">
          <span className="material-symbols-outlined text-[11px]">
            {assistant.state === "listening" ? "mic" : "graphic_eq"}
          </span>
        </span>
      )}
      {assistant.state === "error" && (
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
      )}
    </button>
  );
};
