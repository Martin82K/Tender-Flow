# MCP changelog

Formát zaznamenává uživatelsky nebo integračně významné změny. Git historie je
detailní zdroj jednotlivých diffů.

## 2026-08-24 — privátní konektor Grok Bot

- Přidán ručně registrovaný veřejný OAuth klient pro privátní Grok Bot / Cursor
  Agents konektor s přesnými desktopovou loopback a webovou callback URI a
  PKCE S256.
- Klient dostává kanonický MCP resource claim pouze přes autoritativní
  `mcp_oauth_client_resources`; Dynamic Client Registration zůstává vypnutá.
- Contacts a write oprávnění zůstávají po prvním připojení vypnutá a vyžadují
  samostatný uživatelský grant v Tender Flow.

## 2026-08-11 — doménové moduly MCP 2.0

- centrální server factory již neobsahuje business tool handlery a skládá
  explicitní moduly discovery, projekty, VŘ, smlouvy, subdodavatelé, úkoly,
  Outlook a potvrzované změny,
- všechny moduly používají jediný core runtime pro permission policy, OAuth
  security metadata, distribuovaný rate limit a redigovaný audit,
- resources jsou vlastněné příslušnou doménou; remote HTTP a stdio dál používají
  stejnou MCP 2.0 factory a nezměnil se veřejný katalog ani wire kontrakt.

## 2026-08-11 — odstranění lokálního desktop serveru

- Electron už nespouští starý localhost HTTP/SSE MCP server a nevystavuje jeho
  lifecycle ani stav přes IPC/preload,
- renderer už neposílá běžný Supabase session token ani vybraný projekt do
  Electron main procesu kvůli MCP,
- kanonickým runtime zůstává MCP 2.0 v `server/mcp/`: remote HTTP přes
  `mcp-service/` a explicitní stdio adaptér používají stejnou factory,
  permission resolver, audit, rate limit a databázovou hranici.

## 2026-08-11 — oddělené first-party a OAuth session limity

- běžné webové/desktopové přihlášení už nepočítá MCP OAuth session do limitu
  tří first-party session a nemůže tak odstranit refresh-token chain konektoru,
- každý uživatel má nejvýše jednu session pro konkrétní OAuth client ID; nové
  připojení nahrazuje pouze starou session stejného klienta,
- consent, resource allowlist, tenantová RLS a explicitní revokace zůstávají
  beze změny; již ztracený refresh token vyžaduje jednorázové nové připojení.

## 2026-08-10 — samostatný MCP deployment a trvalý write grant

- Remote MCP dostal samostatný Vercel project root `mcp-service/`, bezpečný
  proxy cutover při zachování kanonické OAuth resource URL a fail-safe build
  scope pro oddělení MCP od webového/desktopového releasu.
- `tenderflow.write` grant nově platí do explicitního odvolání. Rizikové
  business mutace nadále vyžadují krátkodobý proposal, přesné confirm/execute,
  objektovou autorizaci a audit. Úzká Outlook metadata vazba zůstává přímá,
  idempotentní, projektově autorizovaná a auditovaná; vazba grantu na konkrétní
  OAuth consent zůstává zachována.
- Nastavení aplikace zobrazuje stabilní skupiny oprávnění místo statického
  seznamu toolů, takže rozšíření remote katalogu nevyžaduje rebuild UI.

## 2026-08-10 — objevitelný zápis stavu kanbanu

- přidán jednoúčelový `tf_prepare_bid_status_change` pro přípravu přesunu jedné
  karty dodavatele; skutečný zápis dál vyžaduje `tf_confirm_change` a
  `tf_execute_change`,
- vstup je striktně omezen na `bidId` a povolený cílový stav;
  používá stávající RPC dry-run, before/after diff a compare-and-set,
- obecný `tf_prepare_change` zůstává kompatibilní a MCP role nadále nemá přímý
  `UPDATE` na `bids`,
- serverová verze je `0.5.0`; release postup nově výslovně vyžaduje Refresh
  developer připojení nebo Scan Tools a publikování nového metadata snapshotu.

## 2026-08-09 — minimální Outlook message vazby

- přidány `tf_link_outlook_message` a `tf_match_outlook_reply` pro propojení
  odeslané poptávky a odpovědi s existující kartou dodavatele,
