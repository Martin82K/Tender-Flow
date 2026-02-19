# Modularity Audit Baseline (2026-02-18)

## Rozsah
- Web: `app/`, `features/`, `shared/`, `components/`, `hooks/`, `context/`, `services/`, `utils/`, `infra/`
- Desktop: `desktop/main/*`
- Bez změn DB migrací a Supabase edge funkcí.

## Baseline metriky
- Přímé importy `supabase` v UI vrstvách: **14**
- Importy `features/* -> components/*`: **30**
- Soubory nad 800 LoC (web + desktop): **16**
- Aktivní listenery `onAuthStateChange(...)`: **1** (po centralizaci přes `AuthSessionStore`)

## Top rizikové soubory (LoC)
- `components/Pipeline.tsx`: 2452
- `components/ProjectOverviewNew.tsx`: 1896
- `services/exportService.ts`: 1220
- `features/settings/ExcelIndexerSettings.tsx`: 1196
- `components/ProjectSchedule.tsx`: 1014
- `hooks/useDocHubIntegration.ts`: 1012
- `features/projects/ProjectOverview.tsx`: 948
- `components/TenderPlan.tsx`: 936
- `features/settings/SubscriptionSettings.tsx`: 921
- `desktop/main/ipc/handlers.ts`: 818

## Cílové metriky
- Přímé DB volání v UI: **0**
- Závislosti `features -> legacy components`: **0**
- Auth listener: **1 centrální source of truth**
- Klíčové moduly > 600 LoC: **0**

## Nové guardraily
- Rozšířený `check:boundaries` skenuje i legacy vrstvy a `infra`.
- Nová pravidla:
  - `ui-direct-supabase-import`
  - `features-to-components`
  - `renderer-bypass-platform-adapter`
- Přechodový dluh je explicitně veden v `config/architecture-boundary-allowlist.json`.

## Poznámka k debt ledgeru
- Allowlist je přechodový mechanismus pro existující porušení.
- Každý odstraněný záznam musí být z allowlistu vymazán ve stejném PR.
