const STOP_WORDS = new Set([
  "a",
  "aby",
  "aj",
  "ale",
  "anebo",
  "ani",
  "asi",
  "bez",
  "by",
  "byt",
  "co",
  "dle",
  "do",
  "i",
  "jak",
  "je",
  "jako",
  "jsou",
  "k",
  "kde",
  "kdy",
  "na",
  "nad",
  "ne",
  "nebo",
  "neni",
  "o",
  "od",
  "po",
  "pro",
  "s",
  "se",
  "si",
  "ta",
  "tak",
  "tato",
  "ten",
  "to",
  "u",
  "v",
  "ve",
  "z",
  "za",
  "ze",
]);

const MAX_ENTRY_CONTENT_CHARS = 2400;

const stripInlineMarkdown = (value) => {
  return String(value)
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();
};

export const sanitizeForPrompt = (value) => {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\{\{[\s\S]*?\}\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const slugify = (raw) => {
  const text = stripInlineMarkdown(raw)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const slug = text
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "section";
};

export class Slugger {
  #counts = new Map();

  slug(value) {
    const base = slugify(value);
    const count = this.#counts.get(base) || 0;
    this.#counts.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  }
}

const toKeywordTokens = (value) => {
  return sanitizeForPrompt(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .filter((token) => !STOP_WORDS.has(token));
};

const buildKeywords = (title, content) => {
  const freq = new Map();
  const tokens = [...toKeywordTokens(title), ...toKeywordTokens(content).slice(0, 120)];

  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([token]) => token);
};

const normalizeEntryContent = (value) => {
  const clean = sanitizeForPrompt(value);
  if (!clean) return "Bez obsahu.";
  return clean.slice(0, MAX_ENTRY_CONTENT_CHARS);
};

export const extractManualKbEntries = (markdown) => {
  const lines = String(markdown || "").split(/\r?\n/);
  const slugger = new Slugger();

  let currentH2 = null;
  let currentH3 = null;
  const entries = [];

  const flush = (node) => {
    if (!node || !node.title) return;
    const content = normalizeEntryContent(node.lines.join("\n"));
    entries.push({
      slug: node.slug,
      title: node.title,
      content,
      keywords: buildKeywords(node.title, content),
      source_anchor: `#${node.slug}`,
      level: node.level,
      parentTitle: node.parentTitle || null,
    });
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const h3Match = line.match(/^###\s+(.+)$/);
    if (h3Match) {
      flush(currentH3);
      const title = stripInlineMarkdown(h3Match[1]);
      currentH3 = {
        level: 3,
        title,
        slug: slugger.slug(h3Match[1]),
        parentTitle: currentH2?.title || null,
        lines: [],
      };
      continue;
    }

    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      flush(currentH3);
      flush(currentH2);
      currentH3 = null;
      const title = stripInlineMarkdown(h2Match[1]);
      currentH2 = {
        level: 2,
        title,
        slug: slugger.slug(h2Match[1]),
        parentTitle: null,
        lines: [],
      };
      continue;
    }

    if (currentH3) {
      currentH3.lines.push(line);
      continue;
    }

    if (currentH2) {
      currentH2.lines.push(line);
    }
  }

  flush(currentH3);
  flush(currentH2);

  return entries.filter((entry) => entry.content.length > 0);
};
