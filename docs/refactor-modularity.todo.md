# Refaktor Modularity TODO

Poslední aktualizace: 2026-02-18

## 1) Audit a baseline
- [x] Vytvořit audit report `docs/audits/modularity-audit-2026-02-18.md`
- [x] Zafixovat baseline metriky (supabase v UI, features->components, LoC > 800, auth listenery)
- [x] Definovat cílové metriky

## 2) Guardraily architektury
- [x] Rozšířit `scripts/check-boundaries.mjs` na `components/hooks/context/services/utils/infra`
- [x] Přidat pravidla `ui-direct-supabase-import`, `features-to-components`, `renderer-bypass-platform-adapter`
- [x] Zavést debt ledger `config/architecture-boundary-allowlist.json`
- [x] Napojit guardraily do testu `tests/architecture.boundaries.test.ts`
- [x] Odstranit veškeré `ui-direct-supabase-import` nálezy (UI/Hooks/Context už neimportují `services/supabase` přímo)
- [x] Odstranit renderer bypass v `components/Pipeline.tsx` (desktop detekce už přes `platformAdapter`)

## 3) Feature lifecycle struktura
- [x] Přidat `FeatureModuleManifest` kontrakt (`app/featureRegistry/types.ts`)
- [x] Vytvořit registry-driven manifesty (`app/featureRegistry/manifests.ts`)
- [x] Přepnout lazy loading na registry (`app/views/LazyViews.tsx`)
- [x] Přidat základní `ui/model/api/index.ts` strukturu pro feature moduly

## 4) Auth + subscription centralizace
- [x] Zavést `AuthSessionStore` (`infra/auth/authSessionStore.ts`)
- [x] Přepnout `AuthContext` na odběr ze store (1 listener source of truth)
- [x] Přepnout `useDesktopMcpTokenSync` na odběr ze store (bez vlastního listeneru)
- [x] Přesunout stuck-loading session cleanup do `infra/auth` (`stuckLoadingRecovery.ts`)
- [x] Přidat subscription domain API (`features/subscription/api/*`, `model/*`)
- [x] Přepnout `FeatureContext` na subscription domain API
- [x] Přepnout `SubscriptionSettings` na subscription domain wrappery

## 5) Rozdělení nejrizikovějších UI modulů
- [x] `components/Pipeline.tsx` rozpad na container/hook/use-case
- [x] `components/Pipeline.tsx` přesun přímých DB volání do `features/projects/api` + `infra/projects`
- [x] `components/Pipeline.tsx` přesun helper/use-case logiky do `features/projects/model/pipelineModel.ts` + odstranění dead create/edit handlerů
- [x] `components/Pipeline.tsx` přesun email use-case helperů (losers flow) do `features/projects/model/pipelineEmailModel.ts`
- [x] `components/Pipeline.tsx` přesun bids state sync/notifikace do `features/projects/model/usePipelineBidsState.ts`
- [x] `components/Pipeline.tsx` přesun category navigation + bid comparison state do `features/projects/model/usePipelineCategoryNavigation.ts`
- [x] `components/Pipeline.tsx` přesun DocHub fallback orchestrace do `features/projects/model/usePipelineDocHubFallback.ts`
- [x] `components/Pipeline.tsx` přesun category create/edit form state + handlery do `features/projects/model/usePipelineCategoryForms.ts`
- [x] `components/Pipeline.tsx` přesun contact modal/save/update flow do `features/projects/model/usePipelineContactsController.ts`
- [x] `components/Pipeline.tsx` přesun subcontractor modal + add flow do `features/projects/model/usePipelineSubcontractorSelection.ts`
- [x] `components/Pipeline.tsx` přesun bid mutací (drop/toggle/save/delete) do `features/projects/model/usePipelineBidActions.ts`
- [x] `components/Pipeline.tsx` přesun inquiry/export/email flow do `features/projects/model/usePipelineCommunicationActions.ts`
- [x] `components/Pipeline.tsx` přesun DocHub open/copy/backend orchestrace do `features/projects/model/usePipelineDocHubActions.ts`
- [x] `components/ProjectSchedule.tsx` rozpad na container/hook/use-case
- [x] `components/ProjectSchedule.tsx` přesun přímých DB volání do `features/projects/api` + `infra/projects`
- [x] `components/ProjectSchedule.tsx` přesun timeline/date helperů do `features/projects/model/projectScheduleModel.ts`
- [x] `components/ProjectSchedule.tsx` přesun state/effect/controller vrstvy do `features/projects/model/useProjectScheduleController.ts`
- [x] `components/TenderPlan.tsx` rozpad na container/hook/use-case
- [x] `components/TenderPlan.tsx` přesun přímých DB volání do `features/projects/api` + `infra/projects`
- [x] `components/TenderPlan.tsx` přesun status/filter/import helperů do `features/projects/model/tenderPlanModel.ts`
- [x] `components/TenderPlan.tsx` přesun state/effect/controller vrstvy do `features/projects/model/useTenderPlanController.ts`
- [x] `components/ProjectOverviewNew.tsx` rozpad na container/hook/use-case
- [x] `components/ProjectOverviewNew.tsx` přesun helper/business výpočtů do `features/projects/model/projectOverviewNewModel.ts` (finance + demand table use-case)
- [x] `components/ProjectOverviewNew.tsx` přesun controller stavu + handlerů do `features/projects/model/useProjectOverviewNewController.ts` (edit state, localStorage columns, demand totals)
- [x] `features/projects/ProjectOverview.tsx` rozpad na container/hook/use-case
- [x] `features/projects/ProjectOverview.tsx` přesun analytické logiky do `features/projects/model/projectOverviewModel.ts` + oddělení `OverviewSection` do `features/projects/ui/OverviewSection.tsx`
- [x] `features/projects/ProjectOverview.tsx` přesun container logiky do `features/projects/model/useProjectOverviewController.ts`

