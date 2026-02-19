# Refactor Migration Ledger

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
