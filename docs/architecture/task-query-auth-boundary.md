# Auth hranice read-only task query

Stav: implementováno a lokálně ověřeno, 11. července 2026

## Kontext a cíl

Seznam úkolů a seznam osobních TODO projektů jsou serverový stav spravovaný
TanStack React Query. Původní hooky četly legacy `AuthContext` skrytě uvnitř
feature vrstvy. Cílem změny je předávat minimální identitu explicitně, zachovat
cache a síťový kontrakt a zabránit backendovému requestu bez běžného uživatele.

## Datový tok

`AuthProvider` → `AuthIdentityContext` → `TasksPage` / `ActionQueueModule` →
`useTasksQuery` / `useTaskProjectsQuery` → task API → databázový adaptér

Consumer přečte read-only projekci `id`, `email`, `role` na hranici UI a předá
ji query hooku. Hooky neimportují legacy context, session ani auth akce.

## Zachovaný kontrakt

- task cache používá `tasks/list/<userId|anon>/<filter>`,
- TODO project cache používá `todo-projects/list/<userId|anon>`,
- oba hooky jsou aktivní jen pro přihlášeného uživatele mimo demo režim,
- query callback pro `null` nebo demo identitu vrátí prázdný seznam bez API
  volání i při ručním vyvolání,
- `useTasksQuery` předá API stejné `user.id` a nezměněný filtr,
- obě query zůstávají čerstvé 60 sekund,
- chyby API se dál propagují přes React Query.

## Bezpečnost

- Přes query hranici se nepředává session ani token.
- Klientský filtr `created_by = user.id` je defense-in-depth; serverová
  autorizace a RLS musí zůstat primární hranicí přístupu.
- Demo a odhlášený stav nevytvoří síťový request.
- Cache je oddělená podle identity, takže přepnutí účtu nesmí znovu použít data
  jiného uživatele.
- Změna neupravuje SQL, RLS, grants, task mutace ani databázový payload.

## Testovací plán

- [x] Architektonický guard odstraní oba feature→legacy context nálezy.
- [x] Explicitní identita odlišná od legacy hodnoty řídí query key i API.
- [x] Task filtr se zachová v cache key i API argumentu.
- [x] `null` a demo identita jsou disabled a fail-closed bez API volání.
- [x] Minutový `staleTime` se nezmění.
- [x] Tasks předá jednu identitu oběma query.
- [x] Command Center předá identitu a filtr nedokončených úkolů.
- [x] Projdou cílené UI testy, úplný Vitest, typecheck, dokumentace, guardy,
  web build, desktop compile a dependency audit.

## Výsledek ověření

Architektonický RED běh nalezl přesně dvě zakázané vazby a behaviorální RED
kontrakt selhal ve všech čtyřech scénářích na legacy identitě nebo nesprávném
`enabled`. Po implementaci prošla cílená task regrese 11 testovacích souborů a
75 testů. Přesný lokální rozsah prošel 300 souborů a 1 414 testů; celý pracovní
strom včetně nesouvisejícího updater testu prošel 301 souborů a 1 415 testů.
Architektonický dluh klesl ze 75 na 73 vazeb a feature→legacy context nálezy ze
44 na 42. TypeScript, dokumentační odkazy, boundaries, legacy freeze, web build,
desktop compile a dependency audit prošly. Autoritativní vzdálený výsledek
zůstane v historii navazujícího PR.

## Rollback a manuální ověření

Změna nevyžaduje migraci dat a lze ji vrátit jedním revertem. Ručně je potřeba
ověřit Inbox/Kalendář úkolů, osobní TODO projekty, Akční frontu Command Center,
demo účet a přepnutí dvou běžných účtů bez promíchání cache.
