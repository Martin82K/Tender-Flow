# Repository Guidelines for Agents

## Snapshot
- Product: Tender Flow (full-stack CRM for construction tenders).
- Frontend: React 19 + TypeScript + Vite + Tailwind CSS v4.
- Desktop: Electron 40 (`desktop/main/` main process, preload + IPC).
- Data/state: Supabase + TanStack React Query.
- Path alias: `@/*` maps to repository root (see `tsconfig.json`).

## Key Paths
- Web entry flow: `index.tsx` -> `App.tsx` -> `components/providers/AppProviders`.
- Routing: `components/routing/router.tsx` + `components/routing/routeUtils.ts`.
- Feature folders: `components/`, `hooks/`, `context/`, `services/`, `utils/`, `config/`.
- Global/domain types: `types.ts` and feature-local type files.
- Tests: `tests/` with shared setup in `tests/setup.ts`.
- Desktop code: `desktop/main/` (compiled output in `desktop/dist/`, packaging output in `dist-electron/`).
- Server-side helpers: `server/`, `server.js`, `server_py/`, `mcp-bridge-server/`.

## Build, Dev, and Ops Commands
- Install deps: `npm install`
- Web dev server: `npm run dev`
- Production web build: `npm run build`
- Preview production build: `npm run preview`
- Start node server: `npm run start`
- Build docs/user manual assets: `npm run build:user-manual`
- MCP bridge install/start: `npm run mcp:install` then `npm run mcp`
- Desktop TS compile: `npm run desktop:compile`
- Desktop dev run: `npm run desktop:dev`
- Desktop package build: `npm run desktop:build`
- Platform desktop build: `npm run desktop:build:mac` / `npm run desktop:build:win`
- Release prep: `npm run release:prepare`
- Version sync script: `npm run version:patch|minor|major`

## Linting and Type Checks
- No dedicated lint script exists in root `package.json`.
- Do not introduce a new formatter or lint config unless explicitly asked.
- Keep formatting changes minimal and scoped to edited lines.
- If a sanity type check is needed, prefer existing compile commands over adding new scripts.

## Test Commands (Vitest)
- Run in watch mode: `npm test`
- Run all tests once: `npm run test:run`
- Run with coverage: `npm run test:coverage`
- Run one file: `npm run test:run -- tests/PriceListsSection.test.tsx`
- Run multiple files by path: `npm run test:run -- tests/a.test.ts tests/b.test.ts`
- Run by test name pattern: `npm run test:run -- -t "should render header"`
- Run by test name in watch mode: `npm test -- -t "should render header"`
- Prefer single-file or `-t` runs while iterating, then run full suite before handoff.

## Routing and Navigation Rules
- Build URLs with `buildAppUrl`; parse with `parseAppRoute`.
- Keep `View` identifiers aligned with `types.ts` and routing utilities.
- Use `navigate()` from `components/routing/router.tsx` for internal navigation.
- Preserve login redirect query (`next`) when redirecting unauthenticated users.
- Use guard components (for example `RequireFeature`) for feature gating.
- Gate desktop-only routing behavior with `useDesktop()` or platform checks.

## Code Style and Formatting
- Use strict, explicit TypeScript types; avoid `any` unless unavoidable.
- Use `import type` for type-only imports.
- Follow local file conventions for quotes, semicolons, and indentation (2 vs 4 spaces).
- Prefer `const`; only use `let` for true mutation.
- Keep functions focused and small; extract shared helpers to `utils/` or `services/`.
- Prefer early returns over deep conditional nesting.
- Use `async/await` over chained `then()` for readability.
- Avoid formatting-only churn and avoid broad refactors without request.

## Naming Conventions
- Components, screens, and context providers: `PascalCase` file and symbol names.
- Hooks: `useX` naming (`useContacts`, `useDesktop`), with one clear purpose per hook.
- Utility and service modules: descriptive `camelCase` exports over vague names.
- Type names: `PascalCase`; prefer domain language (`TenderStatus`, `ProjectView`).
- Constants: `UPPER_SNAKE_CASE` for true constants, otherwise `camelCase` readonly values.
- Test names: behavior-first phrasing (`should ...` / `renders ... when ...`).

