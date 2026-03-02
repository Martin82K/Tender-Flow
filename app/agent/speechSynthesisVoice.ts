type VoiceLike = {
  lang?: string | null;
  name?: string | null;
  voiceURI?: string | null;
};

const FEMALE_HINTS = [
  "female",
  "woman",
  "zena",
  "žena",
  "nova",
  "zira",
  "samantha",
  "victoria",
  "anna",
  "zuzana",
];

const normalize = (value: string | null | undefined): string =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const hasFemaleHint = (voice: VoiceLike): boolean => {
  const haystack = `${normalize(voice.name)} ${normalize(voice.voiceURI)}`;
  return FEMALE_HINTS.some((hint) => haystack.includes(hint));
};

const isCzechVoice = (voice: VoiceLike): boolean => {
  const lang = normalize(voice.lang);
  return lang === "cs" || lang.startsWith("cs-");
};

export const selectPreferredFemaleCzechVoice = <T extends VoiceLike>(voices: readonly T[]): T | null => {
  if (!voices.length) return null;

  const femaleCzech = voices.find((voice) => isCzechVoice(voice) && hasFemaleHint(voice));
  if (femaleCzech) return femaleCzech;

  const anyCzech = voices.find((voice) => isCzechVoice(voice));
  if (anyCzech) return anyCzech;

  const anyFemale = voices.find((voice) => hasFemaleHint(voice));
  if (anyFemale) return anyFemale;

  return voices[0] || null;
};
