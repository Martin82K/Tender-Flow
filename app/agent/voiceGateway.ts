import { invokeAuthedFunction } from "@/services/functionsClient";
import type {
  VoiceSynthesisRequest,
  VoiceSynthesisResponse,
  VoiceTranscriptionRequest,
  VoiceTranscriptionResponse,
} from "@shared/types/voice";

const blobToBase64 = async (blob: Blob): Promise<string> => {
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);

  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary);
};

export const transcribeVoiceMessage = async (
  audioBlob: Blob,
  durationSeconds: number,
  costMode: "economy" | "balanced" | "premium",
  preferredProvider: "mistral" | "openai" = "mistral",
): Promise<VoiceTranscriptionResponse> => {
  const base64 = await blobToBase64(audioBlob);

  return invokeAuthedFunction<VoiceTranscriptionResponse>("ai-voice/transcribe", {
    body: {
      audioBase64: base64,
      mimeType: audioBlob.type || "audio/webm",
      durationSeconds,
      preferredProvider,
      costMode,
    } satisfies VoiceTranscriptionRequest,
  });
};

export const synthesizeVoiceReply = async (
  text: string,
  costMode: "economy" | "balanced" | "premium",
  preferredProvider: "openai" | "browser" = "openai",
): Promise<VoiceSynthesisResponse> => {
  return invokeAuthedFunction<VoiceSynthesisResponse>("ai-voice/speak", {
    body: {
      text,
      preferredProvider,
      costMode,
    } satisfies VoiceSynthesisRequest,
  });
};

export const base64ToObjectUrl = (base64: string, mimeType: string): string => {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType || "audio/mpeg" });
  return URL.createObjectURL(blob);
};
