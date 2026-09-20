# Ovládání rozpočtu a osobní VŘ

Migrace `20260920182433_budget_lock_and_personal_tenders.sql` přidává privátní
stav zámku projektu a osobní číselník VŘ. Tabulky mají RLS a odebrané přímé granty.
Veřejné RPC jsou security invoker; privátní implementace kontrolují identitu,
oprávnění a optimistickou verzi. Společný základ má 14 definic a je poskytován
pouze při absenci osobního záznamu. Nevzniká plošný backfill existujících projektů.

Zámek se serializuje na řádku projektu a triggery chrání zdroje, revize a volbu
hlavní verze. Import samotných definic kontroluje zámek také. Oprávněný trvalý
výmaz projektu je zvláštní životní cyklus; aktivní projektový purge job dovolí
jeho dokončení. Změny autorství na NULL jsou povolené pouze beze změny obsahu.
Projektový číselník a import sdílí advisory lock; pořadí zámků zůstává stejné.

Osobní definice se kopírují pouze uvnitř `create_project_with_team`; nikoliv při
klonování ani při obnově. Neukládají ceny, alokace ani odkazy na původní VŘ.
Osobní data zanikají kaskádově s účtem, projektové kopie zůstávají nezávislé.
Podepsané rozšíření zálohy `budget_editor_settings` uchovává zámky a osobní
základ exportujícího uživatele. Osobní část obnovuje pouze tentýž účet v uživatelské
obnově; tenant restore ji nepřevádí na správce. Obnova doplňuje chybějící nastavení,
nepřepisuje aktuální. Starší zálohy bez rozšíření zůstávají kompatibilní.

## Regresní ověření

Základna implementace: `b63ef1ea5e31ba47412906b5f85c6a2d068f213f`.
Kontroly jsou vázané na pracovní diff této změny; finální commit a integrační
základnu eviduje PR a jeho CI. Před změnou zachyceny RED výsledky pro výběr/buňku,
SQL bez nové migrace, tlačítko výchozího číselníku a společný základ.

- `npm run test:run -- tests/constructionBudgetTable.test.tsx tests/constructionBudgetSettings.test.tsx tests/constructionBudgetTenderCatalog.test.tsx tests/constructionBudgetTenderTemplates.test.tsx tests/constructionBudgetRevisions.test.ts tests/constructionBudgetVersions.test.tsx`: cílené interakce, hromadné přiřazení a zachování vazeb.
- `PGLITE_MODULE=<audited PGlite entry> node --test tests/postgres/*.test.mjs`:
  skutečné SQL v izolovaném PostgreSQL/WASM, vlastní a cizí účet, anonym,
  privátní granty, konflikty verzí, kopie, společný základ, zámek, backup a mazání.
  Fixture stubuje stávající autorizační pomocníky; nejde o důkaz celé cloudové RLS.
- `npm run typecheck`, `npm run build`, `npm run check:boundaries`,
  `npm run check:legacy-structure`, `npm run check:docs`.
- Playwright v Chromu, 1440×1000 a 390×844, izolovaný fixture nad skutečnými
  komponentami: klik, dvojklik, přiřazení, zámek/import, výchozí číselník.
  Fixována změna pozice řádku po prvním kliknutí a přetečení navigace na mobilu.
  Produkční přihlášení ani skutečná zákaznická data nejsou součástí tohoto průchodu.

Build hlásí existující upozornění na velikost chunků. GitHub code-scanning při
preflight vrací `no analysis found` (404); nejde o úspěšnou bezpečnostní kontrolu.
Supabase advisor před změnou hlásí existující upozornění (search_path, veřejně
spustitelné definer funkce, ochrana uniklých hesel). Posuzovat pouze nové signály
oproti této základně; nezaměňovat dostupnost RPC za prokázanou zranitelnost.

## Soutěžní import bez cen

KROS/Globus rozpoznávají soupis i bez cenových sloupců. Pouze cenové sloupce
mohou mít interní index -1; povinné identifikační sloupce se nadále validují.
Neoceněné položky se ukládají s null, nikoliv s nulou. Neplatné číselné
buňky, chyby Excelu a vzorce bez výsledku zůstávají k opravě. Stejná pravidla
platí při opravě typu řádku. Potvrzení oceněné revize se nemění.

Doplněné RED/GREEN scénáře: úplně chybějící cenové sloupce, prázdné ceny,
oprava neoceněného řádku, neplatná číselná cena a mapování AA. V prohlížeči
se používá skutečný XLSX worker nad syntetickým sešitem 40 × 50 položek;
kontroluje se zachování všech 2 000 položek a viditelnost patičky při scrollu.

Ověření 20. 9. 2026: revize `3571d634` nad základnou `b63ef1ea` prošla
238 cílenými testy rozpočtu (3 nedostupné soukromé fixture přeskočeny),
typecheckem a web buildem. Úplné CI odhalilo pouze dvě zastaralá očekávání
velikosti architektonického grafu (3 458 ostatních testů prošlo). Přidání
číselníku a importu modalu mění graf na 696 uzlů a 2 187 hran, z toho
1 871 rozlišených; počet nevyřešených hran, legacy importů a cyklů se nemění.
Po aktualizaci očekávání prošlo všech 12 cílených architektonických testů.

Cloudová migrace byla nasazena souběžnou úlohou. Následná read-only kontrola
potvrdila verzi `20260920182433`, 14 základních profesí, RLS obou privátních
tabulek a absenci přímých grantů authenticated. Finální `supabase db push
--linked --dry-run` hlásí `Remote database is up to date`. Nasazovací záznam
potvrzuje zachování původních dat a provedení security/performance advisorů;
jejich existující upozornění zůstávají výše uvedeným omezením.


Revize PR #495 doplnila migraci `20260920190558`: trigger chrání identitu VŘ
při přímých zápisech z pipeline, ale propouští změny stavu a oprávněný purge.
Projektový validátor dovoluje 1 000 VŘ nebo již existující větší počet; osobní
limit 500 zůstává. Regrese před opravou: 2 SQL a 2 UI/model testy RED;
po opravě 10 SQL a 27 UI/model testů GREEN. Číselné chyby se odstraňují pouze
pro skutečně editovaný namapovaný sloupec, i při prázdných cenách.
Nepřenášené ruční řazení bylo odstraněno; obě evidence používají číslo/název.
Import pomocníka označení sloupců přidává jednu rozlišenou hranu (2 188/1 872),
bez nového cyklu nebo legacy vazby. Nezávislá bezpečnostní revize původního
produktového diffu `3571d634` byla bez nálezů; změny z revize vyžadují novou kontrolu.


Finální okrajové regrese: detail předává jen změněná pole a při změně popisu
nepřepočítává cenu; dvouřádkový Globus bez cen ignoruje vodicí řádek; tlačítko
výchozího seznamu vysvětluje limit 500 před odesláním. Migrace `20260920193400`
sjednocuje whitespace klíč názvu se stávajícím importem a klientem a vrací
`permissions.editTenders` ze stejného pipeline helperu jako zápis katalogu.
Neuděluje nová oprávnění, nemění granty ani RLS. Import vzoru si zachovává
původní přísnější oprávnění. RED: 4 UI/model scénáře a 1 SQL scénář;
GREEN: 76 cílených testů a 11 editorových PostgreSQL testů.
