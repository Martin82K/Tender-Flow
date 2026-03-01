import type { Project, ProjectDetails, Subcontractor, View } from "@/types";

export type AgentMessageRole = "user" | "assistant";
export type AgentReplySource = "skill" | "llm" | "tool";
export type AgentActionRisk = "read" | "write" | "delete";
export type AgentModelProvider = "openrouter" | "mistral" | "google" | "openai";
export type AgentAudience = "internal" | "client";
export type AgentContextScope = "project" | "pipeline" | "contacts" | "memory" | "manual";
export type AgentPolicyDecision = "auto_execute" | "require_confirmation" | "denied";

export interface AgentManualCitation {
  sectionTitle: string;
  anchor: string;
  confidence: number;
}

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
  isAdmin?: boolean;
  sessionRiskLevel?: "low" | "elevated";
}

export interface AgentPendingAction {
  id: string;
  title: string;
  summary: string;
  skillId: string;
  risk: AgentActionRisk;
  requiresConfirmation: boolean;
  policyDecision?: AgentPolicyDecision;
  idempotencyKey?: string;
  payload?: Record<string, unknown>;
}

export interface AgentToolExecution {
  tool: string;
  status: "ok" | "denied" | "error";
  reason?: string;
}

export interface AgentGuardInfo {
  triggered: boolean;
  reason?: string;
}

export interface AgentResponse {
  reply: string;
  source: AgentReplySource;
  skillId?: string;
  usedModel?: AgentModelSelection;
  pendingAction?: AgentPendingAction;
  toolExecutions?: AgentToolExecution[];
  traceId?: string;
  guard?: AgentGuardInfo;
  guardTriggered?: boolean;
  guardReason?: string;
  manualContextUsed?: boolean;
  manualNoMatch?: boolean;
  manualCitations?: AgentManualCitation[];
  manualCitationEmitted?: boolean;
}

export interface AgentUiState {
  agentName: "Viki";
  audience: AgentAudience;
  selectedProvider: AgentModelProvider;
  selectedModel: string;
  availableModels: AgentModelOption[];
}
