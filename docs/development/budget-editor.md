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

Navazující oprava PR #495 (`20260920195705`) ruší globální výjimku zámku
pro čekající mazací úlohu. Jen autorizované zahájení/dokončení mazání dočasně
odemyká rozpočet uvnitř transakce pod zámkem projektu. Zahájení původní stav
obnoví; selhání transakce vrátí i stav zámku. Mezi fázemi zůstávají revize
i identita VŘ chráněné. Regrese zahrnují opakování, neplatnou úlohu,
zbývající Storage soubory, chybějící oprávnění/předplatné, izolaci projektu,
anonymizaci autora a obnovu zálohy. Autorizační helpery musí vrátit true.
Validátor kontroluje také skutečně ukládanou délku názvu po btrim.
Buněčný editor předává odvozené total jen při změně hodnoty; uložení množství
neodstraňuje chybu jiného zdrojového sloupce s neplatnou cenou.

Ověření pracovního diffu nad `a4376595`, integrační základna `7517c42c`:
- Před opravou: 1 buněčný a 2 PostgreSQL regresní scénáře očekávaně RED.
- `npm run test:run -- tests/constructionBudgetTable.test.tsx tests/constructionBudgetRevisions.test.ts`: 24 PASS.
- `PGLITE_MODULE=... node --test tests/postgres/budgetEditor.test.mjs`: 14 PASS, žádné skipped/todo; izolovaná databáze se syntetickými daty, autorizační helpery stubované.
- `npm run typecheck`: PASS; testovací PGlite 0.5.8 z existujícího lockfile má nulový audit, ověřený registry podpis a provenance.
- Začleněná lokální rekapitulace: 34 testů rekapitulace/nastavení PASS, obsah zachovaný spolu s novějšími opravami PR.
Finální CI, nezávislé review a cloudový postflight se ověřují pro finální commit.

Další revize doplnila tři SQL regrese (všechny RED před opravou, 17 editorových
SQL testů GREEN po opravě, základna `213c46c5` / main `7517c42c`). Dokončení
mazání získává katalogový advisory lock před řádkovým zámkem projektu;
pořadí je ověřeno na instalované funkci. PGlite má jednu session, proto tento
test nenahrazuje živý souběh dvou PostgreSQL spojení. Retry dokončeného
importu vrací uložený výsledek i při následném uzamčení, stále kontroluje
identitu, payload a oprávnění; nový import zůstává zakázaný. Obnova zámku
vyžaduje edit i prices stejně jako standardní změna zámku. Opravy jsou
součástí dosud nenasazené migrace `20260920195705`.

### Úpravy přímo v tabulce

Dvojklik nebo F2 otevře editor v konkrétní buňce položky (typ K/M, kód,
popis, jednotka, množství, jednotková cena, celkem a dostupné štítky).
V textových a číselných buňkách Enter změnu uloží, Escape ji zruší.
U typu a štítků šipky a Enter vybírají možnosti; Tab přejde na tlačítko
Uložit změnu (✓), které se potvrdí Enterem. Escape nejprve zavře otevřenou
nabídku, další Escape zruší editor. Při chybě zůstane vstup otevřený.
Změna množství či jednotkové ceny přepočítá celkem. Součty oddílů jsou odvozené.
Sloupec Výběrové řízení rozbalí přímo řádek: zobrazí alokace a umožní
přiřazení celé položky do jediného VŘ a odebrání přiřazení. Změna VŘ
nahradí dosavadní vazby položky; změna množství aktualizuje i přiřazení.
Dílčí množství se nezadává. Starší dílčí nebo rozdělené vazby je nutné před změnou
množství výslovně sjednotit výběrem jediného VŘ.
Zápis respektuje stávající edit/price/allocate oprávnění a zámek rozpočtu.
Potvrzená verze se neupravuje; přiřazení VŘ vyžaduje pracovní verzi nebo
Akce → Vytvořit pracovní kopii. Pokud přiřazení není dostupné, neobsazená
buňka uvádí „Nepřiřazeno“ a po rozbalení vysvětlí důvod (potvrzení,
zámek, oprávnění, koš nebo probíhající ukládání), místo prázdného obsahu.

Editor importu nabízí stejnou tabulku v záložce Položky a VŘ. Změny v ní
zůstávají pracovní až do uložení editoru; ukládá se dokument i alokace.
Přemapování ani vyřazení soupisu s alokacemi nesmí vazby zahodit.
Regrese pokrývají inline umístění bez dalšího dialogu, Enter/Escape,
chybu a opakované potvrzení, čtení bez zápisu a společné uložení z editoru.

Výběr VŘ má vždy aktivní vyhledávání s automatickým fokusem. Chybějící
VŘ lze vytvořit a přiřadit přímo v řádku, pokud uživatel smí upravovat
projektový číselník. Založení načítá aktuální seznam a používá existující
RPC s kontrolou souběhu; při opakování využije shodný název. Číselník se
uloží ihned, přiřazení v importním editoru až s pracovní verzí. Selhání
přiřazení nezahodí už vytvořené VŘ ani nezakládá další kopii.

Regrese prázdného rozbalení VŘ (základ `8b66ad51`, integrační main
`8469a654`): dva nové scénáře nejprve RED; po opravě 63 testů tabulky
a nastavení PASS bez skipped/todo (`npm run test:run --
tests/constructionBudgetTable.test.tsx tests/constructionBudgetSettings.test.tsx`).
`npm run typecheck`, `npm run check:boundaries` a
`npm run check:legacy-structure` PASS pro tento pracovní diff.
V Electronu ověřeno vysvětlení u potvrzené verze a otevření formuláře
i vyhledávatelného seznamu VŘ v pracovní verzi. Zápis do živých dat
nebyl součástí tohoto průchodu; uložení a zákaz zápisu pokrývají testy.
Datový model, oprávnění a serverové kontroly se nemění.
