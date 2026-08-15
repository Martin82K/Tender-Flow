# Systémový přehled

## Účel systému

Tender Flow sjednocuje přípravu stavebních výběrových řízení, správu realizací,
kontakty dodavatelů, komunikaci, dokumenty, smlouvy, úkoly a provozní nástroje.
Jedna codebase obsluhuje webovou a desktopovou variantu; platformní rozdíly jsou
izolované adaptéry a Electron IPC.

## Runtime povrchy

| Povrch | Vstup | Odpovědnost |
| --- | --- | --- |
| Web SPA | `index.tsx` → `app/AppShell.tsx` | UI, navigace, React Query, browser integrace |
| Electron renderer | stejný webový build | UI s bezpečně vystaveným `window.electronAPI` |
| Electron main | `desktop/main/main.ts` | okna, IPC, soubory, secure storage a updater |
| Node server | `server.js` | statické hostování a serverové pomocné endpointy |
| Supabase | `supabase/` | Auth, Postgres, RLS, Storage, Realtime, RPC a Edge Functions |
| MCP server | `server/mcp/` + `mcp-service/` | kanonické MCP 2.0 nástroje pro remote HTTP a stdio klienty |
| Excel pomocné služby | `server/excel_tools_api/`, `server_py/` | merge/unlock a specializované zpracování souborů |

## Hlavní tok webové aplikace

```text
index.tsx
  -> AppShell
     -> AppProviders
        -> QueryClientProvider
        -> AuthProvider
        -> UIProvider
        -> FeatureProvider
     -> AppContent
        -> route/auth/legal/feature guards
        -> lazy-loaded feature view
        -> feature hook/API
        -> infra nebo legacy service adapter
        -> Supabase / Edge Function / platformAdapter
```

## Vrstvy

| Vrstva | Cesta | Pravidlo |
| --- | --- | --- |
| Composition root | `app/` | skládá providers, views a globální lifecycle |
| Doménové features | `features/` | vlastní UI, modely, hooky a feature API |
| Sdílené moduly | `shared/` | typy, UI primitiva a doménově neutrální utility |
| Infrastruktura | `infra/` | platformní, databázové a externí adaptéry |
| Legacy vrstva | `components/`, `hooks/`, `services/`, `context/`, `utils/` | freeze; pouze řízená migrace a kompatibilní shimy |
| Desktop main | `desktop/main/` | důvěryhodný Electron proces, mimo webový bundle |
| Server | `server/`, `server_py/`, `supabase/functions/` | neveřejné runtime implementace |

Webové vrstvy nesmí importovat `desktop/main/`, `server/` ani `server_py/`.
Kontroluje to `npm run check:boundaries`. Stejný guard porovnává každou přesnou
vazbu z `app/features/shared/infra` do legacy kořenů s ratchet baseline v
`config/legacy-import-baseline.json`. Nová vazba i zastaralá baseline položka
kontrolu shodí. Quality workflow navíc porovnává baseline s výchozí Git revizí,
takže ji PR smí pouze zmenšit. Přesný snapshot tracked souborů v legacy kořenech kontroluje
`npm run check:legacy-structure`; odstraněný soubor proto musí být současně
odebrán z `config/legacy-freeze.json`.

## Stav a data

- Serverový stav spravuje TanStack React Query.
- Identitu a session poskytuje `AuthContext` nad Supabase Auth.
- Feature dostupnost poskytuje `FeatureContext` podle tarifu a backendových
  override hodnot.
- Globální modální UI stav poskytuje `UIContext`.
- Lokální stav obrazovek zůstává v komponentách nebo feature hookách.
- Desktopové funkce se volají přes `platformAdapter`/`window.electronAPI`, nikdy
  přímým importem main procesu.

## Klíčové datové toky

### Přihlášení

UI → `AuthContext` → `authService`/`authSessionService` → Supabase Auth. Desktop
může session token předat main procesu pouze přes autorizované IPC rozhraní.

### Projekty

Feature query → `infra/db/dbAdapter` → tabulka `projects` + metadata RPC → čisté
mapování viditelnosti → React Query cache → projektové views.

### Serverová akce

Feature API → `functionsClient` → Supabase Edge Function. Edge Function ověřuje
identity/role podle svého kontraktu a pracuje se serverovými secrets.

### Desktopová akce

Renderer → platform adapter → preload API → IPC handler → main service. IPC
handler validuje vstup i autorizaci; výsledek vrací serializovatelný kontrakt.

## Architektonický přechod

Repozitář je v postupné migraci z legacy kořenů do `app/features/shared/infra`.
Audit přes `npm run audit:architecture` zůstává informativním rozborem známých
kategorií dluhu. Vynucovaný importní baseline je přesná množina souboru,
specifieru a cíle, nikoli pouze celkový počet; migrace jej musí zmenšovat a
nemůže starou vazbu vyměnit za novou. Nové soubory ve frozen legacy kořenech
nejsou povolené bez explicitního rozhodnutí.
