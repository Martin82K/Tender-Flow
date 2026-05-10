export type VoiceAssistantCostEstimate = {
  audioInputTokens: number;
  audioOutputTokens: number;
  textInputTokens: number;
  textOutputTokens: number;
  estimatedUsd: number;
};

export type RealtimeUsageLike = {
  input_tokens?: number;
  output_tokens?: number;
  input_token_details?: {
    audio_tokens?: number;
    text_tokens?: number;
    cached_tokens?: number;
  };
  output_token_details?: {
    audio_tokens?: number;
    text_tokens?: number;
  };
};

export type TextModelUsageLike = {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: {
    cached_tokens?: number;
  };
};

export const GPT_REALTIME_PRICING_USD_PER_1M = {
  audioInput: 32,
  audioCachedInput: 0.4,
  audioOutput: 64,
  textInput: 4,
  textCachedInput: 0.4,
  textOutput: 16,
} as const;

export const GPT_5_MINI_PRICING_USD_PER_1M = {
  textInput: 0.25,
  textCachedInput: 0.025,
  textOutput: 2,
} as const;

export const GPT_REALTIME_AUDIO_TOKENS_PER_MINUTE = {
  inputSpeech: 600,
  outputSpeech: 1200,
} as const;

export const emptyVoiceAssistantCostEstimate = (): VoiceAssistantCostEstimate => ({
  audioInputTokens: 0,
  audioOutputTokens: 0,
  textInputTokens: 0,
  textOutputTokens: 0,
  estimatedUsd: 0,
});

const finiteNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const estimateTextModelUsageCostUsd = (usage: TextModelUsageLike): number => {
  const inputTokens = finiteNumber(usage.input_tokens);
  const outputTokens = finiteNumber(usage.output_tokens);
  const cachedInputTokens = Math.min(
    inputTokens,
    finiteNumber(usage.input_tokens_details?.cached_tokens),
  );
  const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);

  return (
    (uncachedInputTokens * GPT_5_MINI_PRICING_USD_PER_1M.textInput +
      cachedInputTokens * GPT_5_MINI_PRICING_USD_PER_1M.textCachedInput +
      outputTokens * GPT_5_MINI_PRICING_USD_PER_1M.textOutput) /
    1_000_000
  );
};

export const addTextModelUsageToCostEstimate = (
  current: VoiceAssistantCostEstimate,
  usage: TextModelUsageLike,
): VoiceAssistantCostEstimate => {
  const inputTokens = finiteNumber(usage.input_tokens);
  const outputTokens = finiteNumber(usage.output_tokens);

  return {
    ...current,
    textInputTokens: current.textInputTokens + inputTokens,
    textOutputTokens: current.textOutputTokens + outputTokens,
    estimatedUsd: current.estimatedUsd + estimateTextModelUsageCostUsd(usage),
  };
};

export const estimateRealtimeUsageCostUsd = (usage: RealtimeUsageLike): number => {
  const inputDetails = usage.input_token_details || {};
  const outputDetails = usage.output_token_details || {};
  const audioInputTokens = finiteNumber(inputDetails.audio_tokens);
  const audioOutputTokens = finiteNumber(outputDetails.audio_tokens);
  const textInputTokens = finiteNumber(inputDetails.text_tokens);
  const textOutputTokens = finiteNumber(outputDetails.text_tokens);

  return (
    (audioInputTokens * GPT_REALTIME_PRICING_USD_PER_1M.audioInput +
      audioOutputTokens * GPT_REALTIME_PRICING_USD_PER_1M.audioOutput +
      textInputTokens * GPT_REALTIME_PRICING_USD_PER_1M.textInput +
      textOutputTokens * GPT_REALTIME_PRICING_USD_PER_1M.textOutput) /
    1_000_000
  );
};

export const addRealtimeUsageToCostEstimate = (
  current: VoiceAssistantCostEstimate,
  usage: RealtimeUsageLike,
): VoiceAssistantCostEstimate => {
  const inputDetails = usage.input_token_details || {};
  const outputDetails = usage.output_token_details || {};
  const audioInputTokens = finiteNumber(inputDetails.audio_tokens);
  const audioOutputTokens = finiteNumber(outputDetails.audio_tokens);
  const textInputTokens = finiteNumber(inputDetails.text_tokens);
  const textOutputTokens = finiteNumber(outputDetails.text_tokens);

  return {
    audioInputTokens: current.audioInputTokens + audioInputTokens,
    audioOutputTokens: current.audioOutputTokens + audioOutputTokens,
    textInputTokens: current.textInputTokens + textInputTokens,
    textOutputTokens: current.textOutputTokens + textOutputTokens,
    estimatedUsd: current.estimatedUsd + estimateRealtimeUsageCostUsd(usage),
  };
};

export const estimateOneMinuteSpeechCostUsd = (): {
  inputSpeechUsd: number;
  outputSpeechUsd: number;
  totalUsd: number;
} => {
  const inputSpeechUsd =
    (GPT_REALTIME_AUDIO_TOKENS_PER_MINUTE.inputSpeech *
      GPT_REALTIME_PRICING_USD_PER_1M.audioInput) /
    1_000_000;
  const outputSpeechUsd =
    (GPT_REALTIME_AUDIO_TOKENS_PER_MINUTE.outputSpeech *
      GPT_REALTIME_PRICING_USD_PER_1M.audioOutput) /
    1_000_000;

  return {
    inputSpeechUsd,
    outputSpeechUsd,
    totalUsd: inputSpeechUsd + outputSpeechUsd,
  };
};

export const formatUsd = (value: number): string =>
  new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value >= 1 ? 2 : 4,
    maximumFractionDigits: value >= 1 ? 2 : 4,
  }).format(value);
