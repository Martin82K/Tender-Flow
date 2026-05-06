# Refactor Migration Ledger

## 2026-05-06

### Architecture debt audit baseline
- Novy audit skript: `scripts/audit-architecture-debt.mjs`.
- Novy npm prikaz: `npm run audit:architecture`.
- `tests/architecture.boundaries.test.ts` overuje JSON kontrakt auditu, klasifikaci shared UI shimu, root hygiene kategorie a nulovy pocet tracked citlivych root souboru.
- Snapshot auditu:
  - skenovano `491` code souboru,
  - celkem `207` prechodovych import vazeb,
  - `shared -> components`: `11`,
  - `features -> legacy hooks`: `18`,
  - `features -> legacy context`: `49`,
  - `features -> legacy services`: `98`,
  - `features -> legacy utils`: `31`,
  - `shared/ui` temporary shims: `11`,
  - `shared/ui` primitives: `42`,
  - soubory nad `800` radku: `21`,
  - tracked root kandidati k presunu: `3`,
  - tracked root kandidati k overeni: `3`,
  - tracked citlive root soubory: `0`.
- Root hygiene kandidati k presunu:
  - `TAILWIND_V4_MIGRATION.md`,
  - `backup_before_split.patch`,
  - `latest-win-downloaded.yml`.
- Root hygiene kandidati k overeni pred presunem:
  - `dev-app-update.yml`,
  - `metadata.json`,
  - `server.js`.
- Nejvetsi soubory pro dalsi rezy:
  - `features/settings/ComplianceAdmin.tsx` (`2444` radku),
  - `components/ProjectOverviewNew.tsx` (`2265` radku),
  - `features/settings/api/complianceAdminService.ts` (`1529` radku),
  - `services/exportService.ts` (`1449` radku),
  - `features/contacts/Contacts.tsx` (`1283` radku).
- Bezpecnostni dopad: zmena je read-only audit bez runtime chovani; audit zamerne cte tracked nazvy root souboru pres `git ls-files` a nekopiruje ani nevypisuje obsah `.env*`.

### Root hygiene archivace
- Z korene repozitare presunuty historicke/root artefakty bez runtime referenci:
  - `TAILWIND_V4_MIGRATION.md` -> `docs/tailwind-v4-migration.md`,
  - `backup_before_split.patch` -> `archive/refactor/backup_before_split.patch`,
  - `latest-win-downloaded.yml` -> `archive/release-artifacts/latest-win-downloaded.yml`.
- `scripts/audit-architecture-debt.mjs` pri auditu tracked root souboru ignoruje indexove zaznamy, ktere uz v pracovnim stromu neexistuji; to drzi report spravne i behem rename/move rezu pred commitem.
- Aktualni root hygiene snapshot:
  - tracked root kandidati k presunu: `0`,
  - tracked root kandidati k overeni: `3` (`dev-app-update.yml`, `metadata.json`, `server.js`),
  - tracked citlive root soubory: `0`.
- Bezpecnostni dopad: zadny presun `.env*`; historicky patch zustal zachovan v archivu beze zmen obsahu a release metadata byla jen presunuta mimo root.

### ProjectSchedule shared shim removal
- Implementace harmonogramu presunuta:
  - `components/ProjectSchedule.tsx` -> `features/projects/ui/ProjectSchedule.tsx`.
- Export harmonogramu presunut mimo legacy services:
  - `services/scheduleExportService.ts` -> `features/projects/api/projectScheduleExportApi.ts`.
- Legacy compatibility shimy zustaly kvuli prechodove kompatibilite:
  - `components/ProjectSchedule.tsx`,
  - `services/scheduleExportService.ts`.
- Odstranen shared shim:
  - `shared/ui/projects/ProjectSchedule.tsx`.
- `features/projects/ProjectLayout.tsx` importuje harmonogram primo z `features/projects/ui/ProjectSchedule`.
- Ocekavany audit dopad:
  - `shared -> components`: `11 -> 10`,
  - `shared/ui` temporary shims: `11 -> 10`,
  - zadne nove `features -> legacy services` kvuli presunu export API do `features/projects/api`.
- Bezpecnostni dopad: runtime chovani exportu harmonogramu zustalo stejne; zmena nepridava nove externi integrace ani nepracuje se secrets.

### TenderPlan shared shim removal
- Implementace planu vyberovych rizeni presunuta:
  - `components/TenderPlan.tsx` -> `features/projects/ui/TenderPlan.tsx`.
