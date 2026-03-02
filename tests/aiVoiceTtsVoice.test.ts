import { describe, expect, it } from "vitest";
import { DEFAULT_TTS_VOICE, resolveTtsVoice } from "../supabase/functions/ai-voice/ttsVoice";

describe("ai-voice tts voice resolver", () => {
  it("fallbackne na nova, kdyz chybi preferovany hlas i env", () => {
    expect(resolveTtsVoice(undefined, undefined)).toBe(DEFAULT_TTS_VOICE);
    expect(resolveTtsVoice("", "")).toBe(DEFAULT_TTS_VOICE);
  });

  it("povoli jen female allowlist", () => {
    expect(resolveTtsVoice("nova", undefined)).toBe("nova");
    expect(resolveTtsVoice("shimmer", undefined)).toBe("shimmer");
  });

  it("muzske nebo nepovolene hlasy premapuje na nova", () => {
    expect(resolveTtsVoice("alloy", undefined)).toBe(DEFAULT_TTS_VOICE);
    expect(resolveTtsVoice("onyx", undefined)).toBe(DEFAULT_TTS_VOICE);
    expect(resolveTtsVoice("sage", undefined)).toBe(DEFAULT_TTS_VOICE);
  });

  it("nevalidni hodnotu premapuje na nova", () => {
    expect(resolveTtsVoice("!!!", undefined)).toBe(DEFAULT_TTS_VOICE);
    expect(resolveTtsVoice("a", undefined)).toBe(DEFAULT_TTS_VOICE);
  });

  it("kdyz preferovany hlas chybi, pouzije env", () => {
    expect(resolveTtsVoice(undefined, "shimmer")).toBe("shimmer");
  });

  it("preferovany hlas z UI ma prioritu pred env", () => {
    expect(resolveTtsVoice("nova", "shimmer")).toBe("nova");
  });
});