- ukládají se pouze stabilní Outlook identifikátory (`ImmutableId`, RFC
  `internetMessageId` a volitelný `conversationId`), nikdy tělo emailu,
  předmět, adresáti ani přílohy,
- privátní tabulka nemá přímé granty a používá FORCE RLS/deny-all; přístup je
  jen přes MCP RPC svázaná s ověřeným uživatelem, permissions a projektovým
  oprávněním,
- link je idempotentní metadata zápis s povinným pre-auditem; cenu a kanban
  stav nadále smí měnit jen samostatně navržený a potvrzený business workflow.

## 2026-08-09 — sdílená matice toolů a oprávnění

- serverová autorizace a uživatelská obrazovka používají společný katalog 17
  MCP nástrojů v `shared/mcp/toolCatalog.js`,
- každý OAuth klient zobrazuje název toolu, čtená nebo měněná data, režim,
  potvrzovací protokol a aktuální stav podle baseline, contacts a write grantu,
- regresní test porovnává celý publikovaný `tools/list` se sdíleným katalogem,
  takže nový nebo odebraný tool nemůže zůstat v UI bez odpovídající serverové
  policy,
- změna nepřidává databázové granty, OAuth scopes ani nové zapisovací operace.

## 2026-08-09 — OAuth metadata v katalogu toolů

- každý publikovaný tool deklaruje pro ChatGPT OAuth2 s minimálním scope
  `openid` v kompatibilním `_meta.securitySchemes`,
- interní permissions `tenderflow.read`, `tenderflow.contacts.read` a
  `tenderflow.write` se do OAuth scopes nevystavují; server je dál vyhodnocuje
  autoritativně před registrací i spuštěním toolu,
- regresní wire test ověřuje metadata celého dostupného katalogu a současně
  hlídá, že kontaktní ani zápisový grant nelze získat podvrženým OAuth scope.

## 2026-08-09 — uživatelské odpojení OAuth klienta

- nastavení AI a MCP přístupů umožňuje po druhém potvrzení úplně odvolat
  uživatelský souhlas konkrétního OAuth klienta,
- odvolání používá standardní Supabase OAuth revokaci, která zneplatní relace
  a refresh tokeny vybraného klienta; ostatní klienti a auditní historie
  zůstávají zachované.

## 2026-08-09 — exact backend proof pro PostgREST

- protože Supabase gateway nepředává nový `sb_secret_…` klíč do PostgREST
  request headers, nahradila se neúčinná prefixová kontrola přesným proofem
  odvozeným ze serverového secretu,
- proof se registruje přes `service_role`-only RPC, ukládá se v neexponovaném
  `mcp_private` a tabulka má nulové direct grants, FORCE RLS a restriktivní
  deny-all policy,
- permission i tool data requesty nesou uživatelský OAuth JWT pouze v
  `Authorization` a exact proof v samostatné hlavičce; OAuth bearer bez
  backendu nadále nemůže použít Data API,
- Auth hook nyní preferuje dokumentované `claims.client_id` a zachovává
  kompatibilní top-level fallback.

## 2026-08-09 — auth-schema boundary hotfix

- MCP RLS a PostgREST pre-request guard už nevolají `auth.uid()`/`auth.jwt()`
  přímo pod izolovanou rolí,
- přidány úzké identity helpery v `public`, protože Supabase spravované schéma
  `auth` nemůže běžná migrační role delegovat nové databázové roli,
- zachováno `NOINHERIT`, explicitní toolové granty a blokace přímého Data API.

## 2026-08-09 — tool-only databázová hranice

- registrované MCP OAuth tokeny dostávají izolovanou NOINHERIT roli místo
  obecné role `authenticated`,
- Data API pro tuto roli vyžaduje oddělený backendový `sb_secret_…` klíč;
  klient zná pouze OAuth JWT a nemůže přeskočit MCP toolset,
- Storage a Realtime nejsou MCP roli udělené; tabulkové grants jsou omezené na
  aktuální tool adaptéry a každou oblast dál chrání user/client permission RLS,
- stdio odmítá běžné Tender Flow session tokeny a vyžaduje stejný dedikovaný
  OAuth token jako remote transport,
- odstraněny historické bezpodmínečné CRUD politiky kontaktů a obnovené
  owner/organization tenantové politiky.

