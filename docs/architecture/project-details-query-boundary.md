# Načítání detailů projektů

Stav: implementováno a cíleně ověřeno, 11. července 2026

## Kontext a cíl

Detail projektu a hromadné načítání detailů jsou serverový stav spravovaný přes
TanStack React Query. Kanonická implementace je zatím v legacy cestě
`hooks/queries/useProjectDetailsQuery.ts`, zatímco moderní portfolio consumer je
ve `features/projects/`. Cílem je přesunout vlastnictví do projektové feature,
zachovat kompatibilní re-export pro legacy odběratele a nezměnit síťový ani
cache kontrakt.

## Cílové vrstvy

| Odpovědnost | Kanonické umístění |
| --- | --- |
| React Query orchestrace | `features/projects/hooks/useProjectDetailsQuery.ts` |
| Databázový adaptér | `infra/db/dbAdapter.ts` |
| Demo detail | `features/projects/api/projectDemoDataApi.ts` |
| Lokální budget přílohy | `features/projects/model/budgetAttachmentLocalStore.ts` |
| Legacy kompatibilita | `hooks/queries/useProjectDetailsQuery.ts` |

## Zachovávaný kontrakt

- detail používá query key `projectDetails/<projectId>`,
- dotaz je aktivní pouze s neprázdným ID a povoleným `enabled`,
- cache je čerstvá pět minut,
- hromadný hook vytváří jeden React Query dotaz na projekt a kombinuje data,
  loading, error i původní výsledky,
- demo režim nepoužívá databázi,
- projekt, kategorie, smlouva, finance, dodatky a investorské faktury se spouštějí
  paralelně,
- nabídky se načtou až po kategoriích, protože závisejí na jejich ID.

## Testovací plán

- [x] Feature a legacy import exportují stejnou implementaci.
- [x] Query key, `enabled` a pětiminutový `staleTime` zůstanou beze změny.
- [x] Demo větev vrátí uložený detail nebo fallback a nevolá DB adaptér.
- [x] Sedm nezávislých dotazů se zahájí před dokončením kteréhokoli z nich.
- [x] Prázdný seznam kategorií nevolá tabulku `bids`.
- [x] Kategorie, geolokace, DocHub, smlouva, finance a bids se mapují kompatibilně.
- [x] Hromadný hook zachová query konfiguraci a combine kontrakt.
- [x] Architektonický audit již neeviduje import feature z legacy detail hooku.
- [x] Projdou cílené testy, úplný Vitest, typecheck, buildy a architektonické guardy.

## Bezpečnost a výkon

RLS zůstává primární autorizační hranice. Migrace nemění SQL, grants ani
politiky a nesmí přidat `service_role` nebo klientské rozšíření přístupu.
Paralelní `Promise.all` je výkonový invariant; závislý bids dotaz je jediná
záměrná druhá fáze. Query klíče a deduplikace React Query se nesmí změnit.

## Rollback

Změna neobsahuje databázovou migraci. Lze ji vrátit jedním revertem; legacy
odběratelé zůstávají kompatibilní přes re-export.

## Průběžný výsledek

Cílený RED stav prokázal chybějící feature modul i jednu konkrétní zakázanou
vazbu. Po migraci prošly kontraktové, demo a architektonické testy (16 testů ve
3 souborech) a TypeScript. Audit snížil počet přechodových vazeb z 80 na 79 a
`features-to-legacy-hooks` ze tří na dvě. Přesný lokální rozsah změny prošel
295 testovacích souborů a 1 388 testů. Celý pracovní strom včetně nesouvisejícího
rozpracovaného auto-updater testu prošel 296 souborů a 1 389 testů. TypeScript,
dokumentační odkazy, boundaries, legacy freeze, web build, desktop compile a
dependency audit byly čisté; autoritativní CI výsledek zůstane v historii PR.
