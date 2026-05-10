import { describe, expect, it } from "vitest";
import {
  resolveRealtimeResponseMode,
  shouldAnswerOnlyInConversation,
} from "@/features/voice-assistant/model/responseMode";

describe("voice assistant response mode detection", () => {
  it("rozpozná požadavek na výpis pouze do konverzace nebo chatu", () => {
    expect(shouldAnswerOnlyInConversation("Vypiš mi parametry smlouvy do konverzace.")).toBe(true);
    expect(shouldAnswerOnlyInConversation("Hoď telefon na investora jen do chatu.")).toBe(true);
    expect(shouldAnswerOnlyInConversation("Dej mi čísla pouze do přepisu.")).toBe(true);
  });

  it("bez explicitního požadavku zachová aktuální režim odpovědi", () => {
    expect(resolveRealtimeResponseMode("Jaké jsou parametry smlouvy?", "voice")).toBe("voice");
    expect(resolveRealtimeResponseMode("Vypiš mi parametry smlouvy do konverzace.", "voice")).toBe("conversation");
    expect(resolveRealtimeResponseMode("Jaké jsou parametry smlouvy?", "conversation")).toBe("conversation");
  });
});
