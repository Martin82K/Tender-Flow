# Repository Guidelines

## Project Structure & Module Organization
- Entry points: `index.tsx` bootstraps `App.tsx` and routing; shared types in `types.ts`.
- UI and state live in `components/`, `hooks/`, `context/`, `services/`, `utils/`, and `config/`.
- Assets and static files: `assets/`, `public/`, `fonts/`, and `docs/`.
- Desktop app: `desktop/` (Electron main/preload/IPC), outputs in `desktop/dist/` and `dist-electron/`.
- Backend/server helpers: `server/`, `server.js`, `server_py/`, `mcp-bridge-server/`.
- Tests and fixtures: `tests/` with shared setup in `tests/setup.ts`; database migrations in `migrations/`.

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm run dev` starts the Vite dev server (web app).
- `npm run build` creates the production web build in `dist/`.
- `npm run preview` serves the production build locally.
- `npm run start` runs the Node server (`server.js`) when needed.
- `npm run desktop:dev` runs the Electron app after compiling main process.
- `npm run desktop:build` packages the desktop app for the current platform.
- `npm test` runs Vitest in watch mode; `npm run test:run` is single-run; `npm run test:coverage` includes coverage.
- `npm run mcp:install` and `npm run mcp` manage the MCP bridge server.

## Coding Style & Naming Conventions
- TypeScript + React with Tailwind; follow the existing 2-space indentation, double quotes, and semicolons.
- Components use `PascalCase` filenames (e.g., `ProjectLayout.tsx`); hooks use `useX` naming.
- Keep module names descriptive and colocate feature-specific subfolders (e.g., `components/documents/`).
- There is no dedicated formatter or linter script; match the surrounding style.

## Testing Guidelines
- Tests use Vitest and Testing Library; place specs in `tests/` with `*.test.ts(x)` naming.
- Prefer testing behaviors over implementation details; use `tests/setup.ts` for shared config.
- Run `npm run test:run` before opening a PR; include `test:coverage` for broader changes.

## Commit & Pull Request Guidelines
- Recent history uses short, lowercase subjects (e.g., `header move for macOS`) and version tags like `v1.1.5`.
- Use concise, imperative commit messages; include a scope when it adds clarity.
- PRs should include a brief summary, testing notes, and screenshots for UI changes.
- Link related issues and call out desktop/MCP impacts explicitly.

## Configuration & Secrets
- Local secrets live in `.env.local` (e.g., `GEMINI_API_KEY`); do not commit secrets.
- When adding new configuration, document it in `README.md` or `docs/`.
