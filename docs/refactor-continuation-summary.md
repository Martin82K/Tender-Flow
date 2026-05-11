# Refactor continuation summary

Datum: 2026-05-06

## Stav po PR bloku

Tento blok dokoncil velkou cast architektonickeho cleanupu bez zmeny runtime chovani. Primarni cil byl snizit prime vazby `features/*` na legacy `services/*` a vymezit integracni hranice pres `infra/*` nebo domenove `features/*/api`.

Aktualni audit po poslednim commitu:

- prechodove import vazby: `67`
- shared UI shimy: `2`
- shared UI primitives: `48`
- soubory nad 800 radku: `21`
- root kandidati k presunu: `0`
- root kandidati k overeni: `3`
- tracked citlive root soubory: `0`

## Dokoncene rezy

- Contract/protocol flow:
  - contract protocol pouziva `contractQueriesApi.getContractById`
  - contract OCR markdown update flow je napojeny pres contracts API
- Infra hranice:
  - `infra/functions/functionsClient.ts`
  - `infra/platform/platformAdapter.ts`
  - `infra/files/fileSystemService.ts`
  - `infra/diagnostics/incidentLogger.ts`
  - `infra/db/dbAdapter.ts`
  - `infra/export/exportService.ts`
  - `infra/billing/*`
- Project API hranice:
  - `features/projects/api/projectDemoDataApi.ts`
- Audit dopad v tomto bloku:
  - prechodove import vazby snizeny z `106` na `67`

## Bezpecnostni vyhodnoceni

Zmeny byly boundary/import refaktor. Nemely menit:

- auth/session flow
- Supabase RLS nebo query payloady
- payment/checkout redirect pravidla
- filesystem opravneni
- praci se secrets
- CSV/PDF/XLSX obsah exportu
- incident logger sanitizaci a context allowlist

Kazda nova fasada pouze deleguje do puvodni service vrstvy a je pokryta delegacnim testem nebo testem dotceneho feature API.

## Overeni v bloku

Opakovane probehly:

- cilene Vitest sady pro dotcene oblasti
- `npm run check:boundaries`
- `npm run check:legacy-structure`
- `git diff --check`
- `npm run build`

Build stale vypisuje zname dlouhodobe warningy:

- `exceljs` eval warning
- static/dynamic import warning pro `incidentLogger` a `authSessionService`
- large chunk warningy

Tyto warningy nejsou nove zavedene runtime chyby tohoto refaktoru.

## Co zustava

Prioritni dalsi prace:

1. Dokoncit zbyvajici `features -> legacy services` vazby v auditu.
2. Zacit rezat `features -> legacy context` a `features -> legacy hooks` pres uzke domenove fasady nebo presun hooku.
3. Odstranit shared UI shimy:
   - `shared/ui/projects/Pipeline.tsx`
   - `shared/ui/projects/ProjectDocuments.tsx`
4. Rozdelit velke soubory:
   - `features/settings/ComplianceAdmin.tsx`
   - `features/settings/api/complianceAdminService.ts`
   - `features/projects/ui/ProjectOverviewNew.tsx`
   - `features/contacts/Contacts.tsx`
   - `features/projects/ProjectManager.tsx`
5. Po dalsim snizeni auditu zprisnit boundary guardraily z reportu na failujici pravidla.

## Poznamky pro dalsi navazani

- Legacy roots zustavaji ve freeze rezimu.
- Nove integracni importy preferovat pres `@infra/*`.
- Nove domenove use-case importy preferovat pres `@features/<domain>/api`.
- Pri kazdem rezu aktualizovat `docs/refactor-migration-ledger.md` a spustit minimalne cilene testy, `npm run check:boundaries`, `npm run check:legacy-structure`.
- Pred vetsim PR nebo merge spustit full `npm run test:run` a `npm run build`.

