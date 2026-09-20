# Repository Guidelines for Agents

## Core Agent Instructions
- Always respond in Czech.
- Check your own conclusions and verify that statements are true before presenting them as facts.
- Plan and discuss the plan before starting build or implementation work.
- Write tests for behavior changes and verify code quality with the relevant project commands.
- Review solutions from a cybersecurity perspective and avoid unsafe designs.
- There is no minimum package age and no 14-day waiting rule. Package age alone must never be used to approve, reject, or postpone an installation.
- Before installing or updating a package, perform a supply-chain security review: verify registry integrity, signatures/provenance when available, repository and maintainer history, release history and publication anomalies, known vulnerabilities, and reported compromise or malware incidents. After installation, verify the resolved lockfile diff, run dependency audits, verify registry signatures/provenance, and exercise the affected runtime path.

## Autonomous Development Loop
- Before starting a coherent scope of work, report the plan, why it matters, proposed changes, validation, and risks. One approval of that concrete scope covers the whole work cycle, including ordinary fixes, review feedback, and validation. Ask again only for a material change in scope or risk, not for each subproblem or routine step.
- Before implementation, check open pull requests, new cybersecurity reviews, unresolved review threads, and failing CI checks. Record unavailable or disabled security signals as residual risk.
- For each problem: inspect current behavior and root cause; write an impact-based validation plan; for behavior changes add a focused regression test and capture the expected RED result; implement the smallest safe fix; preserve legacy behavior unless removal was explicitly approved; update relevant documentation. Purely visual or documentation-only changes do not require new behavioral tests.
- During iterations, choose validation by actual impact. For purely visual changes, inspect affected screens and relevant responsive layouts, focus states, and readability. For behavior changes, run focused regression tests and exercise the affected functional flow. For documentation-only changes, review consistency, links, and the diff; product tests/builds and application startup are not required locally. Changes to permissions, data, imports/module boundaries, migrations, dependencies, or build configuration require corresponding deeper checks; classify mixed changes by all affected areas.
- Run local typecheck, web build, desktop compile/package, and runtime smoke tests when the affected code or configuration warrants them. For runtime changes, check loading, the affected primary flow, navigation, console/network errors, and visual output; exercise Electron when desktop behavior or shared renderer/build changes affect it and the environment permits it. Cosmetic changes alone do not require a desktop build. Release artifact verification remains mandatory under Release Rules.
- Assess security risks of the actual diff locally, including relevant permissions, tenant isolation, secrets, and supply-chain risks. Preserve the independent PR security review; do not repeat a broad audit without a relevant change or concrete new finding. Never weaken tenant isolation, secret protection, migration safeguards, or dependency verification to reduce validation cost.
- Keep the complete automatic suite as the final CI gate before merge: tests, typecheck, web build, documentation, boundary, legacy-structure checks, and all other configured CI checks remain required. Do not duplicate an identical successful CI check locally for the same revision. Desktop validation during local iteration follows impact; existing CI desktop checks remain unchanged.
- Record each validation result with its command/check, scope, tested commit (or working-tree diff), integration base, and outcome. Inspect logs, test counts, skipped/todo tests, stderr, warnings, and scenario relevance. Reuse successful evidence unless relevant code, configuration, dependencies, integration base, or a concrete new finding invalidates it; rerun only affected checks locally. Required CI checks must still pass for the final PR revision and applicable integration base. Missing evidence is not a pass.
- Use an isolated `codex/` branch and make small, meaningful commits throughout the approved work, staging only in-scope files. Use one PR for one coherent, reviewable outcome, not one PR per subproblem; related UI changes and tests belong together, and address review feedback with further commits in the same open PR. Separate unrelated work or independently deployable high-risk changes; avoid oversized bundles. When impact-based local validation is clean, push the branch and open or update the ready PR. Wait for GitHub Actions, Vercel, independent security review, and review threads; fix concrete failures and repeat affected validation. Merge only after demonstrably green final checks and resolved actionable review findings. Record unavailable security signals as residual risk; do not claim an unavailable review passed.
- After merge, verify the pull request state, synchronize `main`, and preserve unrelated local changes. Close the loop with a summary of the PR, manual user checks, passed tests, and remaining risks; then stop when the approved scope is complete. Request approval for a new scope or material risk change, not another routine iteration within the existing approval.
- For database changes, additionally audit migrations; run preflight and dry-run; verify RLS, grants, indexes, foreign keys, backfills, and expected counts; deploy only versioned migrations; verify catalog and data state after deploy; run security and performance advisors; and require a final dry-run that reports the database is current.

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
- Server-side helpers: `server/`, `server.js`, `server_py/`.

