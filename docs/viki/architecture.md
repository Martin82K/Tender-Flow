# Viki architektura

## End-to-end tok
1. UI vytvoří runtime snapshot v `app/AppContent.tsx` a předá ho do `AgentFloatingPanel`.
2. `shared/ui/agent/AgentFloatingPanel.tsx` obsluhuje chat input, settings a hlasové ovládání.
3. `app/agent/useAgentController.ts` drží stav konverzace, model, audience, context scopes a voice režimy.
4. `sendUserMessage()` volá `app/agent/orchestrator.ts`.
5. Orchestrátor vybere nejlepší skill z registry `features/agent/skills/index.ts`.
6. Pokud žádný skill nepřekročí threshold, běží fallback přes `app/agent/llmGateway.ts`.
7. Výstup jde přes guard chain (`guardSensitiveOutput` -> `guardRoleRestrictedOutput` -> `guardClientFacingOutput`).
8. Odpověď se vrátí do UI a volitelně se přehraje hlasem (`playVoiceReply`).
9. Spotřeba tokenů a odhad ceny se zapisují do `ai_agent_usage_events` pro admin metriky.

## Klíčové soubory
- `app/AppContent.tsx`: sestavení `AgentRuntimeSnapshot`.
- `shared/ui/agent/AgentFloatingPanel.tsx`: chat panel a ovládací prvky.
- `app/agent/useAgentController.ts`: řídicí vrstva Viki.
- `app/agent/orchestrator.ts`: skill routing + fallback + output guard.
- `features/agent/skills/*`: doménové skilly.
- `app/agent/llmGateway.ts`: fallback volání `ai-agent` + manual context + memory context.
- `supabase/functions/ai-agent/index.ts`: OpenAI Responses API orchestrace + server-side tool policy.
- `features/settings/VikiCostControl.tsx`: admin dashboard spotřeby tokenů/cost.
- `app/agent/contextPolicy.ts`: policy prompty a guardy.
- `app/agent/contextSummary.ts`: runtime context builder pro internal/client režim.
- `app/agent/manualKnowledge.ts`: retrieval z user manual indexu a citace.
- `app/agent/memoryStore.ts`: load/save projektové paměti.

## Důležité kontrakty
- `AgentRuntimeSnapshot` (`shared/types/agent.ts`): vstupní kontext Viki.
- Skill kontrakt (`features/agent/skills/types.ts`): `manifest`, `match`, `run`, `pendingAction`.
- `AgentResponse` (`shared/types/agent.ts`): standardizovaný výstup orchestrace.
- `AgentProjectMemoryDocument` (`shared/types/agentMemory.ts`): formát projektové paměti.

## Aktuální fallback logika
- Skill threshold: `0.45` (`app/agent/orchestrator.ts`).
- Pokud skill nevyhraje, fallback používá model selection (`default` nebo `override`) a systémový prompt z context policy.
- Fallback může přidat manual context, memory context, tool metadata (`toolExecutions`) a trace ID.

## Poznámka k plánovanému skillu
- Nový skill `deep-project-briefing` je plánovaný jako detailní varianta pro uživatelský label `Shrnutí projektu`.
- Musí respektovat pravidlo: pouze aktivní projekt dostupný danému uživateli.
