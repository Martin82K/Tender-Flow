# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Tender Flow** is a full-stack CRM application for construction tender and project management, available as both a web application and Electron desktop app. The application helps manage projects, subcontractors/contacts, bidding pipelines, and document workflows.

**Tech Stack:**
- Frontend: React 19 + TypeScript, Vite, Tailwind CSS
- Backend: Supabase (PostgreSQL), Vercel (hosting)
- Desktop: Electron 40
- Additional: MCP Bridge Server for local filesystem access

## Development Commands

### Web Development
```bash
npm run dev              # Start dev server on port 3000
npm run build            # Production build
npm run preview          # Preview production build
```

### Desktop (Electron) Development
```bash
npm run desktop:compile  # Compile Electron TypeScript
npm run desktop:dev      # Run Electron app in dev mode
npm run desktop:build    # Build desktop app for current platform
npm run desktop:build:mac  # Build for macOS
npm run desktop:build:win  # Build for Windows
```

### Testing
```bash
npm test                 # Run tests in watch mode
npm run test:run         # Run tests once
npm run test:coverage    # Run tests with coverage
```

### MCP Bridge Server
The MCP Bridge Server enables local filesystem access for DocHub features in the desktop app.

```bash
npm run mcp:install      # Install MCP bridge dependencies
npm run mcp              # Start MCP bridge server
```

### Version Management
```bash
npm run version:patch    # Bump patch version (1.1.5 → 1.1.6)
npm run version:minor    # Bump minor version (1.1.5 → 1.2.0)
npm run version:major    # Bump major version (1.1.5 → 2.0.0)
```

Version bumps automatically sync across package.json and config/version.ts.

### Other
```bash
npm run build:user-manual  # Build user manual documentation
npm run release:prepare    # Prepare release artifacts
```

## Architecture Overview

### Application Entry & Routing

**Main Entry:** `index.tsx` → `App.tsx` → `AppProviders` (context wrappers) → `AppContent`

**Routing:** Custom client-side router in `components/routing/`:
- `router.tsx` - Core routing primitives (useLocation, navigate)
- `routeUtils.ts` - URL building/parsing for app routes
- Routes are synced to URL, with pattern: `/app/{view}?projectId=...&tab=...&categoryId=...`

**Views:** Defined in `types.ts` as `View` type:
- `dashboard` - Main overview
- `project` - Project detail (with tabs: overview, tender-plan, pipeline, schedule, documents)
- `contacts` - Contact management
- `settings` - User settings
- `project-management` - Project CRUD
- `project-overview` - Advanced reporting
- `url-shortener` - URL shortening tool

### State Management

**Primary Data Hook:** `useAppData` (hooks/useAppData.ts)
- Centralized state for projects, contacts, project details, statuses
- Loads initial data from Supabase on mount
- Provides `state` and `actions` for all CRUD operations
- Uses React Query for server state management

**Context Providers:**
- `AuthContext` - User authentication, session, preferences
- `UIContext` - Modal state, notifications
- `FeatureContext` - Feature flags based on subscription tier

**Desktop State:** `useDesktop` hook - Electron-specific features (welcome screen, folder selection, updates)

### Data Model

Core types in `types.ts`:

**Project Hierarchy:**
```
Project
├── ProjectDetails (metadata, financials, documents)
│   └── DemandCategory[] (tender categories)
│       └── Bid[] (subcontractor bids per category)
├── TenderPlanItem[] (schedule items)
└── DocumentLink[] (multi-link document management)
```

**Contacts/Subcontractors:**
- `Subcontractor` - Company with contacts, specialization, status
- `ContactPerson` - Individual contact within company
- `StatusConfig` - Dynamic status labels/colors

**User & Subscriptions:**
- `User` - with role (admin/user/demo) and subscriptionTier
- Subscription tiers: demo, free, pro, enterprise, admin
- Feature flags defined in `config/features.ts`, checked with `RequireFeature` component

### Services Layer

**Key Services (services/ directory):**
- `supabase.ts` - Supabase client initialization
- `authService.ts` - Authentication operations
- `projectService.ts` - Project CRUD
- `documentService.ts` - Document management
- `emailService.ts` - Email generation (mailto/eml)
- `inquiryService.ts` - Tender inquiry email generation
- `templateService.ts` - Email template management
- `subscriptionFeaturesService.ts` - Feature flag checks
- `mcpBridgeClient.ts` - Communication with MCP bridge server
- `fileSystemService.ts` - Desktop filesystem operations
- `excelMergerService.ts` - Excel merge tool integration
- `urlShortenerService.ts` - URL shortening (TinyURL)
- `geminiService.ts` - AI-powered insights using Google Gemini

