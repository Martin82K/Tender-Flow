# Viki datové zdroje

## Přehled
Viki kombinuje runtime snapshot z UI, klientskou cache (React Query) a serverové funkce (Supabase Functions). Autoritativní zdroj dat je databáze + storage chráněná authorization/RLS.

## Runtime snapshot (UI vrstva)
Zdroj: `app/AppContent.tsx` + `hooks/useAppData.ts`

`AgentRuntimeSnapshot` obsahuje:
- route context (`pathname`, `search`, `currentView`, `activeProjectTab`)
- aktivní projekt (`selectedProjectId`)
- projektová data (`projects`, `projectDetails`)
- kontakty (`contacts`)
- bezpečnostní a režimové parametry (`audience`, `contextScopes`, `isAdmin`)
- identitu (`organizationId`, `userId`)

## Načítání dat (React Query)
- `hooks/queries/useProjectsQuery.ts`
  - tabulka: `projects`
  - doplňkově RPC: `get_projects_metadata`
- `hooks/queries/useProjectDetailsQuery.ts`
  - tabulky: `projects`, `demand_categories`, `project_contracts`, `project_investor_financials`, `project_amendments`, `bids`
- `hooks/queries/useContactsQuery.ts`
  - tabulka: `subcontractors`

Poznámka: cache je klient-side optimalizace. Zdroj pravdy je serverová DB.

## Serverové funkce pro Viki
- `ai-proxy`
  - fallback chat completion
  - `list-models`
  - `memory-load`
  - `memory-save`
- `ai-agent`
  - OpenAI Responses fallback + tool-calling
  - policy decision (`auto_execute` / `require_confirmation`)
  - trace metadata + audit payload
- `ai-voice/transcribe`
  - přepis hlasové zprávy
- `ai-voice/speak`
  - syntéza hlasové odpovědi

Klientský gateway:
- `services/functionsClient.ts` (`invokeAuthedFunction`)
- autentizace přes access token session

## Projektová paměť
- klient: `app/agent/memoryStore.ts`
- storage bucket: `agent-memory`
- cesta: `org/{organizationId}/projects/{projectId}/viki-memory.md`
- formát: markdown + frontmatter + sekce visibility (`public`/`internal`)

## Manual knowledge
- index: `/user-manual/index.kb.json`
- retrieval vrstva: `app/agent/manualKnowledge.ts`
- pouze pokud je scope `manual`
- ne-admin uživatelům filtruje admin-only sekce

## Client cache vs server autorita
- Client cache:
  - React Query (`projects`, `projectDetails`, `contacts`)
  - lokalně držený runtime snapshot
- Server autorita:
- Supabase tabulky a RPC
- Supabase tabulky a RPC (`ai_agent_usage_events`, `ai_voice_usage_events`, `get_viki_cost_*_admin`)
- Supabase storage pro `viki-memory.md`
- Edge Functions autorizované tokenem

## Pravidlo přístupu pro shrnutí projektu
- Viki smí číst a shrnovat jen projekt, ke kterému má uživatel oprávnění.
- Pro nový `deep-project-briefing` musí být server-side authorization explicitní a auditovatelná.
