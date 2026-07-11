# Auth hranice notifikací

Stav: implementováno a lokálně ověřeno, 11. července 2026

## Kontext a rozsah

Notifikační UI používá jediný datový hook `useNotifications`. Hook čte pouze
read-only `AuthIdentity` (`id`, `email`, `role`) a řídí počáteční načtení,
30sekundový fallback polling, realtime odběr, lokální stav, mutace a předání
důležitých událostí desktopové notifikaci.

`NotificationCenter` nevolá API přímo. Mark-read, mark-all-read, dismiss a
dismiss-all přijímá jako callbacky z `NotificationBell`, který je získává ze
stejného hooku. UI tak nemůže obejít jeho auth guardy ani ochranu proti změně
identity.

## Datový tok

```text
AuthProvider → AuthIdentityContext → useNotifications
                                      ├─ notificationApi RPC/read
                                      ├─ 30s polling
                                      ├─ useNotificationSubscription
                                      └─ desktop notification adapter

NotificationBell → NotificationCenter → guarded hook callbacks
```

Hook nepřebírá session, access token, refresh token ani auth akce.

## Aktivní identita a fail-closed chování

Notifikační práci smí spustit pouze identita, která současně splňuje:

- hook je povolen parametrem `enabled`,
- identita existuje,
- role není `demo`,
- `id` po odstranění okolních mezer není prázdné.

Bez aktivní identity hook vrací prázdný seznam a nulový unread count. Nespustí
read RPC, timer, realtime channel, žádnou ze čtyř mutací ani desktopovou
notifikaci. Demo režim je tedy pro notifikace read-only/offline a nezpůsobuje
skrytou síťovou aktivitu.

## Izolace při změně účtu

Stav je označený ID identity, pro kterou vznikl. Při přepnutí A → B:

- obsah A se ihned přestane zobrazovat,
- opožděná read odpověď A se do stavu B nezapíše,
- stará realtime událost A se ignoruje,
- dokončení mutace A nesmí změnit obsah B,
- starý realtime odběr se odhlásí a nový se váže na B,
- deduplikace realtime událostí se vede odděleně pro aktivní identitu.

Desktopová notifikace vznikne jen pro novou, neduplikovanou událost aktivní
identity a pouze pro typ `warning`, `success` nebo `error`.

## Serverová autorizace

Klientský guard je defense-in-depth a UX hranice, nikoli primární autorizace.
Verzované migrace definují RLS pro `notifications` přes
`user_id = auth.uid()`. Read, mark-read, dismiss a dismiss-all RPC také filtrují
podle `auth.uid()`; insert helper odmítá běžnému přihlášenému uživateli cílit na
jinou identitu. Tento dokument potvrzuje obsah repository migrací, nikoli stav
jejich nasazení v konkrétní databázi.

Read RPC není čistě read-only operace: verzovaná definice při načtení spouští
retention úklid starých notifikací. Proto se nesmí volat bez aktivní identity a
provozní monitoring má počítat i s touto vedlejší databázovou změnou.

## Testovací plán

- [x] Architektonický guard zakazuje legacy AuthContext v notifikačním hooku.
- [x] Architektonický guard zakazuje přímý import API v NotificationCenter.
- [x] Běžná identita načítá, polluje, obnovuje a odebírá vlastní kanál.
- [x] Chybějící, demo, prázdná nebo zakázaná identita nic nečte ani nemutuje.
- [x] Přepnutí A → B ignoruje opožděný read výsledek A.
- [x] Stará realtime událost A se ignoruje a duplicita se zobrazí jen jednou.
- [x] Opožděná mutace A neovlivní B.
- [x] Všechny čtyři úspěšné mutace mění pouze aktivní lokální stav; při chybě
  se stav nezmění.
- [x] Realtime hook předává zdrojovou identitu a uklízí starý channel.
- [x] UI směruje všechny mutace přes guardované callbacky hooku.
- [x] Kompletní Vitest, typecheck, dokumentace, boundaries, legacy freeze, web
  build, desktop compile a dependency audit.

## Cílený výsledek

Test-first RED fáze prokázala dvě architektonická porušení: použití legacy
AuthContext v hooku a přímý přístup UI k notification API. Behaviorální RED
scénáře selhaly na chybějících guardech a izolaci identity. Po implementaci
prošlo 5 cílených souborů a 21 testů bez stderr výstupu.

Přesný rozsah změny prošel 304 souborů a 1 434 testů. Celý pracovní strom
včetně nesouvisejícího updater testu prošel 305 souborů a 1 435 testů. Oba
Vitest logy byly bez stderr a bez varování. TypeScript, dokumentační odkazy,
boundaries, legacy freeze, web build, desktop compile a dependency audit také
prošly. Build zachoval známá Rollup upozornění na smíšené statické/dynamické
importy a velké chunky; tato změna je nezavedla ani nezhoršuje.

Architektonický dluh klesl ze 71 na 70 vazeb a feature→legacy context nálezy ze
40 na 39. Audit neeviduje žádný tracked citlivý soubor. Autoritativní vzdálený
výsledek zůstane v historii navazujícího PR.

## Manuální ověření a rollback

1. Přihlásit účet A, otevřít zvonek a ověřit načtení i unread count.
2. Označit jednu/všechny notifikace jako přečtené a jednu/všechny skrýt.
3. Přepnout na účet B; žádná notifikace A se nesmí krátce ani trvale zobrazit.
4. Nechat na A vzniknout realtime událost po přepnutí; B ji nesmí zobrazit ani
   předat desktopu.
5. Odhlásit se a otevřít demo režim; nesmí běžet read RPC, polling, realtime
   channel, mutace ani desktopová notifikace.

Změna nevyžaduje databázovou migraci a lze ji vrátit jedním revertem. Po
rollbacku se vrátí původní klientské chování; serverová RLS zůstane beze změny.
