import type { Project, ProjectDetails, DemandCategory, Subcontractor } from "@/types";

export type SearchCategory = "projects" | "contacts" | "categories" | "tasks" | "contracts";

export interface SearchNavigateTarget {
  view: "project" | "contacts" | "project-management" | "project-overview" | "todo";
  projectId?: string;
  tab?: "overview" | "tender-plan" | "pipeline" | "schedule" | "documents" | "contracts";
  categoryId?: string;
  taskId?: string;
  contractId?: string;
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
  totalCount?: number;
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

export interface SearchTask {
  id: string;
  title: string;
  note?: string;
}

export interface SearchContract {
  id: string;
  projectId: string;
  title: string;
  contractNumber?: string;
  vendorName?: string;
}

export interface SearchIndex {
  tasks: { task: SearchTask; haystacks: { primary: string; secondary: string } }[];
  contracts: { contract: SearchContract; projectTitle: string; haystacks: { primary: string; secondary: string } }[];
  projects: ProjectIndexEntry[];
  contacts: ContactIndexEntry[];
  categories: CategoryIndexEntry[];
  /** Total number of projects (for "searched N of M" hint) */
  totalProjectCount: number;
  /** Number of projects whose details are loaded into the categories index */
  loadedProjectDetailsCount: number;
}

export type ProjectSearchSummary = Pick<ProjectDetails, "title" | "investor" | "address" | "location"> & {
  categories: Pick<DemandCategory, "id" | "title" | "description" | "workItems">[];
};

export interface SearchInputSources {
  projects: Project[];
  contacts: Subcontractor[];
  projectDetails: Record<string, ProjectSearchSummary>;
  tasks?: SearchTask[];
  contracts?: SearchContract[];
  tasksEnabled?: boolean;
  contractsEnabled?: boolean;
  isExtendedSearchLoading?: boolean;
  extendedSearchError?: boolean;
  retryExtendedSearch?: () => void;
  requestSearch?: () => void;
  isProjectSearchLoading?: boolean;
  projectSearchError?: boolean;
  retryProjectSearch?: () => void;
}
