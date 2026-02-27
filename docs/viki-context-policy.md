# Viki Kontext Policy (internal/client)

## Cíl
- Oddělit interní a klientský kontext.
- Zabránit úniku interních informací v klientském režimu.
- Kombinovat runtime snapshot + per-stavba MD paměť.

## Implementace
- Typy:
  - `shared/types/agent.ts`
  - `shared/types/agentMemory.ts`
- Context builder:
  - `app/agent/contextSummary.ts`
  - `app/agent/contextPolicy.ts`
- Orchestrace + guard:
  - `app/agent/orchestrator.ts`
  - `app/agent/llmGateway.ts`
- UI ovládání:
  - `shared/ui/agent/AgentFloatingPanel.tsx`
  - `app/agent/useAgentController.ts`
- Storage paměti:
  - `app/agent/memoryStore.ts` (client gateway)
  - `supabase/functions/ai-proxy/index.ts` (`memory-load`, `memory-save`)

## Jak to funguje
1. Viki drží stav `audience` (`internal` / `client`) a `contextScopes`.
2. Před LLM voláním se sestaví systémový prompt podle policy verze `v1-strict-allowlist`.
3. Pokud je zapnut scope `memory`, načte se `viki-memory.md` z private bucketu `agent-memory`.
4. V `client` režimu jde do promptu jen allowlist + `public` sekce paměti.
5. Po vygenerování odpovědi běží output guard; při kolizi vrací bezpečnou hlášku.

## Formát paměti
- Cesta: `org/{organizationId}/projects/{projectId}/viki-memory.md`
- Frontmatter:
  - `project_id`
  - `updated_at`
  - `updated_by`
  - `version`
  - `sections_visibility` (JSON map)
- Sekce:
  - `## Fakta (ověřená)`
  - `## Otevřené body`
  - `## Rozhodnutí`
  - `## Rizika`
  - `## Klientsky publikovatelné shrnutí`

## Telemetrie
- `audience_switched`
- `context_policy_applied`
- `output_guard_triggered`

## Rozšíření / škálování
1. Přidat server-side audit tabulku pro policy zásahy (`audience`, `scope`, `guard_reason`).
2. Přidat granularitu scope per feature (např. `finance`, `contracts`) místo obecných skupin.
3. Přidat policy profil per tenant (strict/standard/custom allowlist).
4. Přidat kontrolovaný write-back do paměti přes schvalované skill akce.