- Feature-local import/export API doplneno:
  - `features/projects/api/tenderPlanExportApi.ts`.
- `features/projects/model/useTenderPlanController.ts` uz neimportuje import Excelu z legacy `services/exportService`.
- Legacy compatibility shim zustal:
  - `components/TenderPlan.tsx`.
- Odstranen shared shim:
  - `shared/ui/projects/TenderPlan.tsx`.
- `features/projects/ProjectLayout.tsx` importuje TenderPlan primo z `features/projects/ui/TenderPlan`.
- Ocekavany audit dopad proti stavu po ProjectSchedule rezu:
  - `shared -> components`: `10 -> 9`,
  - `shared/ui` temporary shims: `10 -> 9`,
  - prechodove import vazby: `206 -> 204`.
- Bezpecnostni dopad: Excel import/export zustava klientsky nad `xlsx`, bez novych externich volani a bez prace se secrets; feature UI pouziva sdilene modaly misto legacy `components`.

## 2026-02-18

### Auth/session
- `app/state/authSessionStore.ts` -> `infra/auth/authSessionStore.ts`
- Auth event source sjednocen:
  - `context/AuthContext.tsx` poslouchá `authSessionStore`
  - `app/hooks/useDesktopMcpTokenSync.ts` poslouchá `authSessionStore`
- Stuck-loading cleanup přesunut do `infra/auth/stuckLoadingRecovery.ts`.

### Feature registry
- Nové soubory:
  - `app/featureRegistry/types.ts`
  - `app/featureRegistry/manifests.ts`
  - `app/featureRegistry/index.ts`
- `app/views/LazyViews.tsx` převedeno na registry-driven lazy loading přes manifest `mount()`.

### Subscription domain API
- Nové feature API:
  - `features/subscription/api/*`
  - `features/subscription/model/*`
  - `features/subscription/ui/index.ts`
  - `features/subscription/index.ts`
- `context/FeatureContext.tsx` převeden na nové API (`getEnabledFeatures`, `getCurrentTier`).
- `features/settings/SubscriptionSettings.tsx` převeden na doménové API wrappery.

### Desktop IPC modularizace
- Nové moduly:
  - `desktop/main/ipc/modules/fsHandlers.ts`
  - `desktop/main/ipc/modules/watcherHandlers.ts`
  - `desktop/main/ipc/modules/sessionHandlers.ts`
  - `desktop/main/ipc/modules/mcpHandlers.ts`
  - `desktop/main/ipc/modules/oauthHandlers.ts`
  - `desktop/main/ipc/modules/netHandlers.ts`
  - `desktop/main/ipc/modules/bidComparisonHandlers.ts`
- `desktop/main/ipc/handlers.ts` přepnut na orchestraci modulů.
- Nový kontrakt index: `desktop/main/ipc/contracts.ts`.
- `desktop/main/preload.ts` používá typed invoke helper nad `IpcContractMap`.

### Další separace boundary porušení
- `features/settings/McpDiagnostics.tsx` převeden z přímého `window.electronAPI` na `services/platformAdapter`.
- `services/platformAdapter.ts` rozšířen o `mcpAdapter`.
- `components/Sidebar.tsx` už neimportuje Supabase přímo (nově `services/userProfileService.ts`).
- `features/projects/ProjectLayout.tsx` odstraněn přímý sync přes Supabase import v UI callbacku.

### Stabilita testů
- `desktop/main/services/portablePathResolver.ts` upraven na platform-agnostic práci s cestami (automatická volba `path.win32` vs `path.posix`).
- Fixnuty pády `tests/portablePathResolver.test.ts`.
- `tests/FeatureContext.demo.test.tsx`:
  - fix visení test runu: mock `useAuth` vrací stabilní referenci (`demoAuthState`) místo nového objektu na každý render
  - odstraněn stale mock na `services/subscriptionFeaturesService`, test mockuje aktuální `@/features/subscription/api`
- `npm run test:run` nyní končí stabilně (full run: `48` files / `174` tests).

### Legacy UI decoupling (features -> components)
- Nové shared entrypointy:
  - `shared/ui/Header.tsx`
  - `shared/ui/SubcontractorSelector.tsx`
  - `shared/ui/DeleteConfirmationModal.tsx`
  - `shared/ui/projects/*` (Pipeline/TenderPlan/ProjectSchedule/ProjectOverviewNew/ProjectDocuments/Contracts)
  - `shared/ui/overview/*` (KPICard/StatusCard/SupplierBarChart/SupplierTable/StatusDistributionChart/BudgetDeviationGauge)
