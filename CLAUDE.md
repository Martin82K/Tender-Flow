# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Tender Flow** is a full-stack CRM application for construction tender and project management, available as both a web application and Electron desktop app. It manages projects, subcontractors/contacts, bidding pipelines, and document workflows.

**Tech Stack:**
- Frontend: React 19 + TypeScript, Vite, Tailwind CSS v4
- Backend: Supabase (PostgreSQL with RLS), Vercel (hosting)
- Desktop: Electron 40
- Python services: Flask APIs for Excel merge/unlock tools (proxied via Vite on port 5001)
- AI: Google Gemini for insights and contract extraction

## Development Commands

```bash
# Web
npm run dev              # Start dev server (port 3000)
npm run build            # Production build
npm run start            # Production Express server

# Testing
npm test                 # Watch mode
npm run test:run         # Run once
npm run test:coverage    # With coverage
npm test -- path/to/test.test.tsx  # Single test

# Desktop (Electron)
npm run desktop:dev      # Dev mode (starts Vite + Electron)
npm run desktop:build    # Build for current platform
npm run desktop:build:mac / npm run desktop:build:win

# Architecture validation
npm run check:boundaries       # Validate import boundaries between modules
npm run check:legacy-structure # Check for violations of legacy freeze

# Version management (syncs package.json + config/version.ts)
npm run version:patch / version:minor / version:major

# Supabase
npx supabase start / db push / functions deploy <name>
```

## Directory Structure & Architecture

The project does NOT use a `src/` directory. Code lives at the project root in a modular architecture:

```
app/              # Application shell, entry points, views
  AppShell.tsx    # Root component (wraps AppProviders → AppContent)
  AppContent.tsx  # Main router/view switcher
  views/          # Lazy-loaded view components
  hooks/          # App-level hooks (route sync, loading recovery)

features/         # Feature modules (feature-sliced design)
  agent/          # AI agent integration
  auth/           # Authentication UI, legal acceptance
  contacts/       # Contact management
  projects/       # Project management
  public/         # Public pages (landing, cookie consent)
  settings/       # Settings feature
  subscription/   # Subscription management
  tools/          # Tool features

shared/           # Shared cross-cutting concerns
  routing/        # Router, route utils, RequireFeature
  ui/             # Shared UI components (agent panel, overview, projects)
  types/          # Shared type definitions (incidents, agent)
  legal/          # Legal document versioning
  compliance/     # Compliance features
  security/       # Security utilities
  privacy/        # Privacy features
  contracts/      # Contract utilities
  dochub/         # DocHub utilities

infra/            # Infrastructure layer
  diagnostics/    # Runtime diagnostics, monitoring
  auth/           # Auth infrastructure
  excel-tools/    # Excel tool infrastructure
  projects/       # Project infrastructure

components/       # Legacy components (being migrated to features/)
hooks/            # Global hooks (useAppData, useDesktop, useTheme, etc.)
  queries/        # React Query hooks
  mutations/      # React Query mutation hooks
services/         # Service layer (40+ services)
context/          # React contexts (AuthContext, UIContext, FeatureContext)
config/           # App configuration (features, tiers, version, navigation)
utils/            # Utility functions
desktop/          # Electron main process, IPC handlers, desktop services
server_py/        # Python APIs (excel_merge_tool, excel_unlock_api)
supabase/         # Migrations, edge functions, shared utilities
tests/            # Vitest test files
```

### Path Aliases (tsconfig + vite)

```
@/*         → ./*          (project root)
@app/*      → ./app/*
@features/* → ./features/*
@shared/*   → ./shared/*
@infra/*    → ./infra/*
```

## Application Entry & Routing

**Entry:** `index.tsx` → `App.tsx` (re-exports `AppShell`) → `app/AppShell.tsx` → `AppProviders` → `app/AppContent.tsx`

**Startup:** `index.tsx` initializes `runtimeDiagnostics` and `incidentGlobalHandlers` before React mount.

**Routing:** Custom client-side router in `shared/routing/`:
- `router.tsx` — `useLocation()`, `navigate()`
- `routeUtils.ts` — `buildAppUrl()` for constructing URLs
- URL pattern: `/app/{view}?projectId=...&tab=...&categoryId=...`
- Views are lazy-loaded via `app/views/LazyViews.tsx`

