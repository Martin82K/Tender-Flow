import type { AgentSkill } from "@features/agent/skills/types";
import { budgetAnomalySkill } from "@features/agent/skills/budgetAnomalySkill";
import { deepProjectBriefingSkill } from "@features/agent/skills/deepProjectBriefingSkill";
import { emailDraftSkill } from "@features/agent/skills/emailDraftSkill";
import { projectBriefingSkill } from "@features/agent/skills/projectBriefingSkill";
import { tenderSummarySkill } from "@features/agent/skills/tenderSummarySkill";

export const agentSkillRegistry: AgentSkill[] = [
  deepProjectBriefingSkill,
  projectBriefingSkill,
  tenderSummarySkill,
  budgetAnomalySkill,
  emailDraftSkill,
];

export type { AgentSkill, AgentSkillInput, AgentSkillManifest, AgentSkillResult } from "@features/agent/skills/types";