- Legacy soubory převedené na compatibility shim export:
  - `components/Header.tsx`
  - `components/SubcontractorSelector.tsx`
  - `components/DeleteConfirmationModal.tsx`
- Feature vstupy přepojeny mimo `components/*`:
  - `features/contacts/Contacts.tsx`
  - `features/projects/Dashboard.tsx`
  - `features/projects/ProjectLayout.tsx`
  - `features/projects/ProjectManager.tsx`
  - `features/projects/ProjectOverview.tsx`
  - `features/settings/Settings.tsx` (nový settings entrypoint mimo `components/*`)
- `app/featureRegistry/manifests.ts`:
  - settings manifest `mount()` přepnut z `@/components/Settings` na `@/features/settings/Settings`
- `components/Settings.tsx` převeden na compatibility shim:
  - export z `@/features/settings/Settings`
  - odstranění plánováno: `2026-04-30`
- `components/ContactsImportWizard.tsx` převeden na compatibility shim:
  - implementace přesunuta do `shared/ui/ContactsImportWizard.tsx`
  - odstranění plánováno: `2026-04-30`
- `components/Header.tsx`, `components/SubcontractorSelector.tsx`, `components/DeleteConfirmationModal.tsx`:
  - doplněn compatibility shim banner s removal date `2026-04-30`

### Overview shared primitive hard-cut
- `shared/ui/overview/KPICard.tsx`:
  - obsahuje skutečnou implementaci KPI karty místo re-exportu z `components/overview`
  - legacy `components/overview/KPICard.tsx` zůstává jen compatibility shim pro staré importy
  - `tests/architecture.boundaries.test.ts` hlídá, že se `shared/ui/overview/KPICard.tsx` nevrátí mezi temporary shimy
  - audit dopad proti stavu po TenderPlan řezu:
    - `shared -> components`: `9 -> 8`,
    - `shared/ui` temporary shims: `9 -> 8`,
    - přechodové import vazby: `204 -> 203`
- `shared/ui/overview/StatusCard.tsx`:
  - obsahuje skutečnou implementaci status karty místo re-exportu z `components/overview`
  - legacy `components/overview/StatusCard.tsx` zůstává jen compatibility shim pro staré importy
  - `tests/architecture.boundaries.test.ts` hlídá, že se `shared/ui/overview/StatusCard.tsx` nevrátí mezi temporary shimy
  - audit dopad proti stavu po KPICard řezu:
    - `shared -> components`: `8 -> 7`,
    - `shared/ui` temporary shims: `8 -> 7`,
    - přechodové import vazby: `203 -> 202`
- `shared/ui/overview/{SupplierTable,SupplierBarChart,StatusDistributionChart,BudgetDeviationGauge}.tsx`:
  - obsahují skutečné implementace místo re-exportů z `components/overview`
  - legacy `components/overview/*` soubory zůstávají jen compatibility shimy pro staré importy
  - `tests/OverviewSharedComponents.test.tsx` pokrývá základní render tabulky, bar chartu, status distribuce a budget gauge
  - `tests/architecture.boundaries.test.ts` hlídá, že se tyto soubory nevrátí mezi temporary shimy
  - audit dopad proti stavu po StatusCard řezu:
    - `shared -> components`: `7 -> 3`,
    - `shared/ui` temporary shims: `7 -> 3`,
    - přechodové import vazby: `202 -> 198`

### ProjectOverviewNew shared shim removal
- Implementace přehledu projektu přesunuta:
  - `components/ProjectOverviewNew.tsx` -> `features/projects/ui/ProjectOverviewNew.tsx`.
- Legacy `components/ProjectOverviewNew.tsx` zůstává jako compatibility wrapper:
  - doplňuje `currentUserId` z `AuthContext` pro staré importy,
  - skutečné UI deleguje do `features/projects/ui/ProjectOverviewNew`.
- `features/projects/ProjectLayout.tsx` importuje `ProjectOverviewNew` přímo z feature UI.
- `app/AppContent.tsx` předává `currentUserId={user?.id}`, takže feature UI nemusí importovat legacy auth context.
- Odstraněn shared shim:
  - `shared/ui/projects/ProjectOverviewNew.tsx`.
