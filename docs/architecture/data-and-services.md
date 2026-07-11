# Data a serverové služby

## Přehled

Primární cloudový backend je Supabase. Repozitář obsahuje také Electron main
služby, Node MCP/statický server a pomocné Excel služby. Tyto runtime se nesmí
míchat do webového bundle.

## Supabase

Adresář `supabase/` obsahuje:

- migrace databázového schématu a politik,
- Edge Functions,
- sdílené Edge utility,
- manuální provozní SQL nebo poznámky.

V repozitáři je více než 200 historických migrací. Finální schéma je výsledkem
jejich pořadí, ne jednoho vybraného souboru.

### Klient

Browser/Electron renderer inicializuje klienta v `services/supabase.ts` pomocí
veřejné Supabase URL a anon/publishable klíče. Přímé použití klienta je legacy
hranice; nové feature query mají používat `infra/db/dbAdapter.ts`, feature API
nebo specializovaný repository.

`services/dbAdapter.ts` poskytuje:

- tabulkové query přes `from`,
- Edge Functions klienta,
- RPC přes Supabase SDK,
- REST fallback pro RPC s aktuálním access tokenem.

### Datové mechanismy

- Postgres tabulky a views,
- RPC funkce pro atomické nebo privilegované operace,
- RLS pro řádkovou autorizaci,
- Realtime pro notifikace a subscription události,
- Storage pro dokumenty a integrační artefakty,
- Edge Functions pro secrets, externí API a serverové workflow.

### Edge Functions

Funkce pokrývají zejména:

- password reset a MFA administraci,
- AI proxy, voice/realtime a textové odpovědi,
- DocHub OAuth, složky, linky a synchronizaci,
- e-mail,
- Excel merge,
- mapový proxy přístup,
- MCP read/write nástroje,
- Stripe checkout, synchronizaci a webhooky,
- URL zkracování,
- bezpečné kontraktové markdown operace.

Funkce s `verify_jwt = false` jsou veřejné vstupní body nebo OAuth callbacky a
musí provádět vlastní validaci tokenu, jednorázového kódu, originu či state
parametru. Tento flag neznamená automaticky veřejné oprávnění ke všem datům.

## Autorizace dat

RLS je primární hranice pro data dostupná přes Supabase Data API. UI gating a
klientské filtrování jsou pouze defense-in-depth.

Zásady:

- vlastnictví se váže na `auth.uid()`, organizaci nebo explicitní share,
- frontend nesmí používat `service_role`,
- `SECURITY DEFINER` RPC musí mít omezené grants, řízený `search_path` a vlastní
  kontrolu identity,
- serverový secret nesmí být předaný do rendereru,
- pozdější migrace nesmí znovu otevřít starý ownerless/org-wide fallback.

Živé databázové RLS integrační testy nejsou aktuálně součástí CI na základě
vědomého rozhodnutí projektu. Existující security testy kontrolují migrační
kontrakty staticky; toto omezení je uvedené také ve známých omezeních.

## TanStack React Query

React Query je cache a orchestrace, nikoli autorizační vrstva. Query key musí
obsahovat identitu nebo doménový scope tam, kde by se jinak cache mohla sdílet
mezi uživateli/projekty. Při logoutu nebo kritické auth invalidaci se cache čistí.

## MCP

MCP implementace existuje ve dvou formách:

- `server/mcp/` pro Node/hosting scénáře,
- `desktop/main/services/mcpServer.ts` pro desktop.

Nástroje používají Supabase autentizaci, rate limit, response helpery a podle
konfigurace read-only režim. Consent route je `/oauth/consent`. Přístupové tokeny
se neposílají do logů ani dokumentace.

## Node server

`server.js` je startovaný přes `npm run start`. `server/` obsahuje bezpečnostní
hlavičky, MCP handler a Excel tools API. Přesné hostingové použití se musí
ověřit proti cílové platformě; webový produkční build je statický `dist/`.

## Excel služby

- `server/excel_tools_api/`: TypeScript/Node implementace merge a bezpečnostních
  kontrol.
- `server_py/excel_merge_tool/`: Python merge nástroj.
- `server_py/excel_unlock_api/`: Python API pro unlock scénář.
- `infra/excel-tools/`: klientský resolver mezi HTTP a nativním providerem.

Volba provideru je konfigurovaná přes veřejné Excel tools proměnné. Citlivé
operace se nemají provádět v browseru, pokud vyžadují serverový secret nebo
neomezený filesystem.

## Externí integrace

- Supabase
- Stripe
- Google a Microsoft OAuth pro DocHub
- e-mail provider (Resend)
- mapové/geokódovací služby
- OpenAI/Google AI podle konkrétní feature
- PostHog se souhlasem uživatele
- ARES a další veřejné registry podle služby

Každá integrace musí mít timeout, sanitizaci chyb, jasný fallback a oddělené
veřejné/serverové credentials.
