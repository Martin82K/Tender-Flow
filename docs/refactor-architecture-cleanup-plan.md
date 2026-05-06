# Refaktor architektury a úklid kořene

Datum: 2026-05-06

## Cíl

Pokračovat v inkrementálním refaktoru podle `docs/architecture.md` bez big-bang přestavby. Cílem je čistší modulární aplikace, menší doménové chunky, nižší legacy coupling a přehlednější kořen repozitáře.

Každý krok musí být malý, reverzibilní a ověřený testy. Bezpečnostní hranice mají přednost před kosmetickým úklidem.

## Výchozí stav

- Cílové vrstvy jsou definované: `app/`, `features/`, `shared/`, `infra/`.
- Legacy roots jsou zmrazené: `components/`, `hooks/`, `services/`, `context/`, `utils/`.
- Existují guardraily:
  - `npm run check:boundaries`
  - `npm run check:legacy-structure`
  - `tests/architecture.boundaries.test.ts`
- Aktuální kontroly prošly:
  - `npm run check:boundaries`
  - `npm run check:legacy-structure`
  - `npm run test:run`
- Největší zbývající riziko není akutní bezpečnostní chyba, ale udržovatelnost: velké soubory, compatibility shimy a kořenový nepořádek.

## Pracovní pravidla

1. Neměnit více architektonických hranic v jednom PR.
2. Nový doménový kód patří do `features/<feature>/api`, `features/<feature>/model`, `features/<feature>/ui`.
3. Sdílené UI v `shared/ui` nesmí být skrytou cestou zpět do legacy `components`.
4. `app/` skládá aplikaci, ale nenese business logiku.
5. `infra/` izoluje externí systémy: Supabase, platform API, HTTP providery, desktop adaptéry.
6. Každý odstraněný architektonický dluh musí snížit allowlist nebo legacy shim, ne pouze přesunout problém jinam.
7. Každý řez končí minimálně:
   - cílený test pro změněnou oblast,
   - `npm run check:boundaries`,
   - `npm run check:legacy-structure`.
8. Před handoffem většího řezu spustit `npm run test:run`.

## Definice malého chunku

Chunk je jedna změna s jedním jasným vlastnictvím:

- jeden modul nebo jedna hranice,
- typicky 1 až 5 souborů s produkční změnou,
- bez současného redesignu UI a přesunu datové vrstvy,
- s jedním ověřitelným testovacím dopadem.

Příklad dobrého chunku: přesun `shared/ui/projects/Pipeline.tsx` shim vrstvy na skutečný feature export a úprava importů.

Příklad špatného chunku: současně rozdělit `AppContent`, přepsat `useAppData`, přesunout services a změnit routing.

## Fáze 1: zpřesnit architektonický debt ledger

### Cíl

Mít přesnou mapu zbývajícího dluhu, který už není zachycený jen pravidlem `features -> components`.

### Úkoly

- Přidat audit report pro:
  - `shared -> components`,
  - `features -> legacy hooks`,
  - `features -> legacy context`,
  - `features -> legacy services`,
  - `features -> legacy utils`,
  - soubory nad 800 LoC.
- Rozlišit, co je dočasný shim a co je legitimní shared primitive.
- Aktualizovat `docs/refactor-migration-ledger.md` o nový snapshot.

### Testy

- `npm run check:boundaries`
- `npm run check:legacy-structure`
- `npm run test:run -- tests/architecture.boundaries.test.ts`

## Fáze 2: odstranit shared-to-legacy shimy

### Cíl

`shared/ui` má obsahovat reálně sdílené primitivy, ne přesměrování do `components`.

### Kandidáti

- `shared/ui/projects/Pipeline.tsx`
- `shared/ui/projects/ProjectOverviewNew.tsx`
- `shared/ui/projects/ProjectSchedule.tsx` — hotovo, implementace je ve `features/projects/ui/ProjectSchedule.tsx`, legacy export zůstává v `components/ProjectSchedule.tsx`
- `shared/ui/projects/TenderPlan.tsx`
- `shared/ui/projects/ProjectDocuments.tsx`
- `shared/ui/overview/*`

### Postup

