# MCP changelog

Formát zaznamenává uživatelsky nebo integračně významné změny. Git historie je
detailní zdroj jednotlivých diffů.

## 2026-08-09 — dokumentační základ

- přidána ucelená česká reference architektury, OAuth, scopes, tools,
  resources, bezpečného zápisu, provozu, testů a skillů,
- explicitně zaznamenány aktuální limity desktop serveru, auditu, DB grants a
  `in-memory` rate limitu,
- přidán automatický test shody protokolu, názvů tools a resource URI.

## 2026-08-08 — scoped katalog a resources

- zavedeny scopes `tenderflow.read`, `tenderflow.contacts.read` a
  `tenderflow.write`,
- přidány resources `tenderflow://catalog`,
  `tenderflow://projects/{projectId}` a
  `tenderflow://organizations/{organizationId}/contracts/overview`,
- resources mají private cache hints a audit,
- stdio session již automaticky nezíská contact PII ani write scope,
- lokální audit používá bezpečně omezené `local-stdio` RLS pravidlo.

## 2026-08-08 — MCP SDK v2

- remote/stdio Node server převeden na SDK v2 a protokol `2026-07-28`,
- stateless HTTP, `server/discover` a header-based routing,
- zachován třífázový write tok; Pouze `create_task` je vykonatelný.
