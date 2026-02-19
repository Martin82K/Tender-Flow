# Architektura aplikace (inkrementální refaktor)

## Cíl
Tento dokument zavádí přehledné boundary vrstvy bez „big-bang“ přesunu celého repozitáře.

## Boundary vrstvy
- `app/`: composition root aplikace, routing orchestrace, shell/layout flow.
- `features/`: doménové moduly (postupná migrace).
- `shared/`: UI primitives, utility, cross-domain typy a helpery.
- `infra/`: integrační vrstva (Supabase, externí API, provider adaptéry).

## Import pravidla
- Preferované aliasy: `@app/*`, `@features/*`, `@shared/*`, `@infra/*`, `@/*`.
- `shared` nesmí importovat `features`.
- `app` může importovat všechny vrstvy, ale nesmí obsahovat business logiku domén.
- `infra` má izolovat přístupy na externí systémy (HTTP, storage, platform API).
- Web vrstvy (`app/`, `features/`, `shared/`) nesmí importovat `server/`, `desktop/main/`, `server_py/`, `mcp-bridge-server/`.
- V novém kódu nepoužívat deep relativní importy (`../../../` a hlubší); použít aliasy.
- `features/*` nesmí importovat `components/*` (legacy UI).
- UI vrstvy (`app/`, `features/`, `components/`, `hooks/`, `context/`, `shared/`) nesmí importovat `services/supabase` napřímo.
- Renderer vrstva nesmí používat `window.electronAPI` napřímo mimo `services/platformAdapter.ts`.

## Feature lifecycle kontrakt
- Registrace feature je deklarativní přes manifest:
  - `id`
  - `routes`
  - `navItems`
  - `requiredCapabilities`
  - `mount()`
  - `unmountSafeChecks()`
- Manifesty jsou centralizované v `app/featureRegistry/*`.
- Lazy loading view běží přes registry-driven mapu (`app/views/LazyViews.tsx`).

## Add/Remove Feature Safely
- Přidání feature:
  1. Vytvořit `features/<feature>/ui`, `features/<feature>/model`, `features/<feature>/api`, `features/<feature>/index.ts`.
  2. Přidat manifest do registry.
  3. Přidat capability/route guard.
- Odebrání feature:
  1. Odebrat manifest.
  2. Odstranit feature modul.
  3. CI musí projít bez runtime referencí (compile-time fail na zbylé importy).

## Auth/session source of truth
- `infra/auth/authSessionStore.ts` je jediný zdroj auth eventů (`onAuthStateChange`).
- UI/desktop synchronizace tokenu se napojuje přes store subscriber, ne přes vlastní listenery.

## Závazné guardrails
- `npm run check:boundaries`: statická kontrola import boundaries.
- `npm run check:legacy-structure`: kontrola freeze legacy roots.
- CI workflow `.github/workflows/quality.yml` je závazný gate pro PR.
- Přechodový architektonický dluh je veden v `config/architecture-boundary-allowlist.json`.
- Každá odstraněná violation musí odstranit odpovídající záznam z allowlistu.

## Legacy freeze
- Legacy roots: `components/`, `hooks/`, `services/`, `context/`, `utils/`.
- Snapshot je uložen v `config/legacy-freeze.json`.
- Přidání nového tracked souboru do legacy roots vyžaduje explicitní update snapshotu a code review.

## Excel nástroje
- `infra/excel-tools/*` definuje provider rozhraní pro merge/unlock.
- Režim přepínání přes `VITE_EXCEL_TOOLS_PROVIDER`:
  - `native`: lokální provider pro web/desktop.
  - `http`: vzdálený provider.
  - `hybrid` (default): merge native + unlock přes HTTP.

## Security baseline (server)
- CORS a `frame-ancestors` jsou konfigurovatelné přes env.
- Produkce defaultně neotevírá CORS globálně bez explicitního allowlistu.
- Vývoj defaultně zachovává kompatibilní režim (`*`) kvůli lokální integraci.

## Doporučené další kroky
1. Přesouvat doménové moduly z `components/*` do `features/*` po vertikálních řezech.
2. Rozdělit velké soubory (`Pipeline`, `ProjectOverviewNew`, `useAppData`) na container/hook/service vrstvy.
3. Snižovat podíl relativních importů ve prospěch aliasů `@app/@features/@shared/@infra`.