1. Vybrat jeden shim.
2. Přesunout skutečný komponent do cílové vrstvy:
   - project-specific UI do `features/projects/ui`,
   - obecné primitives do `shared/ui`.
3. Upravit importy přes aliasy.
4. Smazat shim až po ověření, že není potřeba kompatibilita.
5. Pokud zůstane legacy soubor prázdný nebo jen re-export, rozhodnout, zda ho archivovat, nebo ponechat do dalšího řezu.

### Testy

- Cílený test komponenty nebo hooku.
- `npm run check:boundaries`
- `npm run check:legacy-structure`
- Po několika shimech `npm run test:run`.

## Fáze 3: zmenšit composition root

### Cíl

`app/AppContent.tsx` má jen skládat aplikaci. Nemá držet všechny doménové rozhodovací větve.

### Navržené chunky

1. Vyjmout `DesktopPlanGate`.
2. Vyjmout `LegalAndWhatsNewGate`.
3. Vyjmout `AppRouteRenderer`.
4. Vyjmout `AppGlobalSearchBoundary`.
5. Zachovat veřejné chování URL a login redirectů.

### Výsledek

- `AppContent` zůstane shell pro auth/loading/error/layout.
- Render jednotlivých view bude v samostatném route rendereru.
- Desktop gating bude testovatelný bez renderování celé aplikace.

### Testy

- `npm run test:run -- tests/AppContent.legalAcceptance.test.tsx tests/AuthGate.navigation.test.tsx tests/useRoute.test.tsx`
- `npm run check:boundaries`
- `npm run check:legacy-structure`

## Fáze 4: rozdělit globální `useAppData`

### Cíl

Omezit jeden globální datový hook, který drží projekty, kontakty, statusy, selected project state a mutace.

### Navržené chunky

1. Vytvořit `features/projects/model/useProjectsState`.
2. Vytvořit `features/contacts/model/useContactsState`.
3. Vytvořit `features/projects/model/useProjectDetailsState`.
4. Nechat dočasnou fasádu `useAppData`, která jen skládá nové hooky.
5. Přesměrovat feature moduly z `@/hooks/useAppData` na doménové hooky.
6. Teprve nakonec odstranit nebo výrazně zmenšit legacy `hooks/useAppData.ts`.

### Bezpečnostní poznámka

Při přesunu mutací nesmí dojít k obcházení React Query invalidace, auth recovery ani incident loggingu.

### Testy

- `npm run test:run -- tests/useProjectMutations.overviewInvalidation.test.ts tests/useContactMutations.nameValidation.test.ts tests/command-center/useDerivedActions.test.tsx`
- `npm run check:boundaries`
- `npm run check:legacy-structure`

## Fáze 5: rozdělit největší doménové soubory

### Priorita A

- `features/settings/ComplianceAdmin.tsx`
- `features/settings/api/complianceAdminService.ts`

Rozdělit na:

- `features/settings/compliance/ui`
- `features/settings/compliance/model`
- `features/settings/compliance/api`

### Priorita B

- `components/ProjectOverviewNew.tsx`
- `features/contacts/Contacts.tsx`
- `services/exportService.ts`

Rozdělit po doménových use-case:

- controller hook,
- čistý model/helper,
- prezentační komponenty,
- integrační API.

### Testy

- Vždy cílený test pro rozdělený modul.
- Po každé prioritě `npm run test:run`.

## Fáze 6: zpřísnit boundary guardraily

### Cíl

Postupně přeměnit audit na pravidla.

### Nová pravidla

- `shared` nesmí importovat `components`.
- `features` nesmí importovat legacy `hooks`.
- `features` nesmí importovat legacy `context`, kromě explicitně povolené přechodové vrstvy.
- `features` nesmí importovat feature-specific `services/*`; služby se přesouvají do `features/<domain>/api`.

### Postup

1. Nejprve reportovat bez failu v audit dokumentu.
2. Potom zavést allowlist.
3. Potom přepnout na fail v `scripts/check-boundaries.mjs`.

### Testy

- `npm run test:run -- tests/architecture.boundaries.test.ts`
- `npm run check:boundaries`

## Fáze 7: úklid kořenové složky

### Cíl

