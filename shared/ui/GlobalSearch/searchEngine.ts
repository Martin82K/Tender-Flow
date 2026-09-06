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
          joinFields(p.location, p.investor, p.address, details?.investor, details?.address, details?.location),
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
  const visibleProjectIds = new Set(projects.map(project => project.id));
  for (const [projectId, details] of Object.entries(projectDetails)) {
    if (!details || !visibleProjectIds.has(projectId)) continue;
    loadedIds.add(projectId);
    const projectTitle = projects.find((p) => p.id === projectId)?.name || details.title || "";
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
    tasks: (sources.tasksEnabled ? sources.tasks ?? [] : []).map(task => ({
      task, haystacks: { primary: normalize(task.title), secondary: normalize(task.note ?? "") },
    })),
    contracts: (sources.contractsEnabled ? sources.contracts ?? [] : [])
      .filter(contract => visibleProjectIds.has(contract.projectId))
      .map(contract => {
        const projectTitle = projects.find(project => project.id === contract.projectId)?.name ?? "";
        return { contract, projectTitle, haystacks: {
          primary: normalize(contract.title),
          secondary: normalize(joinFields(contract.contractNumber, contract.vendorName, projectTitle)),
        } };
      }),
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
  maxPerGroup = MAX_PER_GROUP,
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

  const taskResults: SearchResult[] = [];
  for (const { task, haystacks } of index.tasks) {
    const score = scoreEntity(tokens, [
      { haystack: haystacks.primary, weight: 100 },
      { haystack: haystacks.secondary, weight: 10 },
    ]);
    if (score > 0) taskResults.push({
      id: `task:${task.id}`, title: task.title, category: "tasks", icon: "task_alt",
      navigateTo: { view: "todo", taskId: task.id }, score,
    });
  }
  const contractResults: SearchResult[] = [];
  for (const { contract, projectTitle, haystacks } of index.contracts) {
    const score = scoreEntity(tokens, [
      { haystack: haystacks.primary, weight: 100 },
      { haystack: haystacks.secondary, weight: 10 },
    ]);
    if (score > 0) contractResults.push({
      id: `contract:${contract.id}`, title: contract.title, category: "contracts", icon: "description",
      subtitle: [contract.contractNumber, contract.vendorName, projectTitle].filter(Boolean).join(" · "),
      navigateTo: { view: "project", projectId: contract.projectId, tab: "contracts", contractId: contract.id }, score,
    });
  }

  const sortAndCap = (arr: SearchResult[]) =>
    arr.sort((a, b) => b.score - a.score).slice(0, maxPerGroup);

  const groups: SearchResultGroup[] = [
    { category: "projects", label: "Projekty", totalCount: projectResults.length, items: sortAndCap(projectResults) },
    { category: "contacts", label: "Kontakty", totalCount: contactResults.length, items: sortAndCap(contactResults) },
    { category: "categories", label: "Poptávky", totalCount: categoryResults.length, items: sortAndCap(categoryResults) },
    { category: "tasks", label: "Úkoly", totalCount: taskResults.length, items: sortAndCap(taskResults) },
    { category: "contracts", label: "Smlouvy", totalCount: contractResults.length, items: sortAndCap(contractResults) },
  ];

  return groups.filter((g) => g.items.length > 0);
};

export { MIN_QUERY_LENGTH };
