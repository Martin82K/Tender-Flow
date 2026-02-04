# Repository Guidelines for Agents

## Snapshot
- Product: Tender Flow (full-stack CRM for construction tenders)
- Web stack: React 19 + TypeScript + Vite + Tailwind CSS
- Desktop stack: Electron 40 (main process in `desktop/main/`)
- Data: Supabase + React Query
- Path alias: `@/*` maps to repo root via `tsconfig.json`

## Project Structure & Entry Points
- Web entry: `index.tsx` → `App.tsx` → `components/providers/AppProviders`
- Routing: `components/routing/router.tsx` and `components/routing/routeUtils.ts`
- Feature areas: `components/`, `hooks/`, `context/`, `services/`, `utils/`, `config/`
- Types: `types.ts` and additional feature-specific types near usage
- Desktop app: `desktop/main/` (main/preload/IPC), build output in `desktop/dist/` and `dist-electron/`
- MCP bridge server: `mcp-bridge-server/` (launched via npm scripts)
- Tests: `tests/` with setup in `tests/setup.ts`
- Assets and static files: `assets/`, `public/`, `fonts/`, `docs/`
- Backend helpers: `server/`, `server.js`, `server_py/`, `mcp-bridge-server/`
- Migrations and seed data: `migrations/` (if present in a feature branch)

## Routing & Navigation
- App routes are built via `buildAppUrl` and parsed by `parseAppRoute`.
- Keep `View` identifiers aligned with `types.ts` and routing utilities.
- Use `navigate()` from `components/routing/router.tsx` for in-app navigation.
- Preserve query strings when redirecting to login (`next` query param).
- Prefer guard components like `RequireFeature` for feature gating.
- Desktop-only routing/redirect logic should be gated by `useDesktop()`.

## Build, Dev, and Ops Commands
- Install: `npm install`
- Web dev server: `npm run dev` (Vite, port 3000)
- Production build: `npm run build`
- Preview build: `npm run preview`
- Node server (if needed): `npm run start` (uses `server.js`)
- MCP bridge server: `npm run mcp:install` then `npm run mcp`
- User manual build: `npm run build:user-manual` (generates docs assets)
- Desktop compile: `npm run desktop:compile` (TS → `desktop/dist/`)
- Desktop dev: `npm run desktop:dev` (compile + launch Electron)
- Desktop build: `npm run desktop:build` (build web + Electron package)
- Platform builds: `npm run desktop:build:mac`, `npm run desktop:build:win`
- Release prep: `npm run release:prepare`
- Version bump (syncs `config/version.ts`): `npm run version:patch|minor|major`
- Supabase function deploys: `npm run deploy:stripe-webhook`, `npm run deploy:stripe-sync`

## Linting
- No explicit lint script in `package.json`.
- Match the surrounding file style; do not introduce formatting-only changes.
- Do not add Prettier/ESLint config or run formatters unless explicitly requested.

## Testing (Vitest + Testing Library)
- Watch mode: `npm test`
- One-off run: `npm run test:run`
- Coverage: `npm run test:coverage`
- Single test file: `npm run test:run -- tests/PriceListsSection.test.tsx`
- Single test by name: `npm run test:run -- -t "should render header"`
- Single test by name (watch): `npm test -- -t "should render header"`
- Prefer behavior-focused tests with Testing Library queries

## Code Style & Formatting
- TypeScript is strict in most subprojects; avoid `any` unless required.
- Use `import type` for type-only imports (common in hooks/services).
- Quotes are mixed across files; prefer the local file’s existing style.
- Indentation is mixed (2 or 4 spaces); follow the file you are editing.
- Use semicolons and trailing commas in multiline literals when present nearby.
- Keep JSX props aligned as in existing components; avoid aggressive refactors.
- Prefer `const` over `let` unless mutation is required.
- Keep functions small; extract helpers into `utils/` or `services/` when reused.
- Use `async/await` for asynchronous flows; avoid promise nesting.
- Favor early returns to keep conditional logic shallow.
- Prefer named exports unless the file already uses a default export pattern.

