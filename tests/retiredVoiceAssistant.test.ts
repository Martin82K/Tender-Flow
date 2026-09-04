import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { FEATURES } from "@/config/features";

describe("retired voice assistant", () => {
  it("does not expose the retired capability or mount its runtime", () => {
    expect(Object.values(FEATURES)).not.toContain("feature_voice_assistant");
    const app = fs.readFileSync("app/AppContent.tsx", "utf8");
    expect(app).not.toMatch(/VoiceAssistant|voiceContracts|shouldEnableVoiceAssistantForRoute/);
    expect(fs.existsSync("features/voice-assistant")).toBe(false);
  });

  it("removes the server endpoints that could create new assistant sessions", () => {
    expect(fs.existsSync("supabase/functions/realtime-session-create")).toBe(false);
    expect(fs.existsSync("supabase/functions/viky-text-response")).toBe(false);
    expect(fs.existsSync("supabase/functions/_shared/vikyPersona.ts")).toBe(false);
  });
});
