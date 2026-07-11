# Technická dokumentace Tender Flow

Tento rozcestník popisuje aktuálně implementovaný stav aplikace. Zamýšlené nebo
plánované funkce jsou vždy označené; nejsou vydávané za hotové chování.

## Produkt

- [Katalog funkcí](product/feature-catalog.md) – uživatelské oblasti, dostupnost
  na webu/desktopu a vazba na feature flags.

## Architektura

- [Systémový přehled](architecture/system-overview.md) – runtime povrchy,
  vrstvy, hlavní datové toky a adresářová struktura.
- [Frontend a routing](architecture/frontend.md) – start aplikace, providers,
  routing, React Query, UI stav a feature registry.
- [Data a serverové služby](architecture/data-and-services.md) – Supabase,
  Edge Functions, MCP a pomocné backendy.
- [Electron desktop](architecture/desktop.md) – main/preload/renderer, IPC,
  souborový systém, secure storage, updater a platformní adaptér.
- [Načítání a viditelnost projektů](architecture/project-query-boundary.md) –
  detailní příklad query hranice a bezpečného mapování.
- [Načítání detailů projektů](architecture/project-details-query-boundary.md) –
  cache, paralelní dotazy, mapování a kompatibilní migrace detailového hooku.
- [Tenant overview query](architecture/overview-tenant-query-boundary.md) –
  RPC autorizace, normalizace payloadu a explicitní auth/demo vstupy.
- [Načítání kontaktů](architecture/contacts-query-boundary.md) – stránkování,
  mapování, ratings a kompatibilní migrace posledního legacy query hooku.
- [Task query auth hranice](architecture/task-query-auth-boundary.md) –
  explicitní identita, cache izolace a fail-closed read-only task dotazy.

## Bezpečnost

- [Bezpečnostní model](security/security-model.md) – identity, autorizace,
  tajné hodnoty, IPC, CSP, incidenty a bezpečnostní omezení.

## Vývoj

- [Začínáme s vývojem](development/getting-started.md)
- [Konfigurace a proměnné prostředí](development/configuration.md)
- [Testovací strategie](development/testing.md)
- [Politika konzolového výstupu testů](testing/console-output-policy.md)
- [Manuální validační mapa PR](testing/manual-pr-validation.md)

## Provoz

- [Deployment a release](operations/deployment-and-release.md)
- [Troubleshooting](operations/troubleshooting.md)
- [Známá omezení](operations/known-limitations.md)
- [Lokální statický deploy](local-static-deploy.md)
- [Release dokumentace](releases/README.md)

## Integrace a referenční artefakty

- [Přehled API kontraktů](api/contracts-summary.md)
- [OpenAPI kontrakt](api/contracts-summary.openapi.json)
- [Audit analytiky a telemetrie](analytics-telemetry-audit.md)
- [Agent skills](agent-skills.md)
- [Mapa workflow](workflow-map.html) a [zdrojová data](workflow-flows.json)
- Uživatelský manuál: `todo-app-strategie-tender-flow.docx`; publikované statické
  podklady jsou v `public/user-manual/`.

## Údržba dokumentace

- Dokumentace chování se mění ve stejném PR jako kód.
- Relativní odkazy musí projít `npm run check:docs`.
- Číselné výsledky testů se uvádějí pouze z čistého checkoutu nebo CI logu.
- Tajné hodnoty, přístupové tokeny a obsah lokálních `.env*` souborů se nikdy
  nekopírují do dokumentace.
