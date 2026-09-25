# Obnovování projektu a výkon nabídek

## Databáze

Migrace `20260924221934_optimize_bid_select_policy_sets.sql` převádí dvě SELECT
politiky nabídek na množiny dostupných kategorií vyhodnocené v rámci dotazu.
Původní výraz pro přístup vlastníka, organizace, sdílení a viditelného dema
zůstává zachován, stejně jako volání `can_project_module_action`.
Kategorie i projekty se stále čtou pod RLS volajícího. Nepřibývá oprávnění,
`SECURITY DEFINER`, persistentní cache oprávnění ani nová data.

Write politiky, tenantové předplatné, blokace přímého OAuth přístupu a MCP
politika se nemění. Podporován je aktuální `demand_category_id` i historický
`category_id`; ALTER POLICY zachovává role, permissive/restrictive a komentáře.
Schéma, FK, indexy a obchodní data se nemění, takže formát zálohy, obnova,
mazání vlastníka a kaskády zůstávají beze změny.

Regrese běží v izolovaném PostgreSQL/PGlite:

```sh
PGLITE_MODULE="$PWD/tests/postgres/node_modules/@electric-sql/pglite/dist/index.js" node --test tests/postgres/bidSelectPolicies.test.mjs
```

Test porovnává původní a nové výsledky pro vlastníka, členství, sdílení, skryté
demo, odebraný projekt/kategorii, zakázaný modul, neplatné předplatné, OAuth,
MCP a anonymní roli. Kontroluje data, grants, FK, indexy, ostatní politiky,
idempotenci a plán bez opakování obou SELECT lookupů pro každou nabídku.

Před deployem použít `supabase db push --linked --dry-run`; po deployi ověřit
katalog, počty, security/performance advisors a znovu dry-run bez čekajících
migrací. Měření EXPLAIN ANALYZE musí běžet pod rolí authenticated s odpovídajícími
JWT claims; administrátorský dotaz neodpovídá běžnému API. Produkční RLS se při
měření nevypíná. Do evidence patří pouze agregované metriky, žádná obchodní data.

## Klientská synchronizace

`useProjectBidRealtimeSync` slučuje události v okně 250 ms a dovoluje jen jednu
obnovu současně. Známá změněná kategorie načítá nabídky a minimální kontrolu
přístupu k projektu/kategoriím, bez smluv a finančních tabulek. Odpověď se použije
jen pokud je stále platná instance query a její data mezitím nezměnil jiný
požadavek nebo lokální zápis. Odhlášení/vyčištění cache ji nesmí obnovit.

Chybějící projekt vyprázdní cache. Chybějící kategorie/modul vyžádá úplnou
obnovu, aby nezůstala data jiných kategorií po odebrání přístupu. Chyba čtení
není považována za smazání; předá se do úplné query s existujícím chybovým UX.
Částečná obnova nezvyšuje čas aktuálnosti metadat projektu.

Viditelný online detail dál používá úplnou minutovou obnovu pro vzdálené DELETE,
změny metadat a zmeškané Realtime události. Ve skrytém/offline okně se odloží i
událostmi vyvolané obnovy; po návratu, online nebo opětovném připojení kanálu se
provede úplná kontrola. Jiný dříve otevřený projekt se pouze označí za neaktuální.
Kontroly licence v FeatureContext zůstávají samostatné a nezměněné.

Cílené regrese:

```sh
npm run test:run -- tests/features/projects/useProjectBidRealtimeSync.test.tsx tests/features/projects/refreshProjectBidCategories.test.ts tests/features/projects/projectRefresh.integration.test.tsx tests/features/projects/projectBidRealtimeApi.test.ts tests/useProjectDetailsQuery.contract.test.tsx
```

Integrační test vykreslí projekt, simuluje změnu z druhého zařízení, ověří tři
čtení místo osmi, zachycení smazání minutovým fallbackem a vyprázdnění při
odebrání přístupu. Scheduler pokrývá skryté/offline okno, burst, reconnect,
přepnutí projektu a cleanup; cache testy pokrývají souběžný zápis a změnu účtu.

## Rozpočet načítaný podle použití (beta.5)

Položkový rozpočet není součástí `fetchProjectDetails`. Jeho komponenta se
vykresluje pouze na záložce Rozpočet; od beta.5 se také její JavaScript/CSS
načítá dynamicky až při tomto vstupu. Lokální Suspense zachová navigaci při
načítání a existující aplikační LazyViewErrorBoundary obslouží chybu chunku.
Přímý odkaz na rozpočet používá tutéž cestu. Sdílené knihovny mohou být
potřebné i pro jiné obrazovky; odložený modul neznamená nulové načítání všech
knihoven pro XLSX v celé aplikaci.

První otevření položek načte index oprávnění/verzí a aktivní revizi. Seznam
zdrojových příloh se vyžádá až v sekci Importy a verze nebo po akci Opravit
import. Při jeho načítání či chybě se nezobrazuje falešný prázdný seznam ani
akce koše závislé na přílohách. Oprava dostane přílohu před prvním mountem,
protože editor ji ukládá do lokálního stavu. Chybějící příloha editor neotevře;
chybu načtení lze zopakovat. Zavření během požadavku editor později neotevře.
Selhání obnovy již načtených příloh nesmí zahodit rozepsanou opravu.

Index se při návratu stále ověřuje (`refetchOnMount: 'always'`) kvůli sdílené
hlavní verzi, zámku a oprávněním. Dotazy i cache příloh zůstávají oddělené podle
projektu a uživatele; změna uživatele resetuje instanci rozpočtu. Změna nemění
RPC, RLS, uložená data, zálohu/obnovu ani mazání projektu/účtu. Nevyžaduje
migraci a neslibuje změřenou úsporu paměti databáze.

Regrese: `tests/ProjectLayout.budgetLoading.test.tsx` ověřuje odložený import,
přepnutí zpět a opětovný vstup; `tests/constructionBudgetLoading.test.tsx`
ověřuje odložené přílohy, cache, načítání, chyby, opakování, zavření a oprávnění.