- `tests/ProjectOverviewNew.compactEdit.test.tsx` testuje feature komponentu přímo.
- Očekávaný audit dopad proti stavu po overview charts řezu:
  - `shared -> components`: `3 -> 2`,
  - `shared/ui` temporary shims: `3 -> 2`,
  - přechodové import vazby zůstaly `198`, protože přesun do `features/projects/ui` zviditelnil existující formátovací závislost jako `features -> legacy utils`.
- Bezpečnostní dopad: `ProjectOverviewNew` už neimportuje auth context přímo; `currentUserId` se předává z `AppContent` přes `ProjectLayout`. Změna nepřidává nové externí volání, persistence ani práci se secrets.

### Shared decimal formatters
- Decimal helpery přesunuty do shared vrstvy:
  - `shared/formatting/decimalFormatters.ts`.
- Legacy `utils/formatters.ts` zůstává kompatibilní entrypoint:
  - re-exportuje `parseDecimal`, `formatDecimal`, `formatPercentValue`,
  - `parseFormattedNumber` dál používá stejnou implementaci.
- `features/projects/ui/ProjectOverviewNew.tsx` a `shared/ui/overview/*` používají shared formattery přímo.
- Očekávaný audit dopad proti stavu po ProjectOverviewNew řezu:
  - přechodové import vazby: `198 -> 197`,
  - bez změny `shared/ui` temporary shimů.
- Bezpečnostní dopad: čistý přesun deterministického parsování/formátování bez nového IO, externích volání nebo práce se secrets.

### Feature decimal formatter imports
- Feature soubory používající jen `formatDecimal`/`parseDecimal` byly přepojeny na:
  - `shared/formatting/decimalFormatters.ts`.
- Legacy `utils/formatters.ts` zůstává pro staré importy a pro funkce, které ještě nebyly přesunuté (`parseFormattedNumber`, money/chart helpery).
- Očekávaný audit dopad proti stavu po shared decimal formatter řezu:
  - přechodové import vazby: `197 -> 187`,
  - `features -> legacy utils` sníženo o deset importů.
- Bezpečnostní dopad: import-only refactor bez změny parsovací logiky, síťových volání, persistence nebo autorizace.

### Shared parseFormattedNumber
- `parseFormattedNumber` byl přesunut do:
  - `shared/formatting/decimalFormatters.ts`.
- Legacy `utils/formatters.ts` ho dál re-exportuje pro staré importy.
- `features/projects/model/usePipelineBidActions.ts` používá shared formatter přímo.
- Očekávaný audit dopad proti stavu po feature decimal import řezu:
  - přechodové import vazby: `187 -> 186`.
- Bezpečnostní dopad: zachované parsovací chování (`null -> 0`) bez nového IO, externích volání, persistence nebo autorizace.

### Shared offer status metadata
- Metadata stavů nabídek byla přesunuta do:
  - `shared/offers/offerStatus.ts`.
- Legacy `utils/offerStatus.ts` zůstává kompatibilní re-export.
- `features/projects/ProjectOverview.tsx` a `services/exportService.ts` používají shared helper přímo.
- Očekávaný audit dopad proti stavu po shared parseFormattedNumber řezu:
  - přechodové import vazby: `186 -> 185`.
- Bezpečnostní dopad: přesun statické mapy popisků a CSS tříd bez nového IO, externích volání, persistence nebo autorizace.

### Shared overview analytics
- Analytické modelové helpery byly přesunuty do:
  - `shared/overview/overviewAnalytics.ts`,
  - `shared/overview/supplierFilters.ts`.
- Legacy `utils/overviewAnalytics.ts` a `utils/supplierFilters.ts` zůstávají kompatibilní re-exporty.
- Feature overview controller/model a `ProjectOverview` používají shared helpery přímo.
- `services/exportService.ts`, `utils/overviewChat.ts` a legacy overview dashboard používají shared typy/helpery přímo.
- Očekávaný audit dopad proti stavu po shared offer status řezu:
  - přechodové import vazby: `185 -> 181`.
- Bezpečnostní dopad: přesun čistých výpočtů a filtrů bez nového IO, externích volání, persistence nebo autorizace.

### Shared admin access helper
- `isUserAdmin` byl přesunut do:
  - `shared/auth/adminAccess.ts`.
- Legacy `utils/helpers.ts` ho dál re-exportuje.
- `features/projects/model/useProjectOverviewController.ts` používá shared helper přímo.
- Očekávaný audit dopad proti stavu po shared overview analytics řezu:
  - přechodové import vazby: `181 -> 180`.
- Bezpečnostní dopad: zachován existující whitelist bez rozšíření oprávnění; jde pouze o přesun klientské helper funkce bez nového IO, persistence nebo externích volání.