**Platform Abstraction:**
- `platformAdapter.ts` - Detects web vs desktop environment
- `toolsAdapter.ts` - Adapts tool integrations based on platform

### Component Structure

**Layout Components:**
- `MainLayout` - Authenticated app shell (sidebar, header, content)
- `AuthLayout` - Login/register wrapper
- `PublicLayout` - Public pages (landing)

**Major Feature Components:**
- `Dashboard` - Project cards and overview
- `ProjectLayout` - Project detail container with tabs
- `ProjectManager` - Project CRUD interface
- `Contacts` - Contact/subcontractor management
- `Settings` - User preferences, statuses, admin tools
- `Pipeline` / `pipelineComponents/` - Kanban-style bid tracking
- `ProjectDocuments` / `documents/` - Document links, templates, price lists, DocHub integration
- `TenderPlan` - Schedule/timeline management

**UI Components (components/ui/):**
- Reusable primitives: Button, Input, Modal, Card, Badge
- `SkeletonLoader` - Loading states

### Backend & Serverless

**Supabase:**
- PostgreSQL database with Row-Level Security (RLS)
- Real-time subscriptions not currently used extensively
- Schema managed via migrations in `migrations/`

### Desktop (Electron) Architecture

**Structure:**
- `desktop/main/main.ts` - Electron main process
- `desktop/main/preload.ts` - Preload script (exposes `window.electronAPI`)
- `desktop/main/ipc/` - IPC handlers for desktop features
- `desktop/main/services/` - Desktop-only services (filesystem, updates)

**Desktop Features:**
- Auto-updates via electron-updater (GitHub releases)
- Local filesystem access for DocHub
- Project folder selection and file organization
- MCP Bridge Server integration for advanced filesystem ops

**Build Output:**
- `desktop/dist/` - Compiled TypeScript (main process)
- `dist/` - Vite build (renderer)
- `dist-electron/` - Final Electron app packages

### DocHub Integration

**DocHub** is a document management module for organizing project files in cloud storage (Google Drive, OneDrive) or local filesystem.

**Key Concepts:**
- Projects can enable DocHub with a root folder link
- Auto-create feature generates standardized folder structure
- Structure versioning (currently v1) for future migrations
- Providers: gdrive, onedrive, local, mcp
- Reconciliation: Syncs existing folders with expected structure

**Related Files:**
- `useDocHubIntegration.ts` - Main DocHub hook
- `components/projectLayoutComponents/documents/` - DocHub UI components
- `mcpBridgeClient.ts` - MCP filesystem bridge client

### Feature Flags & Subscriptions

Feature access is controlled by subscription tiers:
- Feature definitions: `config/features.ts`
- Tier definitions: `config/subscriptionTiers.ts`
- Check feature access: `useFeature` hook or `<RequireFeature>` component
- Server-side checks: `subscriptionFeaturesService.ts`

**Example:**
```tsx
<RequireFeature feature={FEATURES.MODULE_PROJECTS}>
  <ProjectLayout {...props} />
</RequireFeature>
```

## Configuration Files

- `vite.config.ts` - Vite build config, proxies for Python backend
- `vitest.config.ts` - Test configuration
- `tsconfig.json` - TypeScript config with path alias `@/*`
- `desktop/electron-builder.yml` - Electron packaging config
- `.env.local` - Local environment variables (GEMINI_API_KEY, etc.) - not committed

## Testing

Tests use Vitest + Testing Library:
- Test files: `**/*.{test,spec}.{ts,tsx}`
- Setup: `tests/setup.ts`
- Run individual test: `npm test -- path/to/test.test.tsx`

## Code Patterns

**Data Fetching:**
- Use React Query (`@tanstack/react-query`) for server state
- Query hooks in `hooks/queries/`, mutation hooks in `hooks/mutations/`
- Query client configured in `services/queryClient.ts`

**Forms & User Input:**
- Controlled components with local state
- Validation typically inline
- Tailwind CSS for styling (Tailwind v4)

**Error Handling:**
- UI modals via `useUI` context
- Loading states in `useAppData`
- Toast notifications for async operations

**TypeScript:**
- Strict mode enabled
- All major types in `types.ts`
- Additional type definitions in service files

## Important Conventions

- **Views** are top-level app sections, **tabs** are within a project view
- **Categories** (DemandCategory) represent tender line items, **bids** are subcontractor offers per category
- Always use `navigate` from `components/routing/router` for client-side navigation
- Use `buildAppUrl` from `routeUtils` to construct app URLs programmatically
- Desktop-specific code should check `isDesktop` from `useDesktop` or `platformAdapter`
- Feature-gated code should use `RequireFeature` component or `useFeature` hook
- Version bumping must use npm scripts to keep version.ts in sync