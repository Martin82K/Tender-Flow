import type { Project, ProjectDetails, Subcontractor } from "@/types";

export type SearchCategory = "projects" | "contacts" | "categories";

export interface SearchNavigateTarget {
  view: "command-center" | "project" | "contacts" | "project-management" | "project-overview";
  projectId?: string;
  tab?: "overview" | "tender-plan" | "pipeline" | "schedule" | "documents" | "contracts";
  categoryId?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  category: SearchCategory;
  icon: string; // material-symbols name
  navigateTo: SearchNavigateTarget;
  score: number;
}

export interface SearchResultGroup {
  category: SearchCategory;
  label: string;
  items: SearchResult[];
}

interface ProjectIndexEntry {
  project: Project;
  haystacks: { primary: string; secondary: string };
}

interface ContactIndexEntry {
  contact: Subcontractor;
  haystacks: { primary: string; secondary: string; tertiary: string };
}

interface CategoryIndexEntry {
  projectId: string;
  projectTitle: string;
  categoryId: string;
  categoryTitle: string;
  categoryDescription: string;
  haystacks: { primary: string; secondary: string };
}

export interface SearchIndex {
  projects: ProjectIndexEntry[];
  contacts: ContactIndexEntry[];
  categories: CategoryIndexEntry[];
  /** Total number of projects (for "searched N of M" hint) */
  totalProjectCount: number;
  /** Number of projects whose details are loaded into the categories index */
  loadedProjectDetailsCount: number;
}

export interface SearchInputSources {
  projects: Project[];
  contacts: Subcontractor[];
  projectDetails: Record<string, ProjectDetails>;
}