### Shared organization role helpers
- Helpery pro role, stav žádosti a label uživatele byly přesunuty do:
  - `shared/organization/organizationUtils.ts`.
- Legacy `utils/organizationUtils.ts` zůstává kompatibilní re-export.
- `features/organization/ui/OrgMembersTab.tsx`, `features/settings/OrganizationSettings.tsx` a `features/settings/ProfileSettings.tsx` používají shared helpery přímo.
- Očekávaný audit dopad proti stavu po shared admin access řezu:
  - přechodové import vazby: `180 -> 177`.
- Bezpečnostní dopad: zachované role/status mapování bez rozšíření oprávnění, nového IO, persistence nebo externích volání.

### Shared email template utils
- Template helpery byly přesunuty do:
  - `shared/email/templateUtils.ts`.
- Legacy `utils/templateUtils.ts` zůstává kompatibilní re-export.
- `features/projects/model/usePipelineCommunicationActions.ts` a `components/TemplateManager.tsx` používají shared helper přímo.
- Očekávaný audit dopad proti stavu po shared organization helper řezu:
  - přechodové import vazby: `177 -> 176`.
- Bezpečnostní dopad: zachována existující DOMPurify sanitizace podpisu i whitelist tagů/atributů; žádné nové IO, persistence ani externí volání.

### Shared DocHub helpers
- DocHub helpery byly přesunuty do:
  - `shared/dochub/docHub.ts`.
- Legacy `utils/docHub.ts` zůstává kompatibilní re-export.
- Pipeline feature modely používají shared helpery přímo.
- `types.ts` bere DocHub typ ze shared vrstvy.
- Očekávaný audit dopad proti stavu po shared email template řezu:
  - přechodové import vazby: `176 -> 171`.
- Bezpečnostní dopad: zachována existující URL safety validace proti lokálním/private hostům a stejné path sanitizační helpery; žádné nové IO, persistence ani externí volání.

### Shared Excel indexer helpers
- Excel indexer helpery byly přesunuty do:
  - `shared/tools/excel/indexMatcher.ts`,
  - `shared/tools/excel/fillOddily.ts`.
- Legacy `utils/indexMatcher.ts` a `utils/fillOddily.ts` zůstávají kompatibilní re-exporty.
- `features/settings/ExcelIndexerSettings.tsx` a `features/settings/IndexMatcherSettings.tsx` používají shared helpery přímo.
- Očekávaný audit dopad proti stavu po shared DocHub řezu:
  - přechodové import vazby: `171 -> 168`.
- Bezpečnostní dopad: zachováno lokální zpracování workbooku bez nových síťových volání, persistence nebo práce se secrets; přidány testy pro normalizaci kódů a zápis oddílů.

### Shared Excel unlock zip helper
- Excel unlock ZIP helper byl přesunut do:
  - `shared/tools/excel/excelUnlockZip.ts`.
- Legacy `utils/excelUnlockZip.ts` zůstává kompatibilní re-export.
- `features/settings/ExcelUnlockerProSettings.tsx` a `features/settings/ToolsSettings.tsx` používají shared helper přímo.
- Očekávaný audit dopad proti stavu po shared Excel indexer řezu:
  - přechodové import vazby: `168 -> 166`.
- Bezpečnostní dopad: zachováno lokální zpracování XLSX ZIP archivu bez síťových volání, persistence nebo secrets; přidán test pro odstranění `sheetProtection` z reálného ExcelJS workbooku.

### Feature API barrel cleanup
- `features/projects/api/index.ts` přestal re-exportovat legacy `projectService` a mutation hooky.
- `features/contacts/api/index.ts` přestal re-exportovat legacy contact mutation hooky; zatím zůstává prázdný kompatibilní module entrypoint.
- Feature runtime API exporty (`pipelineApi`, tender plan, schedule, clone, contract protocol) zůstaly beze změny.
- Očekávaný audit dopad proti stavu po shared Excel unlock řezu:
  - přechodové import vazby: `166 -> 163`.
- Bezpečnostní dopad: odstranění nepoužívaných re-exportů bez nové logiky, IO, persistence nebo externích volání.

### Infra desktop updater hook
- Desktop updater hook byl přesunut do:
  - `infra/desktop/useElectronUpdater.ts`.
- Legacy `hooks/useElectronUpdater.ts` zůstává kompatibilní re-export.
- `features/settings/ProfileSettings.tsx` a `components/UpdateNotification.tsx` používají infra hook přímo.
- Očekávaný audit dopad proti stavu po feature API barrel cleanup řezu:
  - přechodové import vazby: `163 -> 162`.
