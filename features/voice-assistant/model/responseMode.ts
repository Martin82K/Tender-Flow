import type { VoiceAssistantResponseMode } from "../types";

const normalizePrompt = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const CONVERSATION_TARGET_RE =
  /\b(?:do|v|na)\s+(?:konverzace|konverzaci|chatu|chat|prepisu|prepis|panelu|okna)\b/;
const WRITE_RESULT_RE =
  /\b(?:jen|jenom|pouze|napis|vypis|hod|hodit|dej|vloz|posli|zobraz|ukaz|pridej)\b/;

export const shouldAnswerOnlyInConversation = (input: string): boolean => {
  const normalized = normalizePrompt(input);
  return CONVERSATION_TARGET_RE.test(normalized) && WRITE_RESULT_RE.test(normalized);
};

export const resolveRealtimeResponseMode = (
  input: string,
  fallbackMode: VoiceAssistantResponseMode,
): VoiceAssistantResponseMode =>
  shouldAnswerOnlyInConversation(input) ? "conversation" : fallbackMode;
