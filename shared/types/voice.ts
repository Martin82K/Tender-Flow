export type VoiceCaptureState =
  | "idle"
  | "recording"
  | "uploading"
  | "transcribing"
  | "replying";

export type VoiceCostMode = "economy" | "balanced" | "premium";

export interface VoiceBudgetStatus {
  userUsedSecondsToday: number;
  userLimitSecondsToday: number;
  organizationUsedSecondsToday: number;
  organizationLimitSecondsToday: number;
  userUsedTtsCharsToday: number;
  userLimitTtsCharsToday: number;
  organizationUsedTtsCharsToday: number;
  organizationLimitTtsCharsToday: number;
}

export interface VoiceTranscriptionRequest {
  audioBase64: string;
  mimeType: string;
  durationSeconds: number;
  costMode: VoiceCostMode;
  preferredProvider?: "mistral" | "openai";
}

export interface VoiceTranscriptionResponse {
  text: string;
  provider: "mistral" | "openai";
  budget: VoiceBudgetStatus;
  warning?: string;
}

export interface VoiceSynthesisRequest {
  text: string;
  costMode: VoiceCostMode;
  preferredProvider?: "openai" | "browser";
}

export interface VoiceSynthesisResponse {
  audioBase64?: string;
  mimeType?: string;
  provider: "openai" | "browser";
  budget: VoiceBudgetStatus;
  warning?: string;
}