- Bezpečnostní dopad: zachované volání `updaterAdapter` bez nové sítě, persistence nebo oprávnění; desktop-only chování zůstává za platform adapterem.

### Shared project query keys
- `PROJECT_KEYS` byly přesunuty do:
  - `shared/queryKeys/projectKeys.ts`.
- Legacy `hooks/queries/useProjectsQuery.ts` je dál re-exportuje kvůli kompatibilitě.
- `features/projects/ProjectManager.tsx` používá shared query keys přímo.
- Očekávaný audit dopad proti stavu po infra desktop updater řezu:
  - přechodové import vazby: `162 -> 161`.
- Bezpečnostní dopad: čistý přesun konstant cache klíčů bez nové logiky, IO, persistence nebo externích volání.

### Command Center portfolio state hook
- Read-only portfolio data pro Command Center byla zúžena do:
  - `features/projects/model/useProjectPortfolioState.ts`.
- Command Center moduly už neimportují globální legacy `useAppData` jen kvůli `projects` a `allProjectDetails`.
- Z Command Center datových hooků byly odstraněny zbytečné `UIContext` importy používané pouze pro předání `showUiModal`.
- Očekávaný audit dopad proti stavu po shared project query keys řezu:
  - přechodové import vazby: `161 -> 141`.
- Bezpečnostní dopad: zachováno čtení přes existující React Query hooky; žádná nová mutace, síťová cesta, persistence, oprávnění ani práce se secrets.

### Projects list state hook
- Read-only seznam zakázek byl zúžen do:
  - `features/projects/model/useProjectsState.ts`.
- `features/projects/model/useProjectPortfolioState.ts` používá `useProjectsState` pro seznam a doplňuje jen detaily portfolia.
- `features/tasks/ui/TaskFormModal.tsx` už neimportuje legacy `useProjectsQuery` a pro select zakázky používá jen list state bez načítání detailů.
- Očekávaný audit dopad proti stavu po Command Center portfolio řezu:
  - přechodové import vazby: `141 -> 140`.
- Bezpečnostní dopad: čisté přesměrování čtení existujícího query výsledku bez nové mutace, externího volání, persistence, oprávnění nebo práce se secrets.

### Tools URL shortener API import
- `features/tools/api/index.ts` exportuje kompletní URL shortener API používané UI.
- `features/tools/UrlShortener.tsx` už neimportuje legacy `services/urlShortenerService` přímo a používá feature API entrypoint.
- Očekávaný audit dopad proti stavu po projects list state řezu:
  - přechodové import vazby: `140 -> 139`.
- Bezpečnostní dopad: URL validace, sanitizace chyb a Supabase/TinyURL flow zůstávají ve stejné service implementaci; změna nepřidává nové síťové volání, persistence ani práci se secrets.

### Settings service API imports
- `features/settings/api/index.ts` exportuje typy pro organization a user management API.
- Settings UI soubory pro email test, user management, whitelist, organizace a profil používají feature API entrypoint místo přímých importů z legacy services.
- Očekávaný audit dopad proti stavu po tools URL shortener řezu:
  - přechodové import vazby: `139 -> 133`.
- Bezpečnostní dopad: zachována stejná service implementace a oprávnění; změna pouze centralizuje import boundary bez nových volání, persistence nebo práce se secrets.

### Organization service API imports
- Přidán přechodový organization API entrypoint:
  - `features/organization/api/index.ts`.
- Organization dashboard a taby pro overview, members a branding používají feature API místo přímých importů z legacy `organizationService`.
- Očekávaný audit dopad proti stavu po settings service API řezu:
  - přechodové import vazby: `133 -> 130`.
- Bezpečnostní dopad: zachována stejná organization service implementace, role checks a storage limity; změna nepřidává nové volání, persistence ani práci se secrets.

### Subscription features API wrappers
- `features/subscription/api/subscriptionState.ts` exportuje admin wrappery pro správu feature flags a subscription feature definic.
- `features/settings/SubscriptionFeaturesManagement.tsx` používá subscription feature API místo přímého importu `subscriptionFeaturesService`.
- Očekávaný audit dopad proti stavu po organization service API řezu:
  - přechodové import vazby: `130 -> 129`.
- Bezpečnostní dopad: zachována stejná Supabase service implementace a fails-closed subscription logika; změna pouze centralizuje volání bez nových oprávnění, persistence nebo práce se secrets.