## 6) Desktop IPC modularizace
- [x] Rozdělit IPC registry na doménové moduly:
- [x] `desktop/main/ipc/modules/fsHandlers.ts`
- [x] `desktop/main/ipc/modules/watcherHandlers.ts`
- [x] `desktop/main/ipc/modules/sessionHandlers.ts`
- [x] `desktop/main/ipc/modules/oauthHandlers.ts`
- [x] `desktop/main/ipc/modules/mcpHandlers.ts`
- [x] `desktop/main/ipc/modules/netHandlers.ts`
- [x] `desktop/main/ipc/modules/bidComparisonHandlers.ts`
- [x] Přepnout `desktop/main/ipc/handlers.ts` na orchestrace modulů
- [x] Přidat centralizovaný IPC kontrakt map (`desktop/main/ipc/contracts.ts`)

## 7) Konsolidace legacy vrstvy
- [x] Přesměrovat view vrstvu z legacy `components/*` na čisté feature entrypointy
- [x] Zavést compatibility shimy s datem odstranění
- [x] Založit migration ledger `docs/refactor-migration-ledger.md`
- [x] Odstranit coupling `features/settings/* -> components/*` (settings feature už používá vlastní/`shared` moduly)
- [x] Odstranit coupling `features/projects/*` + `features/contacts/* -> components/*` (0 přímých importů)

## 8) Verifikace a release gate
- [x] Rozšířit CI quality gate o smoke build web + desktop compile
- [x] Aktualizovat `docs/architecture.md` o pravidla add/remove feature safely
- [x] Přidat test `tests/authSessionStore.test.ts`
- [x] Opravit `tests/portablePathResolver.test.ts` (platform-agnostic resolver pro win cesty)
- [x] Dovést `npm run test:run` do stabilně končícího stavu bez visících handle (fix `FeatureContext.demo` test loop; full suite končí)

## Průběžný snapshot (2026-02-18 23:22)
- Přímé `supabase` importy v UI (`app/features/shared/components/hooks/context`): `0`
- `renderer-bypass-platform-adapter` dluh: `0`
- `features-to-components` dluh: `0`
- `architecture-boundary-allowlist.json` položek: `16`
- `check:boundaries`: `OK` (nalezeno `34`, nevyřešených `0`, sken souborů `293`)
- `components/Pipeline.tsx` LoC: `2410 -> 888`
- `components/ProjectSchedule.tsx` LoC: `997 -> 495`
- `components/TenderPlan.tsx` LoC: `842 -> 456`
- `components/ProjectOverviewNew.tsx` LoC: `1766 -> 1579`
- `features/projects/ProjectOverview.tsx` LoC: `668`
- `npm run test:run`: `OK` (`48` test files, `174` tests, bez viseni procesu)
- Poslední dokončený řez: `Pipeline` DocHub actions split (`usePipelineDocHubActions`) + finální uzavření container/hook/use-case bodu

## Pracovní pravidlo
- Po dokončení položky přepnout `[ ]` -> `[x]` a uložit commit.
