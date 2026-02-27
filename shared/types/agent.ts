import type { Project, ProjectDetails, Subcontractor, View } from "@/types";

export type AgentMessageRole = "user" | "assistant";
export type AgentReplySource = "skill" | "llm";
export type AgentActionRisk = "read" | "write" | "delete";
export type AgentModelProvider = "openrouter" | "mistral" | "google";
export type AgentAudience = "internal" | "client";
export type AgentContextScope = "project" | "pipeline" | "contacts" | "memory";

export interface AgentModelOption {
  id: string;
  label: string;
  provider: AgentModelProvider;
  capabilities: string[];
  pricingHint?: string;
}

export interface AgentConversationMessage {
  id: string;
  role: AgentMessageRole;
  content: string;
  createdAt: string;
  source?: AgentReplySource;
  skillId?: string;
}

export interface AgentModelSelection {
  provider: AgentModelProvider;
  model: string;
  source: "default" | "override";
}

export interface AgentRuntimeSnapshot {
  pathname: string;
  search: string;
  currentView: View;
  activeProjectTab?: string;
  selectedProjectId: string | null;
  projects: Project[];
  projectDetails: Record<string, ProjectDetails>;
  contacts: Subcontractor[];
  audience: AgentAudience;
  contextScopes: AgentContextScope[];
  contextPolicyVersion: string;
  organizationId?: string | null;
  userId?: string | null;
}

export interface AgentPendingAction {
  id: string;
  title: string;
  summary: string;
  skillId: string;
  risk: AgentActionRisk;
  requiresConfirmation: boolean;
  payload?: Record<string, unknown>;
}

export interface AgentResponse {
  reply: string;
  source: AgentReplySource;
  skillId?: string;
  usedModel?: AgentModelSelection;
  pendingAction?: AgentPendingAction;
  guardTriggered?: boolean;
  guardReason?: string;
}

export interface AgentUiState {
  agentName: "Viki";
  audience: AgentAudience;
  selectedProvider: AgentModelProvider;
  selectedModel: string;
  availableModels: AgentModelOption[];
}
