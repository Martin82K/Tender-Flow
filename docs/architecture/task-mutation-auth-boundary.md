# Auth hranice create task mutací

Stav: implementováno a lokálně ověřeno, 11. července 2026

## Kontext a rozsah

Tato hranice se týká pouze `useCreateTaskMutation` a
`useCreateTodoProjectMutation`. Update, delete a toggle mutace identitu nečtou a
jejich chování tato změna neupravuje.

Create hooky původně odebíraly celý legacy `AuthContext`. Nyní používají pouze
read-only `AuthIdentity` (`id`, `email`, `role`) a společný čistý guard před
voláním API.

## Datový tok

UI consumer → `AuthIdentityContext` → create mutation hook → task API →
`dbAdapter` → databázové RLS

Hook nepředává session, access token, refresh token ani auth akce. API dostane
pouze ověřené `user.id` a nezměněný create input.

## Fail-closed a chybové kódy

Mutation nemá query vlastnost `enabled`; neplatnou operaci proto odmítne přímo
její `mutationFn` ještě před API:

| Kód | Stav | Uživatelská zpráva |
| --- | --- | --- |
| `TASK_MUTATION_AUTH_REQUIRED` | identita je `null` | Pro vytvoření je nutné přihlášení. |
| `TASK_MUTATION_DEMO_READ_ONLY` | role je `demo` | Demo režim je pouze pro čtení. |

Oba kódy i zprávy jsou součástí automatického kontraktu. Běžná API chyba se
propaguje beze změny; success invalidace se při ní nespustí.

## Zachované invarianty

- `createTask(user.id, input)` dostane původní task input,
- `createTodoProject(user.id, input)` dostane původní TODO project input,
- úspěšný task create invaliduje právě `TASK_KEYS.all`,
- úspěšný TODO project create invaliduje právě `TODO_PROJECT_KEYS.all`,
- nevzniká optimistic update ani změna databázového payloadu,
- update/delete/toggle hooky zůstávají beze změny.

## Bezpečnost

Klientské `user.id` je vstup a defense-in-depth, nikoli autorizační hranice.
Repository migrace definují insert RLS `created_by = auth.uid()` pro tabulky
`tasks` i `task_projects`. Tento dokument potvrzuje obsah verzovaných migrací,
nikoli stav jejich nasazení v konkrétní databázi.

Demo blokace je aplikační read-only politika a nenahrazuje serverovou
autorizaci. Změna neupravuje SQL, RLS, grants ani databázové schéma.

## Testovací plán

- [x] Architektonický RED/GREEN guard pokrývá oba mutation soubory.
- [x] Explicitní shared identita odlišná od legacy mocku řídí API `user.id`.
- [x] Task a TODO project create zachovají vstupní payload.
- [x] `null` a demo identita vrátí stabilní kód i zprávu bez API volání.
- [x] API rejection se propaguje bez success invalidace.
- [x] Každá úspěšná create mutace invaliduje právě svůj cache root.
- [x] Kompletní Vitest, typecheck, dokumentace, boundaries, legacy freeze, web
  build, desktop compile a dependency audit prošly lokálně.

## Výsledek ověření

Architektonický RED běh nalezl přesně dvě zakázané vazby. Behaviorální RED běh
selhal ve čtyřech z pěti scénářů na legacy identitě nebo chybějící demo/null
blokaci; existující propagace API chyby již byla zelená. Po implementaci prošla
rozšířená task regrese 12 testovacích souborů a 80 testů.

Přesný lokální rozsah prošel 301 souborů a 1 419 testů; celý pracovní strom
včetně nesouvisejícího updater testu prošel 302 souborů a 1 420 testů.
Architektonický dluh klesl ze 73 na 71 vazeb a feature→legacy context nálezy ze
42 na 40. TypeScript, dokumentační odkazy, boundaries, legacy freeze, web build,
desktop compile a dependency audit prošly. Autoritativní vzdálený výsledek
zůstane v historii navazujícího PR.

## Rollback a manuální ověření

Změna nevyžaduje databázovou migraci a lze ji vrátit jedním revertem. Ručně je
potřeba běžným účtem vytvořit úkol přes rychlé přidání i formulář, podúkol a
osobní TODO projekt; seznamy se musí po úspěchu obnovit. Demo pokus musí být
odmítnut bez síťového zápisu.
