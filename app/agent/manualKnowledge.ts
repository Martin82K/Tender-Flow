import type { AgentManualCitation, AgentRuntimeSnapshot } from "@shared/types/agent";

interface ManualKbEntry {
  slug: string;
  title: string;
  content: string;
  keywords: string[];
  source_anchor: string;
  level?: number;
  parentTitle?: string | null;
}

interface ManualKbIndex {
  generatedAt?: string;
  source?: string;
  entries: ManualKbEntry[];
}

export interface RetrievedManualSection {
  title: string;
  anchor: string;
  content: string;
  confidence: number;
}

const INDEX_URL = "/user-manual/index.kb.json";
const MAX_CONTEXT_CHARS = 4200;
const MAX_SECTIONS = 3;

let indexCache: ManualKbIndex | null = null;

const ADMIN_KEYWORDS = [
  "admin",
  "administrace",
  "sprava uzivatelu",
  "správa uživatelů",
  "whitelist",
  "role",
  "opravneni",
  "oprávnění",
];

const toTokens = (value: string): string[] =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);

const tokenSet = (value: string): Set<string> => new Set(toTokens(value));

const clampConfidence = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
};

const isAdminOnlyEntry = (entry: ManualKbEntry): boolean => {
  const normalized = `${entry.title} ${entry.content}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return ADMIN_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const sanitizeManualText = (value: string): string =>
  value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\{\{[\s\S]*?\}\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const loadManualIndex = async (forceRefresh = false): Promise<ManualKbIndex> => {
  if (!forceRefresh && indexCache) {
    return indexCache;
  }

  const response = await fetch(INDEX_URL, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Nepodařilo se načíst index uživatelské příručky.");
  }

  const parsed = (await response.json()) as Partial<ManualKbIndex>;
  const normalized: ManualKbIndex = {
    generatedAt: parsed.generatedAt,
    source: parsed.source,
    entries: Array.isArray(parsed.entries)
      ? parsed.entries
          .map((entry) => ({
            slug: String(entry.slug || "").trim(),
            title: String(entry.title || "").trim(),
            content: sanitizeManualText(String(entry.content || "")),
            keywords: Array.isArray(entry.keywords)
              ? entry.keywords.map((keyword) => String(keyword || "").toLowerCase()).filter(Boolean)
              : [],
            source_anchor: String(entry.source_anchor || "").trim() || `#${String(entry.slug || "").trim()}`,
            level: Number(entry.level || 2),
            parentTitle: entry.parentTitle ? String(entry.parentTitle) : null,
          }))
          .filter((entry) => entry.slug && entry.title && entry.content)
      : [],
  };

  indexCache = normalized;
  return normalized;
};

const scoreEntry = (entry: ManualKbEntry, queryTokens: Set<string>): number => {
  if (queryTokens.size === 0) return 0;

  let score = 0;
  const entryTokens = tokenSet(`${entry.title} ${entry.content}`);

  for (const token of queryTokens) {
    if (entryTokens.has(token)) {
      score += 2;
    }
    if (entry.keywords.includes(token)) {
      score += 3;
    }
    if (entry.title.toLowerCase().includes(token)) {
      score += 2;
    }
  }

  if (entry.level === 2) {
    score += 0.25;
  }

  return score;
};

export const retrieveManualSections = async (
  query: string,
  runtime: AgentRuntimeSnapshot,
): Promise<RetrievedManualSection[]> => {
  if (!runtime.contextScopes.includes("manual")) {
    return [];
  }

  const q = sanitizeManualText(query);
  if (!q) return [];

  const index = await loadManualIndex();
  if (index.entries.length === 0) return [];

  const queryTokens = tokenSet(q);

  const filteredEntries = runtime.isAdmin
    ? index.entries
    : index.entries.filter((entry) => !isAdminOnlyEntry(entry));

  const ranked = filteredEntries
    .map((entry) => ({
      entry,
      score: scoreEntry(entry, queryTokens),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SECTIONS * 2);

  const result: RetrievedManualSection[] = [];
  let totalChars = 0;

  for (const item of ranked) {
    const cleanContent = sanitizeManualText(item.entry.content);
    if (!cleanContent) continue;

    const nextChars = totalChars + cleanContent.length;
    if (result.length >= MAX_SECTIONS || nextChars > MAX_CONTEXT_CHARS) {
      continue;
    }

    totalChars = nextChars;
    result.push({
      title: item.entry.title,
      anchor: item.entry.source_anchor,
      content: cleanContent,
      confidence: clampConfidence(item.score / 20),
    });
  }

  return result;
};

export const formatManualContextForPrompt = (sections: RetrievedManualSection[]): string => {
  if (sections.length === 0) {
    return "MANUAL CONTEXT: bez shody v uživatelské příručce.";
  }

  const blocks = sections.map((section, index) => {
    return [
      `### Sekce ${index + 1}: ${section.title} (${section.anchor})`,
      section.content,
    ].join("\n");
  });

  return [
    "MANUAL CONTEXT (public-safe, onboarding/navigation):",
    ...blocks,
  ].join("\n\n");
};

export const toManualCitations = (sections: RetrievedManualSection[]): AgentManualCitation[] => {
  return sections.map((section) => ({
    sectionTitle: section.title,
    anchor: section.anchor,
    confidence: clampConfidence(section.confidence),
  }));
};

export const ensureManualCitationInReply = (
  reply: string,
  citations: AgentManualCitation[],
): { text: string; emitted: boolean } => {
  const cleanReply = reply.trim();
  if (!cleanReply) {
    return {
      text: cleanReply,
      emitted: false,
    };
  }

  if (/\bzdroj\s*:/i.test(cleanReply)) {
    return {
      text: cleanReply,
      emitted: true,
    };
  }

  const bestCitation = citations[0];
  if (!bestCitation) {
    return {
      text: cleanReply,
      emitted: false,
    };
  }

  return {
    text: `${cleanReply}\n\nZdroj: ${bestCitation.sectionTitle} (${bestCitation.anchor})`,
    emitted: true,
  };
};
