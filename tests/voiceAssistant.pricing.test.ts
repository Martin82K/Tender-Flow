import { describe, expect, it } from "vitest";
import {
  addRealtimeUsageToCostEstimate,
  addTextModelUsageToCostEstimate,
  emptyVoiceAssistantCostEstimate,
  estimateOneMinuteSpeechCostUsd,
  estimateRealtimeUsageCostUsd,
  estimateTextModelUsageCostUsd,
  GPT_5_MINI_PRICING_USD_PER_1M,
  GPT_REALTIME_PRICING_USD_PER_1M,
} from "@/features/voice-assistant/model/realtimePricing";

describe("voice assistant realtime pricing", () => {
  it("počítá odhad ceny podle audio a text tokenů GPT-Realtime", () => {
    const usage = {
      input_token_details: {
        audio_tokens: 600,
        text_tokens: 100,
      },
      output_token_details: {
        audio_tokens: 1200,
        text_tokens: 50,
      },
    };

    const expected =
      (600 * GPT_REALTIME_PRICING_USD_PER_1M.audioInput +
        1200 * GPT_REALTIME_PRICING_USD_PER_1M.audioOutput +
        100 * GPT_REALTIME_PRICING_USD_PER_1M.textInput +
        50 * GPT_REALTIME_PRICING_USD_PER_1M.textOutput) /
      1_000_000;

    expect(estimateRealtimeUsageCostUsd(usage)).toBeCloseTo(expected, 8);
  });

  it("akumuluje cenu relace a minutový audio odhad", () => {
    const current = emptyVoiceAssistantCostEstimate();
    const next = addRealtimeUsageToCostEstimate(current, {
      input_token_details: { audio_tokens: 600 },
      output_token_details: { audio_tokens: 1200 },
    });
    const minute = estimateOneMinuteSpeechCostUsd();

    expect(next.audioInputTokens).toBe(600);
    expect(next.audioOutputTokens).toBe(1200);
    expect(next.estimatedUsd).toBeCloseTo(minute.totalUsd, 8);
  });

  it("počítá textové dotazy přes GPT-5 mini včetně cached input tokenů", () => {
    const usage = {
      input_tokens: 1000,
      output_tokens: 200,
      input_tokens_details: { cached_tokens: 100 },
    };
    const expected =
      (900 * GPT_5_MINI_PRICING_USD_PER_1M.textInput +
        100 * GPT_5_MINI_PRICING_USD_PER_1M.textCachedInput +
        200 * GPT_5_MINI_PRICING_USD_PER_1M.textOutput) /
      1_000_000;

    expect(estimateTextModelUsageCostUsd(usage)).toBeCloseTo(expected, 8);

    const next = addTextModelUsageToCostEstimate(emptyVoiceAssistantCostEstimate(), usage);
    expect(next.textInputTokens).toBe(1000);
    expect(next.textOutputTokens).toBe(200);
    expect(next.estimatedUsd).toBeCloseTo(expected, 8);
  });
});
