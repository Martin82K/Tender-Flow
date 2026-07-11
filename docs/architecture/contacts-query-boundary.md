# Načítání kontaktů

Stav: implementováno a lokálně ověřeno, 11. července 2026

## Kontext a cíl

Seznam subdodavatelů je serverový stav spravovaný přes TanStack React Query.
Původní hook je v `hooks/queries/useContactsQuery.ts`, zatímco poslední moderní
consumer žije v projektové feature. Cílem je přesunout query do contacts feature,
zachovat legacy API a odstranit poslední feature→legacy hook vazbu.

## Cílové vrstvy

| Odpovědnost | Kanonické umístění |
| --- | --- |
| React Query orchestrace a stránkování | `features/contacts/hooks/useContactsQuery.ts` |
| Mapování DB řádků a ratings | `features/contacts/model/contactQueryModel.ts` |
| DB adaptér | `infra/db/dbAdapter.ts` |
| Demo adaptér | `infra/demo/demoDataAdapter.ts` |
| Retry/timeout | `shared/async/asyncControl.ts` |
| Legacy kompatibilita | `hooks/queries/useContactsQuery.ts` |

## Zachovávaný kontrakt

- query key je `contacts/list/<userId>`,
- query je vypnutá bez uživatele,
- demo uživatel nevolá databázi,
- kontakty se stránkují po 1 000 řádcích podle názvu firmy,
- každá operace má timeout 15 sekund a jeden retry,
- ratingy se agregují podle `vendor_id`; neplatné hodnoty se ignorují,
- cache je čerstvá pět minut.

## Testovací plán

- [x] Feature hook zachová query key, `enabled` a pětiminutový `staleTime`.
- [x] Legacy bezparametrový hook předá identitu feature hooku.
- [x] Demo větev vrátí uložené kontakty nebo fallback bez DB requestu.
- [x] Stránkování načte navazující stránku bez ztráty nebo duplikace.
- [x] Contacts a ratings request se zahájí paralelně; ratings nevytvářejí N+1.
- [x] Chyba contacts response se propaguje, volitelná ratings response chyba
  nezahodí načtené kontakty.
- [x] Mapování zachová specializace, kontaktní osoby, adresy, geodata a ARES stav.
- [x] Rating průměr a počet se počítají pouze z konečných čísel.
- [x] Architektonický audit nemá žádnou feature→legacy hook vazbu.
- [x] Projdou cílené testy, úplný Vitest, typecheck, buildy a všechny guardy.

## Bezpečnost a výkon

RLS zůstává primární autorizační hranice tabulek `subcontractors` a `contracts`.
Feature nepoužívá service role ani klientské rozšíření přístupu. Ratings query je
nezávislá na stránkování kontaktů, proto poběží paralelně v jednom `Promise.all`;
jednotlivé stránky kontaktů musí zůstat sekvenční.

## Rollback

Změna neobsahuje SQL ani novou dependency. Lze ji vrátit jedním revertem;
legacy consumery zůstávají kompatibilní přes adaptér.

## Výsledek ověření

RED běh prokázal chybějící feature hook, chybějící čistý model a poslední
feature→legacy hook vazbu. Cílený kontrakt včetně mutačních query-key testů
prošel 21 testů ve 4 souborech. Přesný lokální rozsah změny prošel 297
testovacích souborů a 1 401 testů; celý pracovní strom včetně nesouvisejícího
auto-updater testu prošel 298 souborů a 1 402 testů. TypeScript, dokumentační
odkazy, boundaries, legacy freeze, web build, desktop compile a dependency audit
byly čisté. Architektonický dluh klesl ze 78 na 77 vazeb a
`features-to-legacy-hooks` je nyní prázdné. Autoritativní vzdálený výsledek
zůstane v historii PR.