## Build, Dev, and Ops Commands
- Install deps: `npm install`
- Web dev server: `npm run dev`
- Production web build: `npm run build`
- Preview production build: `npm run preview`
- Start node server: `npm run start`
- Build docs/user manual assets: `npm run build:user-manual`
- Desktop TS compile: `npm run desktop:compile`
- Desktop dev run: `npm run desktop:dev`
- Desktop package build: `npm run desktop:build`
- Platform desktop build: `npm run desktop:build:mac` / `npm run desktop:build:win`
- Release prep: `npm run release:prepare`
- Version sync script: `npm run version:patch|minor|major`

## Release Rules
- Tender Flow release assets must always be uploaded from locally built artifacts.
- Do not let GitHub Actions attach or overwrite files in GitHub Releases.
- CI may build desktop artifacts for validation or downloadable workflow artifacts, but release drafts must receive `.exe`, `.dmg`, `.zip`, blockmap, and latest YAML files only from the local `dist-electron/` output after local verification.

## Supabase and Docker
- Docker is not a project runtime or deployment requirement for Tender Flow.
- Supabase CLI may mention Docker because it uses containers for local Supabase stack commands such as `supabase start`, local DB reset, or local function serving.
- For deploying Edge Functions to the linked cloud project, prefer API-based deploys (for example `supabase functions deploy <name> --use-api`) and keep function JWT settings in each function's `config.toml` where applicable.
- Do not treat "Docker is not running" CLI output as an application failure unless the task explicitly depends on local Supabase emulation.

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
- Prefer single-file or `-t` runs for affected behavior during iterations. Before merge, verify the full CI suite for the final revision; reuse valid results as specified in Autonomous Development Loop.

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
- Prefer canonical aliases: `@app/*`, `@features/*`, `@shared/*`, `@infra/*` (fallback `@/*`).
- Avoid deep relative imports (`../../../` and deeper) in `app/`, `features/`, `shared/`.
- Avoid circular dependencies, especially across `features/`, `shared/`, `hooks/`, `context/`, and `services/`.
- Do not import server-only modules into web UI code.
- Keep desktop-specific logic in `desktop/` or guarded runtime branches.
- Only use `window.electronAPI` in desktop-safe code paths.
- Web layers (`app/`, `features/`, `shared/`) must not import from `server/`, `desktop/main/`, or `server_py/`.

## React and Component Conventions
- Components/files: PascalCase (for example `ProjectLayout.tsx`).
- Hooks: `useX` naming, located in `hooks/` or alongside feature code.
- Prefer local component state unless data is shared across screens.
- Server state belongs in React Query hooks (see `hooks/queries/`).
- Keep props explicitly typed; no implicit `any`.
- Use controlled inputs (`value` + `onChange`) for form fields.
- Clean up subscriptions/effects in `useEffect` teardown.
- Reuse existing UI primitives in `shared/ui/` before creating new ones.

## Refactor Guardrails
- Legacy roots (`components/`, `hooks/`, `services/`, `context/`, `utils/`) jsou ve freeze režimu.
- Před merge musí projít: `npm run check:boundaries` a `npm run check:legacy-structure`.
- Pokud je nutné přidat soubor do freeze roots, musí být explicitně aktualizován `config/legacy-freeze.json`.

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
- Call out desktop and migrations impacts explicitly.

## Agent-Specific Repo Rules
- Cursor rules check: no rules found in `.cursor/rules/`.
- Cursor legacy rules check: no `.cursorrules` file found.
- Copilot rules check: no `.github/copilot-instructions.md` found.
- If any of these files are added later, agents should treat them as higher-priority guidance.
