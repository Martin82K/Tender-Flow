import { invokeAuthedFunction } from "@/services/functionsClient";
import type { View } from "@/types";
import { type RealtimeSessionResponse, type RealtimeVoiceModel } from "../types";

export const createRealtimeVoiceSession = async (input: {
  currentProjectId: string | null;
  currentView: View;
  realtimeModel: RealtimeVoiceModel;
}): Promise<RealtimeSessionResponse> => {
  const response = await invokeAuthedFunction<RealtimeSessionResponse>(
    "realtime-session-create",
    {
      body: input,
      timeoutMs: 15_000,
    },
  );

  if (!response.clientSecret || response.clientSecret.startsWith("sk-")) {
    throw new Error("Server vrátil neplatný realtime token.");
  }

  if (response.model !== input.realtimeModel) {
    const receivedModel = typeof response.model === "string" && response.model.trim()
      ? response.model
      : "neznámý";
    throw new Error(
      `Realtime session používá neočekávaný model (${receivedModel}); očekávám ${input.realtimeModel}.`,
    );
  }

  return response;
};
