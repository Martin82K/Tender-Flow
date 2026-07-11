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
| Electron main | `desktop/main/main.ts` | okna, IPC, soubory, secure storage, updater, MCP |
| Node server | `server.js` | statické hostování a serverové pomocné endpointy |
| Supabase | `supabase/` | Auth, Postgres, RLS, Storage, Realtime, RPC a Edge Functions |
| MCP server | `server/mcp/` a desktop služba | omezené nástroje pro externí klienty a desktop |
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
Kontroluje to `npm run check:boundaries`. Přidání souboru do legacy kořene
kontroluje `npm run check:legacy-structure`.

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
Audit je informativní a spouští se přes `npm run audit:architecture`. Nové změny
nemají zvyšovat počet přechodových vazeb ani přidávat další soubory do frozen
legacy kořenů bez explicitního rozhodnutí.
