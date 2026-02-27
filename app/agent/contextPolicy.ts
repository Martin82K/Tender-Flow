import { buildClientContext, buildInternalContext } from "@app/agent/contextSummary";
import type { AgentRuntimeSnapshot } from "@shared/types/agent";
import type { AgentProjectMemoryDocument } from "@shared/types/agentMemory";

export const AGENT_CONTEXT_POLICY_VERSION = "v1-strict-allowlist";

const CLIENT_BLOCKLIST_PATTERNS: RegExp[] = [
  /\bdenn[ií]\s+p[řr]ehled\b/i,
  /\bintern[íi]\s+pozn[aá]mk/i,
  /\bintern[íi]\s+jedn[aá]n[ií]/i,
  /\bhodnocen[íi]\s+dodavatel/i,
  /\bmar[žz]e\b/i,
  /\bintern[íi]\s+rozpo[čc]t/i,
];

const CLIENT_POLICY_RULES = [
  "Jsi Viki v režimu klientského výstupu.",
  "Používej pouze CLIENT SAFE KONTEXT (strict allowlist).",
  "Nikdy nesděluj interní denní přehled, interní poznámky, interní finanční rozpad ani interní hodnocení dodavatelů.",
  "Pokud dotaz míří na interní data, odpověz: 'Tuto informaci v klientském režimu nemohu sdílet.'",
];

const INTERNAL_POLICY_RULES = [
  "Jsi interní AI asistentka Viki pro aplikaci Tender Flow.",
  "Odpovídej česky, stručně, prakticky a s důrazem na stavební CRM kontext.",
  "Nevymýšlej neexistující data, pokud něco chybí, napiš to napřímo.",
];

interface BuildPromptArgs {
  runtime: AgentRuntimeSnapshot;
  memory: AgentProjectMemoryDocument | null;
}

export const buildSystemPrompt = ({ runtime, memory }: BuildPromptArgs): string => {
  const context =
    runtime.audience === "client"
      ? buildClientContext({ runtime, memory })
      : buildInternalContext({ runtime, memory });

  const rules = runtime.audience === "client" ? CLIENT_POLICY_RULES : INTERNAL_POLICY_RULES;

  return [
    ...rules,
    `Context policy version: ${runtime.contextPolicyVersion || AGENT_CONTEXT_POLICY_VERSION}`,
    `Audience: ${runtime.audience}`,
    `Aktivní scopes: ${runtime.contextScopes.join(", ") || "none"}`,
    "KONTEKST APLIKACE:",
    context,
  ].join("\n\n");
};

export const guardClientFacingOutput = (
  text: string,
): { text: string; blocked: boolean; reason?: string } => {
  const clean = text.trim();
  if (!clean) {
    return {
      text: "Nemám dost podkladů pro klientskou odpověď.",
      blocked: true,
      reason: "empty_output",
    };
  }

  const blockedPattern = CLIENT_BLOCKLIST_PATTERNS.find((pattern) => pattern.test(clean));
  if (blockedPattern) {
    return {
      text: "Tuto informaci v klientském režimu nemohu sdílet.",
      blocked: true,
      reason: "blocklist_match",
    };
  }

  return {
    text: clean,
    blocked: false,
  };
};