### Settings incident admin API wrappers
- `features/settings/api/complianceAdminService.ts` exportuje wrappery pro incident admin list/purge flow.
- `features/settings/IncidentLogsAdmin.tsx` používá settings API entrypoint místo přímého importu `incidentAdminService`.
- Očekávaný audit dopad proti stavu po subscription features API řezu:
  - přechodové import vazby: `129 -> 128`.
- Bezpečnostní dopad: zachována stejná RPC service implementace včetně limitů purge okna; změna nepřidává nové volání, persistence ani práci se secrets.

### Auth feature API imports
- Přidán přechodový auth API entrypoint:
  - `features/auth/api/index.ts`.
- Auth UI stránky a admin registration settings používají feature API místo přímých importů `authService` a `platformAdapter`.
- Očekávaný audit dopad proti stavu po settings incident admin API řezu:
  - přechodové import vazby: `128 -> 125`.
- Bezpečnostní dopad: zachována stejná auth service implementace, reset token flow i desktop platform guardy; změna nepřidává nové oprávnění, persistence ani práci se secrets.

### Overview business logic extraction
- `features/projects/ProjectOverview.tsx`:
  - analytické výpočty přesunuty do `features/projects/model/projectOverviewModel.ts`
  - kolapsovatelná sekce přesunuta do `features/projects/ui/OverviewSection.tsx`
  - controller vrstva přesunuta do `features/projects/model/useProjectOverviewController.ts`
  - reset supplier filtrů sjednocen přes controller API (`resetSupplierFilters`)
- `components/ProjectOverviewNew.tsx`:
  - money helpery + finanční agregace + demand-table use-case přesunuty do `features/projects/model/projectOverviewNewModel.ts`
  - UI soubor používá model API (`buildDemandTableData`, `calculateOverviewFinancials`, `getWinningBids`, `getWinningBidTotal`)
  - controller vrstva přesunuta do `features/projects/model/useProjectOverviewNewController.ts`
  - localStorage column preferences + edit form state + save handlery + demand table totals jsou mimo UI komponentu
  - footer agregace (SOD/Plán/VŘ diff) čte předpočítané hodnoty z controller hooku
  - snížení velikosti souboru `1766 -> 1579` řádků

### Pipeline partial hard-cut
- Nový model soubor: `features/projects/model/pipelineModel.ts`
  - `getTemplateLinksForInquiryKindModel`
  - `getSafeFallbackProjectId`
  - `sanitizeFolderSegment`
  - `buildBidComparisonSuppliers`
  - `htmlToPlainText`
  - `buildNewDemandCategory` + `buildUpdatedDemandCategory`
- `components/Pipeline.tsx`:
  - přepojeno na model helpery
  - odstraněny nepoužívané legacy handlery `handleCreateCategory` / `handleEditCategory` a navázané dead state
  - snížení velikosti souboru `2410 -> 2182` řádků
- Nový model soubor: `features/projects/model/pipelineEmailModel.ts`
  - email use-case helpery pro flow „email nevybraným“ (`getLoserBidsWithPrice`, `getLoserEmails`, `buildDefaultLosersEmailDraft`)
- `components/Pipeline.tsx` email flow přepojen na model helpery (`2410 -> 2171` řádků)
- Nový controller hook: `features/projects/model/usePipelineBidsState.ts`
  - sync `bids` z props s ochranou proti interním optimistic update
  - deferred notifikace `onBidsChange` mimo render fázi
- `components/Pipeline.tsx` používá `usePipelineBidsState` pro bids state orchestraci (`2171 -> 2141` řádků)
- Nový controller hook: `features/projects/model/usePipelineCategoryNavigation.ts`
  - active category sync s URL (`initialOpenCategoryId`)
  - bid comparison panel state + desktop path resolving
- Nový controller hook: `features/projects/model/usePipelineDocHubFallback.ts`
  - centralized project/category fallback orchestrace pro DocHub auto-create flow
  - in-flight guard + one-time project bootstrap fallback
- Nový controller hook: `features/projects/model/usePipelineCategoryForms.ts`
  - create/edit category modal state
  - category form handlery (upload dokumentů + linked tender dates fetch)
- `components/Pipeline.tsx` přepojen na nové pipeline controllery (`2141 -> 1774` řádků)
- Nový controller hook: `features/projects/model/usePipelineContactsController.ts`
  - local contacts projekce + create/edit modal state
  - save/update flow (demo + API) + validace názvu dodavatele
