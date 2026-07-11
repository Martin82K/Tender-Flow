# Tenant overview query

Stav: implementováno a lokálně ověřeno, 11. července 2026

## Kontext a cíl

Agregovaný přehled projektů načítá RPC `get_overview_tenant_data`. Původní React
Query hook žije v legacy cestě `hooks/queries/useOverviewTenantDataQuery.ts`,
zatímco jeho hlavní consumer je v projektové feature. Cílem je přesunout
kanonickou query orchestraci do `features/projects/`, zachovat staré API přes
adaptér a zpřesnit normalizaci nedůvěryhodného RPC payloadu.

## Cílové vrstvy

| Odpovědnost | Kanonické umístění |
| --- | --- |
| React Query orchestrace | `features/projects/hooks/useOverviewTenantDataQuery.ts` |
| Normalizace payloadu | `features/projects/model/overviewTenantData.ts` |
| Databázový adaptér | `infra/db/dbAdapter.ts` |
| Auth/demo vstup | explicitní parametry feature hooku |
| Legacy kompatibilita | `hooks/queries/useOverviewTenantDataQuery.ts` |

## Zachovávaný kontrakt

- query key je `overviewTenantData/<userId|null>`,
- query běží jen pro přihlášeného uživatele mimo demo session,
- volá jediný RPC endpoint `get_overview_tenant_data`,
- RPC chyba se propaguje do React Query,
- data jsou čerstvá dvě minuty,
- neplatný top-level payload se normalizuje na prázdné kolekce.

## Testovací plán

- [x] Feature hook zachová query key, `enabled` a dvouminutový `staleTime`.
- [x] Bez uživatele a v demo session zůstane query vypnutá.
- [x] Legacy bezparametrové API předá identitu a demo stav feature hooku.
- [x] Query zavolá přesně RPC `get_overview_tenant_data` a propaguje jeho chybu.
- [x] Validní payload zachová projekty a projektové detaily.
- [x] Neobjektový payload, neplatné projekty a pole místo detail mapy selžou
  uzavřeně na prázdné kolekce.
- [x] Architektonický audit již neeviduje import feature z legacy overview hooku.
- [x] Projdou cílené testy, úplný Vitest, typecheck, buildy a všechny guardy.

## Bezpečnost

RPC je `SECURITY DEFINER`, používá řízený `search_path`, odvozuje tenant přes
`get_my_org_ids()` a omezuje spojení kontaktů na organizaci nebo `auth.uid()`.
Klientská normalizace není autorizační vrstva a nesmí nahrazovat tyto DB
kontroly. Tato migrace nemění SQL, grants, RLS ani serverové secrets.

## Výkon a rollback

Hook provádí jediný request a nepřidává waterfall ani novou dependency. Přímý
feature import nevytváří nový barrel modul. Změnu lze vrátit jedním revertem bez
databázové migrace; legacy API zůstává po dobu migrace zachované adaptérem.

## Výsledek ověření

RED běh prokázal chybějící feature moduly i jednu konkrétní zakázanou vazbu.
Cílený kontrakt včetně RPC security testu a mutační invalidace prošel 23 testů
ve 4 souborech. Přesný lokální rozsah změny prošel 295 testovacích souborů a
1 391 testů; celý pracovní strom včetně nesouvisejícího auto-updater testu
prošel 296 souborů a 1 392 testů. TypeScript, dokumentační odkazy, boundaries,
legacy freeze, web build, desktop compile a dependency audit byly čisté.
Architektonický dluh klesl ze 79 na 78 vazeb a feature→legacy hooks ze dvou na
jednu. Autoritativní vzdálený výsledek zůstane v historii PR.
