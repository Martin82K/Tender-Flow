import { supabase } from "./supabase";
import { invokeAuthedFunction } from "./functionsClient";

export type OverviewChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AiProxyResponse = { text?: string };

type ChatSettings = {
  provider: string;
  model: string;
};

const getChatSettings = async (): Promise<ChatSettings> => {
  const { data } = await supabase
    .from("app_settings")
    .select("ai_extraction_model, ai_extraction_provider")
    .eq("id", "default")
    .single();

  return {
    provider: data?.ai_extraction_provider || "openrouter",
    model: data?.ai_extraction_model || "anthropic/claude-3.5-sonnet",
  };
};

export const sendOverviewChatMessage = async (
  context: string,
  messages: OverviewChatMessage[],
): Promise<string> => {
  const { provider, model } = await getChatSettings();

  const history = [
    { role: "system", content: context },
    ...messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
  ];

  const response = await invokeAuthedFunction<AiProxyResponse>("ai-proxy", {
    body: {
      history,
      provider,
      model,
    },
  });

  return response.text || "";
};
