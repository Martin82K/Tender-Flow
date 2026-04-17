import type {
  SearchIndex,
  SearchInputSources,
  SearchResult,
  SearchResultGroup,
} from "./types";

const MAX_PER_GROUP = 5;
const MIN_QUERY_LENGTH = 2;

export const normalize = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const tokenize = (q: string): string[] =>
  normalize(q).split(/[\s.,;]+/).filter(Boolean);

const joinFields = (...fields: Array<string | null | undefined>): string =>
  fields.filter(Boolean).join(" ");

export const buildSearchIndex = (sources: SearchInputSources): SearchIndex => {
  const { projects, contacts, projectDetails } = sources;

  const projectEntries = projects.map((p) => {
    const details = projectDetails[p.id];
    return {
      project: p,
      haystacks: {
        primary: normalize(p.name || ""),
        secondary: normalize(
          joinFields(p.location, details?.investor, details?.address, details?.location),
        ),
      },
    };
  });

  const contactEntries = contacts.map((c) => ({
    contact: c,
    haystacks: {
      primary: normalize(c.company || ""),
      secondary: normalize(
        joinFields(c.ico, c.city, c.region, ...(c.regions ?? [])),
      ),
      tertiary: normalize(
        joinFields(
          ...(c.specialization ?? []),
          ...(c.contacts ?? []).map((p) => p.name),
          c.note,
        ),
      ),
    },
  }));

  const categoryEntries: SearchIndex["categories"] = [];
  const loadedIds = new Set<string>();
  for (const [projectId, details] of Object.entries(projectDetails)) {
    if (!details) continue;
    loadedIds.add(projectId);
    const projectTitle = details.title || projects.find((p) => p.id === projectId)?.name || "";
    for (const cat of details.categories ?? []) {
      categoryEntries.push({
        projectId,
        projectTitle,
        categoryId: cat.id,
        categoryTitle: cat.title,
        categoryDescription: cat.description || "",
        haystacks: {
          primary: normalize(cat.title || ""),
          secondary: normalize(
            joinFields(cat.description, ...(cat.workItems ?? []), projectTitle),
          ),
        },
      });
    }
  }

  return {
    projects: projectEntries,
    contacts: contactEntries,
    categories: categoryEntries,
    totalProjectCount: projects.length,
    loadedProjectDetailsCount: loadedIds.size,
  };
};

type FieldWeight = { haystack: string; weight: number };

/**
 * Score a single entity: for every token, each token must match at least
 * one field (AND across tokens). Per-field points add up.
 * Returns 0 if any token has no match — entity is excluded.
 */
const scoreEntity = (tokens: string[], fields: FieldWeight[]): number => {
  let total = 0;
  let primaryName = "";
  for (const f of fields) {
    if (f.weight >= 100) {
      primaryName = f.haystack;
      break;
    }
  }

  for (const token of tokens) {
    let tokenMatched = false;
    let tokenScore = 0;
    for (const { haystack, weight } of fields) {
      if (!haystack) continue;
      const idx = haystack.indexOf(token);
      if (idx === -1) continue;
      tokenMatched = true;
      if (weight >= 100) {
        if (haystack === token) tokenScore = Math.max(tokenScore, 100);
        else if (idx === 0) tokenScore = Math.max(tokenScore, 50);
        else tokenScore = Math.max(tokenScore, 25);
      } else {
        tokenScore = Math.max(tokenScore, weight);
      }
    }
    if (!tokenMatched) return 0;
    total += tokenScore;
  }

  // Short-name bonus — shorter primary name = more relevant
  if (primaryName) {
    total += Math.max(0, 20 - primaryName.length / 2);
  }
  return total;
};

export const searchAll = (
  query: string,
  index: SearchIndex,
): SearchResultGroup[] => {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) return [];
  const tokens = tokenize(q);
  if (tokens.length === 0) return [];

  const projectResults: SearchResult[] = [];
  for (const entry of index.projects) {
    const score = scoreEntity(tokens, [
      { haystack: entry.haystacks.primary, weight: 100 },
      { haystack: entry.haystacks.secondary, weight: 10 },
    ]);
    if (score > 0) {
      projectResults.push({
        id: `project:${entry.project.id}`,
        title: entry.project.name,
        subtitle: entry.project.location || undefined,
        category: "projects",
        icon: "domain",
        navigateTo: { view: "project", projectId: entry.project.id, tab: "overview" },
        score,
      });
    }
  }

  const contactResults: SearchResult[] = [];
  for (const entry of index.contacts) {
    const score = scoreEntity(tokens, [
      { haystack: entry.haystacks.primary, weight: 100 },
      { haystack: entry.haystacks.secondary, weight: 10 },
      { haystack: entry.haystacks.tertiary, weight: 5 },
    ]);
    if (score > 0) {
      const c = entry.contact;
      const subtitleParts = [c.city, c.region, c.ico && `IČ ${c.ico}`].filter(Boolean);
      contactResults.push({
        id: `contact:${c.id}`,
        title: c.company,
        subtitle: subtitleParts.length > 0 ? subtitleParts.join(" · ") : undefined,
        category: "contacts",
        icon: "business_center",
        navigateTo: { view: "contacts" },
        score,
      });
    }
  }

  const categoryResults: SearchResult[] = [];
  for (const entry of index.categories) {
    const score = scoreEntity(tokens, [
      { haystack: entry.haystacks.primary, weight: 100 },
      { haystack: entry.haystacks.secondary, weight: 10 },
    ]);
    if (score > 0) {
      categoryResults.push({
        id: `category:${entry.projectId}:${entry.categoryId}`,
        title: entry.categoryTitle,
        subtitle: entry.projectTitle || undefined,
        category: "categories",
        icon: "request_quote",
        navigateTo: {
          view: "project",
          projectId: entry.projectId,
          tab: "pipeline",
          categoryId: entry.categoryId,
        },
        score,
      });
    }
  }

  const sortAndCap = (arr: SearchResult[]) =>
    arr.sort((a, b) => b.score - a.score).slice(0, MAX_PER_GROUP);

  const groups: SearchResultGroup[] = [
    { category: "projects", label: "Projekty", items: sortAndCap(projectResults) },
    { category: "contacts", label: "Kontakty", items: sortAndCap(contactResults) },
    { category: "categories", label: "Poptávky", items: sortAndCap(categoryResults) },
  ];

  return groups.filter((g) => g.items.length > 0);
};

export { MIN_QUERY_LENGTH };
