import { invokeAuthedFunction } from "@/services/functionsClient";
import type {
  AgentMemorySectionVisibility,
  AgentProjectMemoryDocument,
  AgentProjectMemoryMeta,
} from "@shared/types/agentMemory";

const MEMORY_BUCKET = "agent-memory";

const DEFAULT_SECTIONS: Array<{ title: string; visibility: AgentMemorySectionVisibility }> = [
  { title: "Fakta (ověřená)", visibility: "internal" },
  { title: "Otevřené body", visibility: "internal" },
  { title: "Rozhodnutí", visibility: "internal" },
  { title: "Rizika", visibility: "internal" },
  { title: "Klientsky publikovatelné shrnutí", visibility: "public" },
];

export interface AgentMemoryAppendEntry {
  sectionTitle: string;
  content: string;
  visibility?: AgentMemorySectionVisibility;
}

const createDefaultMemoryDocument = (
  projectId: string,
  userId: string,
): AgentProjectMemoryDocument => ({
  meta: {
    projectId,
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
    version: 1,
    sectionsVisibility: DEFAULT_SECTIONS.reduce((acc, section) => {
      acc[section.title] = section.visibility;
      return acc;
    }, {} as Record<string, AgentMemorySectionVisibility>),
  },
  sections: DEFAULT_SECTIONS.map((section) => ({
    title: section.title,
    visibility: section.visibility,
    content: "",
  })),
});

interface MemoryLoadResponse {
  document?: AgentProjectMemoryDocument | null;
}

interface MemorySaveResponse {
  document?: AgentProjectMemoryDocument;
}

export const loadProjectMemory = async (
  projectId: string,
): Promise<AgentProjectMemoryDocument | null> => {
  if (!projectId.trim()) return null;

  try {
    const response = await invokeAuthedFunction<MemoryLoadResponse>("ai-proxy", {
      body: {
        action: "memory-load",
        projectId,
        bucket: MEMORY_BUCKET,
      },
    });

    return response.document || null;
  } catch {
    return null;
  }
};

export const saveProjectMemory = async (
  projectId: string,
  document: AgentProjectMemoryDocument,
): Promise<AgentProjectMemoryDocument> => {
  const response = await invokeAuthedFunction<MemorySaveResponse>("ai-proxy", {
    body: {
      action: "memory-save",
      projectId,
      bucket: MEMORY_BUCKET,
      document,
    },
  });

  if (!response.document) {
    throw new Error("Nepodařilo se uložit paměť stavby.");
  }

  return response.document;
};

export const appendProjectMemoryEntry = async (
  projectId: string,
  entry: AgentMemoryAppendEntry,
): Promise<AgentProjectMemoryDocument> => {
  const existing = await loadProjectMemory(projectId);
  const userId = "system";
  const base = existing || createDefaultMemoryDocument(projectId, userId);

  const nextSections = [...base.sections];
  const sectionIndex = nextSections.findIndex((section) => section.title === entry.sectionTitle);

  if (sectionIndex >= 0) {
    const current = nextSections[sectionIndex];
    const merged = [current.content.trim(), entry.content.trim()].filter(Boolean).join("\n\n");
    nextSections[sectionIndex] = {
      ...current,
      content: merged,
      visibility: entry.visibility || current.visibility,
    };
  } else {
    nextSections.push({
      title: entry.sectionTitle,
      content: entry.content.trim(),
      visibility: entry.visibility || "internal",
    });
  }

  const nextMeta: AgentProjectMemoryMeta = {
    ...base.meta,
    version: base.meta.version + 1,
    sectionsVisibility: nextSections.reduce((acc, section) => {
      acc[section.title] = section.visibility;
      return acc;
    }, {} as Record<string, AgentMemorySectionVisibility>),
  };

  return saveProjectMemory(projectId, {
    meta: nextMeta,
    sections: nextSections,
  });
};