Kořen repozitáře má obsahovat jen soubory, které očekává toolchain, hosting, desktop build nebo vývojářský onboarding.

### Kategorie root souborů

Ponechat v kořeni:

- package a lock soubory,
- Vite/Vitest/TypeScript/Tailwind/PostCSS config,
- Electron builder config,
- hosting config, pokud ho provider očekává v kořeni,
- entrypointy, dokud Vite konfigurace počítá s kořenem,
- hlavní repo dokumenty typu `README.md`, `AGENTS.md`.

Přesunout nebo konsolidovat:

- historické migrační poznámky do `docs/`,
- release artefakty do `docs/releases/` nebo `archive/`,
- ruční patche do `archive/` nebo odstranit po ověření,
- server entrypointy do `server/`, pokud hosting/build dovolí změnu.

Ignorovat nebo odstranit z pracovního stromu:

- `.DS_Store`,
- lokální `.env*`,
- `.tmp/`,
- `dist/`,
- `dist-electron/`,
- lokální update/download soubory.

### Konkrétní kandidáti

- `backup_before_split.patch`: hotovo, přesunuto do `archive/refactor/backup_before_split.patch`.
- `latest-win-downloaded.yml`: hotovo, přesunuto do `archive/release-artifacts/latest-win-downloaded.yml`.
- `TAILWIND_V4_MIGRATION.md`: hotovo, přesunuto do `docs/tailwind-v4-migration.md`.
- `server.js`: zvážit přesun do `server/` až po ověření hosting konfigurací.
- `App.tsx`, `index.tsx`, `index.css`, `types.ts`: ponechat do fáze, kdy se rozhodne o zavedení `src/` nebo rootless Vite layoutu. Podle současného `CLAUDE.md` projekt záměrně nepoužívá `src/`.

### Bezpečnostní poznámka

Nikdy nepřesouvat ani necommitovat `.env`, `.env.local`, `.env_backup`. Při úklidu pouze ověřit `.gitignore` a případně použít netrackovaný lokální cleanup mimo commit.

### Testy

- `npm run build`
- `npm run desktop:compile`
- `npm run test:run`
- `npm run check:boundaries`
- `npm run check:legacy-structure`

## Fáze 8: dokumentovat nový standard

### Cíl

Aby se projekt znovu nerozpadal do velkých souborů a root clutteru.

### Úkoly

- Aktualizovat `docs/architecture.md` o root hygiene pravidla.
- Přidat krátkou sekci do `AGENTS.md`, pokud se pravidla mají stát závazná pro agenty.
- Doplnit checklist do PR template:
  - žádné nové soubory ve frozen roots,
  - žádné nové root soubory bez důvodu,
  - cílené testy uvedené v PR,
  - security dopad zhodnocen.

## Milníky

### Milník 1: viditelnost dluhu

- Existuje nový audit snapshot.
- Jsou pojmenované všechny compatibility shimy.
- Root soubory jsou rozdělené na keep/move/delete/ignore.

### Milník 2: čistší feature boundaries

- `shared -> components` je 0.
- Nové boundary pravidlo je aktivní.
- `useAppData` je fasáda, ne hlavní datová vrstva.

### Milník 3: čistší kořen

- V kořeni nejsou historické patche ani release artefakty.
- Lokální/build artefakty jsou ignorované a netrackované.
- Hosting a desktop build stále prochází.

### Milník 4: menší moduly

- Žádný běžný UI/container soubor nemá přes 800 LoC bez výjimky.
- Velké doménové služby jsou rozdělené podle use-case.
- Nové feature moduly mají konzistentní `api/model/ui` strukturu.

## Doporučené první tři PR

1. Audit PR: přidat skript nebo dokumentovaný report pro shimy, legacy imports a root clutter.
2. Root hygiene PR: přesunout dokumentační root soubory do `docs/`, vyřešit tracked artefakty, bez změny runtime.
3. App shell PR: vyjmout `DesktopPlanGate` a `LegalAndWhatsNewGate` z `AppContent`.

Toto pořadí snižuje riziko: nejdřív měříme, potom uklízíme bez runtime změn, až potom saháme do orchestrace aplikace.