- `components/Pipeline.tsx` odstraněny duplicitní lokální handlery kontaktů
  - `handleCreateContactRequest`, `handleSaveNewContact`, `handleUpdateContact`
  - `CreateContactModal` zavírání sjednoceno přes `closeContactModal`
  - další zmenšení souboru `1774 -> 1680` řádků
- `features/projects/model/index.ts` doplněn export `usePipelineContactsController`
- Nový controller hook: `features/projects/model/usePipelineSubcontractorSelection.ts`
  - subcontractor modal state (`open/maximize/selectedIds`)
  - add subcontractors flow (optimistic update, demo/API persist, DocHub auto-create trigger)
- `components/Pipeline.tsx` odstraněn lokální handler `handleAddSubcontractors`
  - `SubcontractorSelectorModal` potvrzení deleguje na controller (`handleAddSubcontractors(localContacts)`)
  - další zmenšení souboru `1680 -> 1529` řádků
- `features/projects/model/index.ts` doplněn export `usePipelineSubcontractorSelection`
- Nový controller hook: `features/projects/model/usePipelineBidActions.ts`
  - bid mutace: drag/drop status, toggle contracted, save bid, delete bid
  - demo/API persist flow + DocHub fallback trigger + MCP auto-delete folder cleanup
- `components/Pipeline.tsx` odstraněny lokální handlery:
  - `handleDrop`, `handleToggleContracted`, `handleSaveBid`, `handleDeleteBid`
  - další zmenšení souboru `1529 -> 1311` řádků
- `features/projects/model/index.ts` doplněn export `usePipelineBidActions`
- Nový controller hook: `features/projects/model/usePipelineCommunicationActions.ts`
  - inquiry flow (template lookup, mailto/eml mode, status update + DocHub fallback)
  - export flow (`xlsx` / `markdown` / `pdf`)
  - email losers flow (template fallback + mailto draft)
- `components/Pipeline.tsx` odstraněny lokální handlery:
  - `generateInquiryFromTemplateKind`, `handleGenerateInquiry`, `handleGenerateMaterialInquiry`
  - `handleExport`, `handleEmailLosers`
  - další zmenšení souboru `1311 -> 1098` řádků
- `features/projects/model/index.ts` doplněn export `usePipelineCommunicationActions`
- Nový controller hook: `features/projects/model/usePipelineDocHubActions.ts`
  - open/copy path flow (desktop, MCP, clipboard fallback)
  - backend DocHub link orchestrace (`dochub-get-link`) s provider guardy
  - supplier + tender folder open handlery pro desktop/cloud/mcp cesty
- `components/Pipeline.tsx` odstraněny lokální handlery:
  - `openOrCopyDocHubPath`, `openDocHubBackendLink`, `handleOpenSupplierDocHub`
  - inline tender folder open click flow přepojen na `handleOpenTenderDocHub`
  - další zmenšení souboru `1098 -> 888` řádků
- `features/projects/model/index.ts` doplněn export `usePipelineDocHubActions`

### ProjectSchedule helper extraction
- Nový model soubor: `features/projects/model/projectScheduleModel.ts`
  - `Zoom` + `Row` typy
  - timeline/date helpery (`parseIsoDate`, `addDays`, `diffDaysUtc`, ...)
  - use-case výpočty (`buildRows`, `buildAxis`, `calculateChartRange`)
- Nový controller hook: `features/projects/model/useProjectScheduleController.ts`
  - načítání tender planů + optimistic update save flow pro edit modal
  - scroll/focus efekty (auto-focus na dnešek, scroll indicators)
  - export menu state + outside click close
- `components/ProjectSchedule.tsx` přepojen na model/controller vrstvu (`997 -> 495` řádků)

### TenderPlan helper extraction
- Nový model soubor: `features/projects/model/tenderPlanModel.ts`
  - status + badge logika (`getTenderPlanStatus`, `getTenderPlanStatusBadgeClasses`)
  - view filtrování (`getVisibleTenderPlans`)
  - import use-case (`planTenderImport`, conflict/summary message builders)
  - lookup helper (`findLinkedCategoryForPlan`)
- Nový controller hook: `features/projects/model/useTenderPlanController.ts`
  - načítání + optimistic CRUD flow
  - import flow (včetně conflict resolution) a synchronizace
  - modal state + form state + view mode state
- `components/TenderPlan.tsx` přepojen na model/controller vrstvu (`842 -> 456` řádků)