## Agent Working Norms
- Read nearby code before editing; mirror local patterns instead of applying global preferences.
- Keep diffs scoped to the task; avoid opportunistic rewrites.
- Update related types/tests when changing behavior or public contracts.
- Prefer additive, reversible changes over risky broad edits.
- When uncertain, choose the least surprising implementation for existing users.

## Imports and Module Boundaries
- Preferred order: external packages -> local modules -> type-only imports.
- Use `@/` aliases when clarity improves; otherwise use simple relative imports.
- Avoid circular dependencies, especially across `components/`, `hooks/`, `context/`, and `services/`.
- Do not import server-only modules into web UI code.
- Keep desktop-specific logic in `desktop/` or guarded runtime branches.
- Only use `window.electronAPI` in desktop-safe code paths.

## React and Component Conventions
- Components/files: PascalCase (for example `ProjectLayout.tsx`).
- Hooks: `useX` naming, located in `hooks/` or alongside feature code.
- Prefer local component state unless data is shared across screens.
- Server state belongs in React Query hooks (see `hooks/queries/`).
- Keep props explicitly typed; no implicit `any`.
- Use controlled inputs (`value` + `onChange`) for form fields.
- Clean up subscriptions/effects in `useEffect` teardown.
- Reuse existing UI primitives in `components/ui/` before creating new ones.

## Types, Data, and Services
- Keep domain model truth in `types.ts` and update dependent layers together.
- Favor interfaces/unions and utility types (`Pick`, `Partial`) over duplicate shapes.
- Map Supabase responses into typed app models inside service/query layers.
- Keep API access in `services/` and custom hooks, not directly in components.
- Respect existing React Query invalidation and optimistic update patterns.
- Avoid mutable exported config objects; prefer constants.

## Styling Guidelines
- Use existing Tailwind v4 utility patterns and current design tokens.
- Prefer class-based styling; avoid inline styles except truly dynamic values.
- Keep responsive behavior explicit with breakpoints and container utilities.
- Avoid giant conditional class strings when simpler decomposition is possible.
- If theming is touched, update established CSS variables and theme hooks.

## Error Handling and UX
- Guard against null/undefined and missing DOM or API payload fields.
- Use `try/catch` where failure is expected and recoverable.
- Show actionable user-facing error states; avoid silent failures.
- Keep loading and disabled states explicit during async actions.
- Reuse existing toast/modal/loading patterns; do not add new alert libraries.

## Desktop/Electron Notes
- Main process TS sources live in `desktop/main/` and compile to CommonJS.
- IPC handlers belong in `desktop/main/ipc/` and should remain strongly typed.
- Never edit generated outputs in `desktop/dist/` or `dist-electron/` manually.
- Web code must not assume Electron availability without runtime guards.

## Tests and Fixtures
- Test files use `*.test.ts` / `*.test.tsx` naming under `tests/`.
- Keep tests deterministic; mock network, Supabase, and Electron APIs as needed.
- Prefer Testing Library queries by role/text over implementation details.
- Clean up timers, subscriptions, and mocks in teardown/setup helpers.

## Secrets and Configuration
- Store local secrets in `.env.local`; never commit credentials.
- Document newly required env vars in `README.md` or `docs/`.
- Avoid printing tokens/secrets in logs or thrown errors.

## Commit and PR Conventions
- Commit messages: short, lowercase, imperative (for example `fix contacts import`).
- Keep PR scope focused; describe user impact and risk clearly.
- Call out desktop, migrations, or MCP bridge impacts explicitly.

## Agent-Specific Repo Rules
- Cursor rules check: no rules found in `.cursor/rules/`.
- Cursor legacy rules check: no `.cursorrules` file found.
- Copilot rules check: no `.github/copilot-instructions.md` found.
- If any of these files are added later, agents should treat them as higher-priority guidance.
