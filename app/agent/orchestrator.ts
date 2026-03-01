import { agentSkillRegistry } from "@features/agent/skills";
import type {
  AgentConversationMessage,
  AgentModelSelection,
  AgentResponse,
  AgentRuntimeSnapshot,
} from "@shared/types/agent";
import { sendAgentFallbackMessage, type AgentFallbackResponse } from "@app/agent/llmGateway";
import {
  guardClientFacingOutput,
  guardRoleRestrictedOutput,
  guardSensitiveOutput,
} from "@app/agent/contextPolicy";

const SKILL_MATCH_THRESHOLD = 0.45;

interface OrchestrateAgentReplyArgs {
  userMessage: string;
  runtime: AgentRuntimeSnapshot;
  conversation: AgentConversationMessage[];
  modelSelection?: AgentModelSelection | null;
}

interface AgentOrchestratorDependencies {
  runFallback: (args: {
    runtime: AgentRuntimeSnapshot;
    conversation: AgentConversationMessage[];
    modelSelection?: AgentModelSelection | null;
  }) => Promise<AgentFallbackResponse>;
}

const defaultDependencies: AgentOrchestratorDependencies = {
  runFallback: sendAgentFallbackMessage,
};

export const orchestrateAgentReply = async (
  args: OrchestrateAgentReplyArgs,
  dependencies: AgentOrchestratorDependencies = defaultDependencies,
): Promise<AgentResponse> => {
  const applyOutputGuard = (
    reply: string,
  ): { reply: string; guardTriggered: boolean; guardReason?: string } => {
    const sensitiveGuarded = guardSensitiveOutput(reply);
    if (sensitiveGuarded.blocked) {
      return {
        reply: sensitiveGuarded.text,
        guardTriggered: true,
        guardReason: sensitiveGuarded.reason,
      };
    }

    const roleGuarded = guardRoleRestrictedOutput(reply, args.runtime);
    if (roleGuarded.blocked) {
      return {
        reply: roleGuarded.text,
        guardTriggered: true,
        guardReason: roleGuarded.reason,
      };
    }

    if (args.runtime.audience !== "client") {
      return { reply, guardTriggered: false };
    }

    const guarded = guardClientFacingOutput(reply);
    return {
      reply: guarded.text,
      guardTriggered: guarded.blocked,
      guardReason: guarded.reason,
    };
  };

  const rankedSkills = agentSkillRegistry
    .map((skill) => ({
      skill,
      score: skill.match({
        userMessage: args.userMessage,
        runtime: args.runtime,
        conversation: args.conversation,
      }),
    }))
    .sort((a, b) => b.score - a.score);

  const bestSkill = rankedSkills[0];

  if (bestSkill && bestSkill.score >= SKILL_MATCH_THRESHOLD) {
    const result = await bestSkill.skill.run({
      userMessage: args.userMessage,
      runtime: args.runtime,
      conversation: args.conversation,
    });
    const guarded = applyOutputGuard(result.reply);

    return {
      reply: guarded.reply,
      source: "skill",
      skillId: bestSkill.skill.manifest.id,
      pendingAction: result.pendingAction,
      guardTriggered: guarded.guardTriggered,
      guardReason: guarded.guardReason,
    };
  }

  const fallback = await dependencies.runFallback({
    runtime: args.runtime,
    conversation: args.conversation,
    modelSelection: args.modelSelection,
  });
  const guarded = applyOutputGuard(fallback.text);

  return {
    reply: guarded.reply,
    source: fallback.source || "llm",
    usedModel: fallback.usedModel,
    pendingAction: fallback.pendingAction,
    toolExecutions: fallback.toolExecutions,
    traceId: fallback.traceId,
    guard: fallback.guard,
    guardTriggered: guarded.guardTriggered,
    guardReason: guarded.guardReason,
    manualContextUsed: fallback.manualContextUsed,
    manualNoMatch: fallback.manualNoMatch,
    manualCitations: fallback.manualCitations,
    manualCitationEmitted: fallback.manualCitationEmitted,
  };
};