**Views** (defined as `View` type in `types.ts`): dashboard, project, contacts, settings, project-management, project-overview, url-shortener

**Project tabs** (defined as `ProjectTab` type): overview, tender-plan, pipeline, schedule, documents, contracts

## State Management

**`useAppData`** (`hooks/useAppData.ts`) — Centralized data hook providing `state` and `actions` for all CRUD operations on projects, contacts, project details, statuses.

**React Query** (`@tanstack/react-query`) — Server state management:
- Query hooks in `hooks/queries/`
- Mutation hooks in `hooks/mutations/`
- Query client in `services/queryClient.ts`

**Contexts:** `AuthContext` (auth, session, preferences), `UIContext` (modals, notifications), `FeatureContext` (feature flags by subscription tier)

## Data Model

Core types in `types.ts`:

```
Project
├── ProjectDetails (metadata, financials, documents)
│   └── DemandCategory[] (tender line items)
│       └── Bid[] (subcontractor offers per category)
├── TenderPlanItem[] (schedule items)
└── DocumentLink[] (multi-link documents)

Subcontractor → ContactPerson[] (companies with contacts)
StatusConfig (dynamic status labels/colors)
User (role: admin/user/demo, subscriptionTier, organizationId)
```

## Feature Flags & Subscriptions

Subscription tiers: `free`, `starter`, `pro`, `enterprise`, `admin` (defined in `config/subscriptionTiers.ts`)

Feature definitions in `config/features.ts`. Gate UI with:
```tsx
<RequireFeature feature={FEATURES.MODULE_PROJECTS}>
  <Component />
</RequireFeature>
```
Or use `useFeature` hook. Server-side checks in `subscriptionFeaturesService.ts`.

## Desktop (Electron)

- `desktop/main/main.ts` — Main process
- `desktop/main/preload.ts` — Exposes `window.electronAPI`
- `desktop/main/ipc/` — IPC handlers (modular)
- `desktop/main/services/` — biometricAuth, mcpServer, pythonRunner, folderWatcher, secureStorage, auto-updates
- Desktop detection: `isDesktop` from `useDesktop` hook or `platformAdapter`
- Build flag: `ELECTRON_BUILD=true` sets base path to `./`

## DocHub Integration

Document management module for organizing project files in Google Drive, OneDrive, or local filesystem:
- Projects enable DocHub with a root folder link
- Auto-create generates standardized folder structure (versioned, currently v1)
- Providers: gdrive, onedrive, local
- Key hook: `useDocHubIntegration.ts`
- UI in `components/projectLayoutComponents/documents/`

## Important Conventions

- **Views** are top-level app sections, **tabs** are within a project view
- **Categories** (DemandCategory) represent tender line items, **bids** are subcontractor offers per category
- Always use `navigate` from `shared/routing/router` for navigation
- Use `buildAppUrl` from `shared/routing/routeUtils` to construct URLs
- Feature-gated code uses `RequireFeature` component or `useFeature` hook
- Version bumping must use npm scripts to keep `config/version.ts` in sync
- Architecture boundaries are enforced — run `npm run check:boundaries` to validate
- UI strings are in Czech (the app's target language)
- Environment variables use `VITE_` or `TINY_URL_` prefix for client access
- Test files go in `tests/` directory (not co-located), pattern: `tests/**/*.test.{ts,tsx}`
- Vitest uses jsdom environment with `tests/setup.ts` for setup

## AF Integration

### MCP Tools (pro Agentic Flow)
- tf_list_projects (READ)
- tf_list_tenders (READ)
- tf_list_contacts (READ)
- tf_get_project_detail (READ)
- tf_get_schedule (READ)
- tf_get_tender_plan (READ)
- tf_create_bid (WRITE)

### Event Types
- com.tenderflow.demand.created
- com.tenderflow.document.uploaded

### Forbidden Actions
- DELETE any record
- UPDATE existing bids

## Attachment Rules
### Source Priority
- filesystem
### Folder Structure
- {project_id}/documents/
- {project_id}/offers/

## Business Rules
- Nabidka musi byt odeslana do 14 dnu od vytvoreni poptavky
- Maximum 5 dodavatelu na jednu poptavkovou kategorii