## 2026-08-09 — autoritativní user+client granty

- interní permissions se při každém MCP požadavku řeší databázovým RPC podle
  `auth.uid()`, přesného JWT klienta, aktivního resource registru a OAuth
  consentu,
- consentovaný klient získá baseline read; contacts grant expiruje za 30 dní
  a write grant za 8 hodin, oba lze okamžitě revokovat,
- přidáno uživatelské Nastavení → Nástroje → MCP přístupy, druhé potvrzení pro
  write a append-only audit grantů,
- grantové tabulky nemají přímý přístup `anon` ani `authenticated`; správa
  probíhá přes user-bound `SECURITY DEFINER` RPC s prázdným `search_path`.
- elevated grant je svázaný s konkrétní generací OAuth consentu, takže revoke
  a následná reautorizace automaticky neobnoví contacts/write,
- audit uchovává OAuth client ID jako snapshot i po odstranění klienta a první
  souběžné změny stejného grantu serializuje transakční advisory lock,
- výpadek permission resolveru vrací dočasné HTTP 503 místo OAuth 401 a odkaz
  z consent stránky používá jednotný aplikační router.

## 2026-08-09 — bezpečný read katalog a tasky

- obecné `search`/`fetch` jsou dostupné bez kontaktní PII; kontaktní větev
  zůstává vázaná na samostatnou contacts permission,
- přidán PII-minimalizovaný `tf_get_project_summary`, projektový resource,
  `tf_list_tasks` a `tenderflow://tasks/open`,
- MCP mapování nabídek používá produkční `demand_category_id` místo prázdného
  legacy `category_id`,
- task a projektové adaptéry mají minimální selecty, pevné limity a explicitní
  truncation metadata.

## 2026-08-09 — distribuovaný limiter a audit hardening

- procesní limiter nahradil atomický PostgreSQL user/client/risk bucket se
  serverovými limity a fail-closed chováním,
- audit helper nově detekuje i návratové Supabase chyby a bezpečně je
  signalizuje,
- každá write fáze vyžaduje úspěšný redigovaný attempt audit před spuštěním
  doménového handleru.

## 2026-08-09 — OAuth resource binding hotfix

- resource claim je vázán na autoritativní registr dedikovaných MCP OAuth
  klientů; samotný `client_id` již nestačí,
- produkční canary ověřuje HTTPS/origin authorization a token endpointu a
  načítá přesný JWKS používaný serverem.

## 2026-08-09 — fail-closed OAuth kompatibilita

- standardní Supabase OAuth scopes byly odděleny od interních Tender Flow
  permissions,
- vlastní `tenderflow.*` hodnota v tokenovém `scope` již nemůže zpřístupnit
  kontaktní ani write schopnost,
- remote i stdio policy nyní vydává pouze obecné read oprávnění,
- consent a dokumentace jasně uvádějí, že kontaktní data a zápis jsou vypnuté
  do zavedení autoritativního user+client grant modelu.

## 2026-08-09 — dokumentační základ

- přidána ucelená česká reference architektury, OAuth, scopes, tools,
  resources, bezpečného zápisu, provozu, testů a skillů,
- explicitně zaznamenány aktuální limity desktop serveru, auditu, DB grants a
  `in-memory` rate limitu,
- přidán automatický test shody protokolu, názvů tools a resource URI.

## 2026-08-08 — původní scoped katalog a resources

- zavedeny doménové identifikátory `tenderflow.read`,
  `tenderflow.contacts.read` a `tenderflow.write`; od 2026-08-09 jsou vedeny
  jako interní permissions, ne jako Supabase OAuth scopes,
- přidány resources `tenderflow://catalog`,
  `tenderflow://projects/{projectId}` a
  `tenderflow://organizations/{organizationId}/contracts/overview`,
- resources mají private cache hints a audit,
- stdio session již automaticky nezíská contact PII ani write oprávnění,
- lokální audit používá bezpečně omezené `local-stdio` RLS pravidlo.

## 2026-08-08 — MCP SDK v2

- remote/stdio Node server převeden na SDK v2 a protokol `2026-07-28`,
- stateless HTTP, `server/discover` a header-based routing,
- zachován třífázový write tok; Pouze `create_task` je vykonatelný.
