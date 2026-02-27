export type AgentMemorySectionVisibility = "public" | "internal";

export interface AgentProjectMemoryMeta {
  projectId: string;
  updatedAt: string;
  updatedBy: string;
  version: number;
  sectionsVisibility: Partial<Record<string, AgentMemorySectionVisibility>>;
}

export interface AgentProjectMemorySection {
  title: string;
  visibility: AgentMemorySectionVisibility;
  content: string;
}

export interface AgentProjectMemoryDocument {
  meta: AgentProjectMemoryMeta;
  sections: AgentProjectMemorySection[];
}
