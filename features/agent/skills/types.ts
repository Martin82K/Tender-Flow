import type {
  AgentConversationMessage,
  AgentPendingAction,
  AgentRuntimeSnapshot,
} from "@shared/types/agent";

export interface AgentSkillInput {
  userMessage: string;
  runtime: AgentRuntimeSnapshot;
  conversation: AgentConversationMessage[];
}

export interface AgentSkillManifest {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  risk: "read" | "write" | "delete";
  requiresProject?: boolean;
}

export interface AgentSkillResult {
  reply: string;
  pendingAction?: AgentPendingAction;
}

export interface AgentSkill {
  manifest: AgentSkillManifest;
  match: (input: AgentSkillInput) => number;
  run: (input: AgentSkillInput) => Promise<AgentSkillResult> | AgentSkillResult;
}
