# Nasazení databáze rozpočtu stavby

## 19. září 2026

Na explicitní pokyn uživatele byla přes Supabase CLI `db push --skip-vault`
nasazena verzovaná migrace `20260919141602_construction_budget.sql`.

Předběžný dry-run původní větve odhalil čtyři již vzdáleně nasazené migrace
z jiné práce (20260919070618, 20260919083458, 20260919085612, 20260919090957).
Jejich historie nebyla opravována ani mazána. Příkaz `migration fetch` stáhl
vzdálené migrace do dočasného nasazovacího adresáře a byla přidána přesná
kopie migrace rozpočtu. Následný dry-run obsahoval pouze migraci rozpočtu.

Ověření:
- Před nasazením migrace i autorizační SQL testy proběhly v transakci s rollbackem.
- Po nasazení znovu prošly SQL testy s rollbackem: cizí tenant, zastaralá verze,
  cizí VŘ, přímý zápis do revizí a změna potvrzené revize jsou odmítnuty.
- Závěrečný dry-run: `Remote database is up to date`, žádné čekající migrace.
- Kontrola security/performance advisors před a po: 597 existujících WARN,
  žádný nový nález; tato kontrola není tvrzením, že databáze nemá bezpečnostní dluh.
- V přihlášeném Chrome zmizela chyba chybějící RPC. Rozpočet načetl prázdný stav
  a otevřel dialog importu. Žádný XLSX nebyl při tomto nasazení uložen.

Migrace přidává samostatné tabulky a soukromé úložiště; neobsahuje backfill
existujících rozpočtů ani automatickou změnu plánů VŘ. Kompletní ověření
importu s uložením, úpravami a znovunačtením zůstává samostatným krokem.

## Koš a obnova · 19. září 2026

Nasazena migrace `20260919150612_construction_budget_trash.sql` po úspěšném
rollback testu. Test před migrací očekávaně selhal na chybějící RPC. Test po
migraci ověřuje odstranění/obnovu, zákaz úprav v koši, ochranu používané přílohy,
pořadí obnovy, zachování potvrzení a odmítnutí cizí organizace. Testovací data
jsou vždy vrácena rollbackem. Změna neobsahuje mazání souborů ani backfill.
Nové nullable sloupce ponechají všechny existující záznamy aktivní.

## Trvalé odstranění a data převodu · 19. září 2026

Nasazeny `20260919152816_construction_budget_purge.sql` a
`20260919153416_construction_budget_import_dates.sql`. Dry-run obsahoval právě
 tyto dvě migrace. Před nasazením i po něm prošly transakční SQL testy s rollbackem:
aktivní/stará verze, vazba na přílohu, obnova během mazání, opakované dokončení,
Storage prerequisite, cizí uživatel, datum převodu a vyloučení pracovních kopií,
izolace číselníků. Původní testy rozpočtu a koše po nasazení také prošly.

Katalog potvrzuje všechny čtyři migrace, RLS mazacích operací, dvě datumová pole,
trigger převodu a obě mazací RPC. Nebyla spuštěna žádná skutečná mazací operace:
0 rozpracovaných a 0 dokončených úloh. Backfill vychází pouze z uložených dat
vytvoření verzí, nezahrnuje pracovní kopie. Security/performance advisors mají
597 stávajících upozornění před i po, bez nových. Poslední dry-run hlásí
`Remote database is up to date`.

## Lokální ověření rozhraní

Kompletní Vitest běh: 559 souborů, 3 099 testů, žádné skipped/todo. Zahrnuje
lokální test skutečného XLSX bez jeho přidání do repozitáře. Prošly typecheck,
web build, docs/boundaries/legacy a desktop TypeScript compile. Build upozorňuje
na velikost některých existujících chunků; žádná chyba kompilace.

Sestavená aplikace na 127.0.0.1:4175: čisté načtení přihlášeného projektu,
číselníky, focus trap a návrat focusu, přímý převod uloženého souboru do kontroly
67 soupisů / 4 150 položek, popis upozornění a navigace. Nová karta sestavené
aplikace nemá chyby ani warnings v konzoli. Během přepnutí dev na preview měla
stará karta jednorázovou chybu již neexistujícího HMR modulu; čistým načtením se
nereprodukuje. Reálný import nebyl při QA finálně uložen a data nebyla mazána.
Syntetické fixture ověřily filtry, změnu množství na nulu, chybějící cenu a
mobilní rozložení 390×844. Veřejná příručka obsahuje jen syntetický snímek.

Nativní Electron runtime nebyl v tomto průchodu spuštěn. Samostatný nativní
Codex Security scan nebyl dostupný, nelze jej vykazovat jako úspěšný. Bezpečnost
byla ověřena kontrolou RLS/grantů/tenant hranic, SQL regresními scénáři a advisors;
597 starších nálezů zůstává existujícím dluhem. Neinstalovaly se nové závislosti.

## Připravená hlavní verze · 19. září 2026

Migrace `20260919195533_construction_budget_primary_revision.sql` je připravena,
ale dosud **není nasazena**. Automatická kontrola schvalování vyžaduje samostatný
souhlas s nasazením do aktivního projektu.

- Soukromá tabulka preferencí má RLS, odebrané klientské granty, FK na projekt
  a revizi a index odkazu na revizi. Veřejné invoker RPC volá private helper
  s pevnou search_path, kontrolou editace, cen a příslušnosti revize k projektu.
- Výběr se serializuje zámkem řádku preference a kontroluje očekávanou původní
  hlavní verzi. Koš a změna preference mají stejné pořadí zámků revize → preference.
- Backfill zachovává dosavadní nejnovější aktivní revizi. Preflight: 2 revize,
  2 přílohy, 2 projekty k inicializaci. Položky, ceny ani plán VŘ se nemění.
- Dry-run z izolovaného nasazovacího adresáře obsahoval pouze tuto migraci.
- Na místním PostgreSQL 17.10 s kopií schématu bez dat a syntetickými identitami
  prošly testy primary, základního rozpočtu, koše, purge a dat importu. Dvě
  souběžná nastavení hlavní verze potvrdila čekání a odmítnutí zastaralé změny.
- Frontend před dostupností `mainRevisionId` zachovává původní výchozí verzi
  a neumožní RPC pro nastavení hlavní verze. Přepínání verzí a ostatní UI fungují.

Po schválení nasadit přesnou verzovanou migraci, ověřit počet preferencí a jejich
příslušnost k projektu, provést SQL test s rollbackem, porovnat security/performance
advisors s preflightem a vyžadovat závěrečný dry-run bez čekajících migrací.
Code scanning v GitHubu nemá analýzu, Dependabot je vypnutý; nejde o čisté signály.
