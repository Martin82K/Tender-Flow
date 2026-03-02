export const DEFAULT_TTS_VOICE = "nova";
export const TTS_VOICE_ENV_KEY = "VIKI_TTS_VOICE";
export type TtsVoice = "nova" | "shimmer";

const TTS_VOICE_PATTERN = /^[a-z0-9_-]{2,32}$/;
const ALLOWED_FEMALE_TTS_VOICES = new Set<TtsVoice>([
  "nova",
  "shimmer",
]);

const sanitizeVoice = (rawValue: string | null | undefined): TtsVoice | null => {
  const raw = (rawValue || "").trim().toLowerCase();
  if (!raw) return null;
  if (!TTS_VOICE_PATTERN.test(raw)) return null;
  return ALLOWED_FEMALE_TTS_VOICES.has(raw as TtsVoice) ? (raw as TtsVoice) : null;
};

export const resolveTtsVoice = (
  rawPreferredVoice: string | null | undefined,
  rawEnvValue: string | null | undefined,
): TtsVoice => {
  const preferred = sanitizeVoice(rawPreferredVoice);
  if (preferred) return preferred;
  const fromEnv = sanitizeVoice(rawEnvValue);
  if (fromEnv) return fromEnv;
  return DEFAULT_TTS_VOICE;
};
