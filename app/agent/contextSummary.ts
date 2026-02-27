import type { AgentRuntimeSnapshot } from "@shared/types/agent";
import type { AgentProjectMemoryDocument } from "@shared/types/agentMemory";

const buildMemoryContext = (
  memory: AgentProjectMemoryDocument | null,
  audience: "internal" | "client",
): string => {
  if (!memory) return "Paměť stavby: není k dispozici.";

  const visibleSections = memory.sections.filter((section) =>
    audience === "internal" ? true : section.visibility === "public",
  );

  if (visibleSections.length === 0) {
    return "Paměť stavby: dostupná, ale bez sekcí pro tento režim.";
  }

  const blocks = visibleSections.map((section) => {
    const content = section.content.trim() || "Bez záznamu.";
    return `### ${section.title}\n${content}`;
  });

  return ["Paměť stavby (MD):", ...blocks].join("\n\n");
};

const buildProjectClientAllowlist = (runtime: AgentRuntimeSnapshot): string[] => {
  const activeProject = runtime.selectedProjectId
    ? runtime.projects.find((item) => item.id === runtime.selectedProjectId)
    : null;
  const activeProjectDetails = runtime.selectedProjectId
    ? runtime.projectDetails[runtime.selectedProjectId]
    : null;

  const categories = activeProjectDetails?.categories || [];
  const categoriesPreview = categories
    .slice(0, 8)
    .map((item) => `- ${item.title} · stav: ${item.status}${item.deadline ? ` · termín: ${item.deadline}` : ""}`)
    .join("\n");

  return [
    `Aktivní projekt: ${activeProject?.name || "žádný"}`,
    `Lokalita: ${activeProjectDetails?.location || activeProject?.location || "neuvedeno"}`,
    `Termín dokončení: ${activeProjectDetails?.finishDate || "neuvedeno"}`,
    `Počet kategorií: ${categories.length}`,
    "Kategorie (allowlist):",
    categoriesPreview || "- Bez kategorií",
    `Kontakty (allowlist): pouze počet = ${runtime.contacts.length}`,
  ];
};

const buildProjectInternalContext = (runtime: AgentRuntimeSnapshot): string[] => {
  const activeProject = runtime.selectedProjectId
    ? runtime.projects.find((item) => item.id === runtime.selectedProjectId)
    : null;
  const activeProjectDetails = runtime.selectedProjectId
    ? runtime.projectDetails[runtime.selectedProjectId]
    : null;

  const categoriesCount = activeProjectDetails?.categories?.length ?? 0;
  const openCategoriesCount =
    activeProjectDetails?.categories?.filter(
      (item) => item.status === "open" || item.status === "negotiating",
    ).length ?? 0;
  const totalPlannedCost = activeProjectDetails?.plannedCost ?? 0;

  return [
    `Route: ${runtime.pathname}${runtime.search}`,
    `Aktuální view: ${runtime.currentView}`,
    `Aktivní tab projektu: ${runtime.activeProjectTab || "neuvedeno"}`,
    `Počet projektů: ${runtime.projects.length}`,
    `Počet kontaktů: ${runtime.contacts.length}`,
    `Aktivní projekt: ${activeProject?.name || "žádný"}`,
    `Kategorie v aktivním projektu: ${categoriesCount}`,
    `Otevřené kategorie: ${openCategoriesCount}`,
    `Plánovaný náklad projektu: ${totalPlannedCost}`,
  ];
};

interface BuildContextArgs {
  runtime: AgentRuntimeSnapshot;
  memory: AgentProjectMemoryDocument | null;
}

export const buildInternalContext = ({ runtime, memory }: BuildContextArgs): string => {
  const blocks: string[] = [];

  if (runtime.contextScopes.includes("project") || runtime.contextScopes.includes("pipeline")) {
    blocks.push(buildProjectInternalContext(runtime).join("\n"));
  }

  if (runtime.contextScopes.includes("memory")) {
    blocks.push(buildMemoryContext(memory, "internal"));
  }

  if (blocks.length === 0) {
    blocks.push("Bez explicitně zvoleného scope. Pracuj pouze s obecným dotazem.");
  }

  return blocks.join("\n\n");
};

export const buildClientContext = ({ runtime, memory }: BuildContextArgs): string => {
  const blocks: string[] = [];

  if (runtime.contextScopes.includes("project") || runtime.contextScopes.includes("pipeline")) {
    blocks.push(["CLIENT SAFE KONTEXT (strict allowlist):", ...buildProjectClientAllowlist(runtime)].join("\n"));
  }

  if (runtime.contextScopes.includes("memory")) {
    blocks.push(buildMemoryContext(memory, "client"));
  }

  if (blocks.length === 0) {
    blocks.push("CLIENT SAFE KONTEXT: Bez explicitně zvoleného scope.");
  }

  return blocks.join("\n\n");
};
