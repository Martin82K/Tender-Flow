# MCP changelog

Formát zaznamenává uživatelsky nebo integračně významné změny. Git historie je
detailní zdroj jednotlivých diffů.

## 2026-08-09 — bezpečný read katalog a tasky

- obecné `search`/`fetch` jsou dostupné bez kontaktní PII; kontaktní větev
  zůstává vázaná na nevydávané contacts permission,
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