## Imports & Module Boundaries
- Import order: external packages → local modules → type-only imports.
- Prefer path alias `@/` when it improves clarity; otherwise use relative paths.
- Avoid circular dependencies between `components/`, `hooks/`, `services/`, and `context/`.
- Desktop-only code lives under `desktop/` and should not import web-only modules.
- Keep backend/server helpers in `server/` and avoid importing them into the web app.
- Use `window.electronAPI` only in desktop-safe paths or guarded branches.
- Do not import Tailwind config into runtime code.

## React & Component Conventions
- Components and files use `PascalCase` (e.g., `ProjectLayout.tsx`).
- Hooks are named `useX` and live in `hooks/` or near the feature.
- Keep state local when possible; shared state lives in contexts or React Query.
- Use early returns for guard conditions and loading/error branches.
- Clean up subscriptions in `useEffect` (see `App.tsx` patterns).
- Co-locate small UI helpers next to the component that owns them.
- Prefer controlled inputs with explicit `value` and `onChange`.
- Keep component props typed explicitly (avoid implicit `any`).
- Use `Suspense` + lazy loading patterns where already established.

## Types, Data, and State
- Core domain types live in `types.ts` (projects, contacts, bids, DocHub).
- Favor explicit interfaces and union types over loosely typed objects.
- Keep `View` and tab names aligned with `types.ts` and routing utilities.
- React Query is the preferred pattern for server state (`hooks/queries/`).
- When adding new types, update related service and UI layers together.
- Use `Partial<T>` or `Pick<T, K>` rather than re-declaring trimmed shapes.
- Keep Supabase payloads mapped into typed models at the service layer.
- Avoid exporting mutable objects from `config/` (prefer frozen constants).

## Styling (Tailwind CSS)
- Tailwind v4 utilities are used across the UI; keep classes declarative.
- Prefer existing UI primitives in `components/ui/` before new styling.
- When adding theme-related styles, update CSS variables or `useTheme`.
- Keep layout responsive using Tailwind breakpoints and `container` utilities.
- Use `clsx`/string templates sparingly; avoid large conditional class blobs.
- Avoid inline styles except for dynamic values that cannot be expressed in Tailwind.

## Error Handling & UX
- Guard against `null`/`undefined` inputs and missing DOM elements.
- Use `try/catch` only where runtime failure is expected; surface errors to UI.
- Prefer user-visible error states (modals, banners, loaders) over silent failures.
- Keep loading states explicit (skeletons, spinners, or loaders).
- Use `toast` or modal patterns from existing UI (do not add new libraries).
- When handling async actions, ensure buttons show disabled/loading feedback.

## Data Fetching & Persistence
- Supabase access is centralized in `services/` and hooked via React Query.
- Keep API calls out of components; use hooks/services instead.
- Respect optimistic updates and cache invalidation patterns already used.
- Use `localStorage` only for small user preferences (see `useTheme`).
- Avoid writing to the filesystem in the web app (desktop-only operations).

## Desktop/Electron Notes
- Main process types live in `desktop/main/types` and are shared via `import type`.
- Preload exposes `window.electronAPI`; gate usage with runtime checks.
- Keep desktop-specific code behind `useDesktop()` or `platformAdapter` checks.
- Main process TS compiles to CommonJS (`desktop/tsconfig.json`).
- IPC handlers live under `desktop/main/ipc/`; keep channels strongly typed.
- Avoid touching `dist-electron/` directly; it is generated output.

## Tests & Fixtures
- Tests live in `tests/` using `*.test.ts(x)` naming.
- Shared setup is in `tests/setup.ts`.
- Keep tests deterministic; avoid relying on real network or filesystem.
- Prefer `screen.getByRole`/`getByText` over query selectors.
- Mock Supabase or Electron APIs when needed in tests.
- Clean up timers or subscriptions in test teardown.

## Configuration & Secrets
- Local secrets live in `.env.local` (do not commit secrets).
- Prefer `config/` constants for feature flags and shared settings.
- If adding new env vars, document them in `README.md` or `docs/`.
- Avoid logging sensitive data; redact tokens in debug logs.

## Commits & PRs (if asked)
- Use short, lowercase, imperative messages (e.g., `fix contacts import`)
- Mention desktop/MCP impacts explicitly in PR descriptions.

## Repo-Specific Rules
- Cursor rules: none found in `.cursor/rules/` or `.cursorrules`.
- Copilot rules: none found in `.github/copilot-instructions.md`.
