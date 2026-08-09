# MCP changelog

Formát zaznamenává uživatelsky nebo integračně významné změny. Git historie je
detailní zdroj jednotlivých diffů.

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
