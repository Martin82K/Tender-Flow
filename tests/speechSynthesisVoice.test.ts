import { describe, expect, it } from "vitest";
import { selectPreferredFemaleCzechVoice } from "@app/agent/speechSynthesisVoice";

type VoiceFixture = {
  name?: string;
  lang?: string;
  voiceURI?: string;
};

describe("selectPreferredFemaleCzechVoice", () => {
  it("preferuje cesky zensky hlas pred ostatnimi", () => {
    const voices: VoiceFixture[] = [
      { name: "Czech Male", lang: "cs-CZ", voiceURI: "czech-male" },
      { name: "Microsoft Zuzana", lang: "cs-CZ", voiceURI: "zuzana-cz" },
      { name: "English Female", lang: "en-US", voiceURI: "zira-en" },
    ];

    const selected = selectPreferredFemaleCzechVoice(voices);
    expect(selected?.name).toBe("Microsoft Zuzana");
  });

  it("fallbackne na libovolny cesky hlas, kdyz zensky neni", () => {
    const voices: VoiceFixture[] = [
      { name: "Czech Male", lang: "cs-CZ", voiceURI: "czech-male" },
      { name: "English Female", lang: "en-US", voiceURI: "zira-en" },
    ];

    const selected = selectPreferredFemaleCzechVoice(voices);
    expect(selected?.name).toBe("Czech Male");
  });

  it("kdyz chybi cestina, vezme zensky hlas v jinem jazyce", () => {
    const voices: VoiceFixture[] = [
      { name: "English Male", lang: "en-US", voiceURI: "en-male" },
      { name: "Samantha", lang: "en-US", voiceURI: "samantha-en" },
    ];

    const selected = selectPreferredFemaleCzechVoice(voices);
    expect(selected?.name).toBe("Samantha");
  });
});
