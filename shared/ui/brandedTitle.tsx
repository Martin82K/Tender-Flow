import React from "react";

export interface BrandedTitleSegment {
  text: string;
  variant: "default" | "script";
}

const KNOWN_SCRIPT_PART_PATTERN = /(Baz[eé]n)/iu;
const LEADING_PROJECT_MARK_PATTERN =
  /^(\s*(?:\d{3,}|[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]{2,})\s+)(.+)$/u;
const DESCRIPTOR_BOUNDARY_PATTERN =
  /^(.*?\b(?:silnice|most|mostu|l[aá]vka|l[aá]vky|škola|školy|školka|školky|baz[eé]n|kanalizace|vodovod|komunikace|chodn[ií]k|chodn[ií]ku|parkoviště|objekt|budova)\b)(.*)$/iu;
const LAST_WORD_PATTERN = /^(.+\S)(\s+\S+\s*)$/u;

const splitKnownScriptParts = (title: string): BrandedTitleSegment[] | null => {
  if (!KNOWN_SCRIPT_PART_PATTERN.test(title)) return null;

  return title.split(new RegExp(KNOWN_SCRIPT_PART_PATTERN, "giu")).flatMap((text) => {
    if (!text) return [];
    return {
      text,
      variant: KNOWN_SCRIPT_PART_PATTERN.test(text) ? "script" : "default",
    };
  });
};

export const splitIndustrialProjectTitle = (title: string): BrandedTitleSegment[] => {
  const knownParts = splitKnownScriptParts(title);
  if (knownParts) return knownParts;

  const leadingProjectMark = title.match(LEADING_PROJECT_MARK_PATTERN);
  if (!leadingProjectMark) return [{ text: title, variant: "default" }];

  const [, prefix, body] = leadingProjectMark;
  const descriptor = body.match(DESCRIPTOR_BOUNDARY_PATTERN);
  if (descriptor?.[1]?.trim()) {
    const [, scriptText, suffix] = descriptor;
    return [
      { text: prefix, variant: "default" },
      { text: scriptText, variant: "script" },
      ...(suffix ? [{ text: suffix, variant: "default" } satisfies BrandedTitleSegment] : []),
    ];
  }

  const lastWord = body.match(LAST_WORD_PATTERN);
  if (!lastWord) {
    return [
      { text: prefix, variant: "default" },
      { text: body, variant: "script" },
    ];
  }

  const [, scriptText, suffix] = lastWord;
  return [
    { text: prefix, variant: "default" },
    { text: scriptText, variant: "script" },
    { text: suffix, variant: "default" },
  ];
};

export const renderIndustrialProjectTitle = (
  title: string,
  isIndustrialSkin: boolean,
): React.ReactNode => {
  if (!isIndustrialSkin) return title;

  return splitIndustrialProjectTitle(title).map((segment, index) => {
    if (segment.variant !== "script") {
      return <React.Fragment key={`${segment.text}-${index}`}>{segment.text}</React.Fragment>;
    }

    return (
      <span key={`${segment.text}-${index}`} className="tf-skin-script">
        {segment.text}
      </span>
    );
  });
};
