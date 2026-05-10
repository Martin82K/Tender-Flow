import { invokeAuthedFunction } from "@/services/functionsClient";
import type { View } from "@/types";
import type {
  VoiceAssistantMessage,
  VoiceAssistantTextResponse,
  VoiceAssistantTextToolOutput,
} from "../types";

type CreateTextAssistantResponseInput = {
  input?: string;
  messages?: VoiceAssistantMessage[];
  currentProjectId: string | null;
  currentView: View;
  previousResponseId?: string;
  toolOutputs?: VoiceAssistantTextToolOutput[];
};

export const createTextAssistantResponse = async (
  input: CreateTextAssistantResponseInput,
): Promise<VoiceAssistantTextResponse> => {
  const response = await invokeAuthedFunction<VoiceAssistantTextResponse>(
    "viky-text-response",
    {
      body: input,
      timeoutMs: 30_000,
    },
  );

  if (response.model !== "gpt-5-mini") {
    throw new Error("Textová Viky používá neočekávaný model.");
  }

  if (response.kind === "tool_calls" && !response.toolCalls?.length) {
    throw new Error("Textová Viky vrátila prázdné volání nástrojů.");
  }

  if (response.kind === "message" && typeof response.text !== "string") {
    throw new Error("Textová Viky vrátila neplatnou odpověď.");
  }

  return response;
};
