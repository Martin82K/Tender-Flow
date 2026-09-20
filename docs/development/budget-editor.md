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
popis, jednotka, množství, jednotková cena a celkem).
V textových a číselných buňkách Enter nebo opuštění editoru změnu uloží, Escape ji zruší.
Přesun fokusu na tlačítka ✓/× uvnitř editoru zápis nespouští. Nezměněná buňka
se při opuštění pouze zavře. Během zápisu se zobrazuje Ukládání…; chyba ponechá hodnotu v editoru.
U typu šipky a Enter vybírají možnosti; Tab přejde na tlačítko
Uložit změnu (✓), které se potvrdí Enterem. Escape nejprve zavře otevřenou
nabídku, další Escape zruší editor. Při chybě zůstane vstup otevřený.
Změna množství či jednotkové ceny přepočítá celkem. Součty oddílů jsou odvozené.
Sloupec Výběrové řízení zobrazuje pouze názvy přiřazených VŘ. Po výběru
položek je vyhledávací seznam rovnou dostupný vpravo
ve stejné liště s ostatními akcemi. Výběr ihned přiřadí celé množství všech
vybraných položek; tlačítko + vytvoří nové VŘ. Nabídka má pravý okraj
zarovnaný s polem a dlouhé názvy se zalamují. Fokus zvýrazňuje celý vyhledávací
obal, nikoli samostatný vnitřní input.
Změna VŘ nahradí dosavadní vazby; změna množství aktualizuje i přiřazení.
Starší dílčí nebo rozdělené vazby je nutné před změnou množství výslovně sjednotit.
Zápis respektuje edit/price/allocate oprávnění a zámek. Důvod nedostupnosti
je v horní liště; potvrzená verze vyžaduje pracovní kopii.

Při dostupném modulu VŘ přiřazování používá existující import RPC v režimu
assignments: odesílá ID položek a VŘ, nikoli celý dokument. Množství stanoví
server. Po ztrátě odpovědi stejný výběr a verze opakují stejný operationId.
Potvrzené odmítnutí dodatečného práva modulu VŘ použije původní save RPC,
které znovu kontroluje rozpočtová oprávnění. Síťová chyba fallback nespouští.
Odpověď serveru stále obsahuje celou revizi; velikost odpovědi se touto změnou
nezmenšuje. Změna nevyžaduje migraci ani změnu serverových oprávnění.

Editor importu nabízí stejnou tabulku v záložce Položky a VŘ. Změny v ní
zůstávají pracovní až do uložení editoru; ukládá se dokument i alokace.
Přemapování ani vyřazení soupisu s alokacemi nesmí vazby zahodit.
Regrese pokrývají inline umístění bez dalšího dialogu, Enter/Escape,
chybu a opakované potvrzení, čtení bez zápisu a společné uložení z editoru.

Výběr VŘ má vždy aktivní vyhledávání s automatickým fokusem. Chybějící
VŘ lze vytvořit a přiřadit přímo v horní liště, pokud uživatel smí upravovat
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

### Ověření horního výběru VŘ (2026-09-20)

Pracovní diff nad `419f777f`, integrační základna `8469a654`:
- Cílený RED pro malý požadavek: původní cesta volala `budgetApi.save` s celým dokumentem.
- `npm run test:run -- tests/constructionBudgetTable.test.tsx tests/constructionBudgetImportDialog.test.tsx tests/constructionBudgetSettings.test.tsx tests/architectureGraphAnalysis.test.ts tests/architectureGraphResolver.test.ts`: 112 scénářů; po přesunu stále viditelného výběru byl upraven test pro dvě shodná zobrazení názvu VŘ. Ostatních 111 PASS, opravená sada nastavení níže PASS.
- `npm run test:run -- tests/constructionBudgetSettings.test.tsx tests/themedRoleSelect.test.tsx`: 40 PASS, bez skipped/todo. Pokrývá i retry stejného operationId a fallback dodatečného práva pipeline.
- `npm run typecheck`, `npm run build`, `npm run check:boundaries`, `npm run check:legacy-structure`, `npm run check:docs`: PASS. Web build upozorňuje na velké chunky.
- V prohlížeči na izolované fixture se skutečnými komponentami ověřeno zarovnání do stejné lišty, absence otevíracího tlačítka a menu v buňkách, hledání mezi 61 VŘ, přiřazení, společný fokus a zalomení při šířce 480 px. Bez console errors; fixture nemá font ikon aplikace.
- Živý zápis nebyl proveden. Síťový důvod uživatelského `Failed to fetch` není potvrzen. Finální CI a nová nezávislá revize jsou stále branou před merge; uživatel merge pozastavil.

### Přímý zápis přiřazení a stav v buňce (2026-09-21)

Pracovní diff nad `d59b65e2`, integrační základna `8469a654`.
Uživatelský screenshot doložil `statement timeout`. Migrace
`20260920220500_budget_assignment_fast_path.sql` přidává do existujícího RPC
úzkou větev pro nahrazení přiřazení v pracovní revizi existujícím VŘ.
Nemění dokument; zapisuje pouze alokace, verzi a kompatibilní zpětný patch
historie. Zachovává vstupní oprávnění, projektové vazby, serializaci číselníku,
kontrolu verze, zámkový trigger a tabulku idempotentních operací.
Ostatní režimy importu používají dosavadní ukládání. Nejsou nové tabulky,
FK ani indexy; záloha/obnova a mazání pracují se stejnými datovými vazbami.

UI vykreslí VŘ ihned s označením Ukládání, jako dočasnou vrstvu nad revizí.
Teprve potvrzená odpověď aktualizuje cache. Při selhání se vrstva odstraní;
chyba je nad tabulkou a přežije zrušení výběru i odscrollování řádku.

- RED: bez nové migrace test zachytil volání obecného `budget_save`; UI test
  bez dočasné vrstvy nenašel název VŘ v buňce před dokončením požadavku.
- `PGLITE_MODULE=tests/postgres/node_modules/@electric-sql/pglite/dist/index.js node --test tests/postgres/budgetEditor.test.mjs`: 20 PASS, 0 skipped/todo. Syntetický rozpočet 11 000 řádků: přibližně 200 ms na přiřazení; nejde o měření produkce. Testy zachovávají oprávnění, cizí projekt/VŘ, zdroj, verzi, zámek, historii a opakování.
- `npm run test:run -- tests/constructionBudgetSettings.test.tsx tests/constructionBudgetTable.test.tsx`: 67 PASS, 0 skipped/todo.
- `npm run typecheck`, `npm run build`: PASS; build má stávající varování velkých chunků.
- Vizuální fixture skutečné tabulky: VŘ a Ukládání v buňce během čekání, po simulované chybě návrat původní hodnoty.
- Preflight živé databáze: existující funkce SECURITY DEFINER s prázdným search_path a EXECUTE pouze postgres/authenticated; oba indexy tabulky operací existují. CLI dry-run nabízí pouze tuto migraci. Uživatel schválil nasazení; CLI push provedl tuto jedinou migraci. Následná kontrola potvrdila novou větev, stejná ACL/search_path a beze změn počty revizí, verzí, alokací, historie a operací. Finální dry-run: Remote database is up to date.
- Advisory baseline je dostupný, ale není čistý: existující globální varování mutable search_path a veřejně spustitelných definer funkcí, výkonové indexy/politiky. Dotčená private tabulka operací má záměrně RLS bez klientských policies a bez přímých grantů; změna je neoslabuje.

Po nasazení security/performance advisors zachovávají stejné počty kategorií zjištění jako preflight; nejde o čistý globální audit. Živý zápis položky a jeho latence nebyly měřeny.


### Odstranění štítků z produktu (2026-09-21)

Pracovní diff nad `f1e08cc7`, integrační základna `8469a654`: odstraněny sloupec,
editor a hromadné přiřazování, správa v číselníku, exportní sloupec a zapojení
štítků do globálního hledání. Staré nastavení sloupců se očistí při načtení;
pokud by nezbyl viditelný sloupec, obnoví se výchozí sloupce. Staré tags zůstávají
v datovém formátu a zálohách; běžná editace je nepřepisuje. Nejsou přenášeny
z předchozí verze a neblokují opravy soupisů ani typů řádků. Ochrany přiřazení
VŘ, tenant isolation a serverová validace zůstávají zachované. Bez migrace.

RED: staré sloupce a globální hledání stále nabízely štítky. GREEN:
`npm run test:run -- tests/constructionBudgetTable.test.tsx tests/constructionBudgetSettings.test.tsx tests/constructionBudgetCatalog.test.tsx tests/constructionBudgetImportDialog.test.tsx tests/constructionBudgetImportRepair.test.ts tests/constructionBudgetExport.test.ts` 152 PASS;
`npm run test:run -- tests/constructionBudgetModel.test.ts` 7 PASS;
po zrušení šířky devátého exportního sloupce cílený export 25 PASS.
Žádné skipped/todo. Typecheck, web build, boundaries, legacy structure a docs
PASS; build má stávající varování na velké chunky. Vizuálně zkontrolována
skutečná tabulka na izolované fixture bez sloupce štítků. Finální CI a review
zůstávají před merge, který je nadále pozastaven.
Po doplnění obnovy viditelných sloupců pro nastavení obsahující jen štítky:
`npm run test:run -- tests/constructionBudgetSettings.test.tsx` 32 PASS.


### Ověření ukládání ceny a přepočtu (2026-09-21)
Základna `8469a654`, pracovní diff nad `e378870c`. Změna pouze potvrzování
textové/číselné buňky při opuštění editoru; API, oprávnění, tenant hranice,
verzování a historie zůstávají stávající. Rozpracované číslo není uložená hodnota.

- RED: `npm run test:run -- tests/constructionBudgetTable.test.tsx`: 39 prošlo,
  2 selhaly (opuštění neukládalo změnu ani nezavíralo nezměněnou buňku).
- GREEN: stejný příkaz, 42 testů; potvrzení ceny, součty položky/oddílu/rozpočtu,
  zrušení, nezměněná hodnota, blokování duplicit a zachování hodnoty při chybě.
- PostgreSQL/WASM: `PGLITE_MODULE=... node --test --test-name-pattern='persists an edited' tests/postgres/budgetEditor.test.mjs`:
  1 test prošel, bez skipped/todo. Skutečná funkce save s kompaktní historií:
  11 000 syntetických řádků, cena 100 × 2 600 = 260 000, zápis a následné čtení,
  historie původní ceny, verze +1. Lokální zápis 602 ms; není měřením živého serveru.
- Živá DB, pouze čtení: aktuální validační regex přijímá `100`, `260000.00`, `7510.49`.
- Prohlížeč, izolovaná fixture skutečné tabulky: cena 100, klik na druhou položku,
  Ukládání…, jedno uložení, cena 100 a součty 260 000. Bez zápisu do zákaznických dat.
- `npm run typecheck`: prošlo. Finální kompletní CI a bezpečnostní revize PR
  jsou samostatná brána; merge zůstává pozastavený.

### Malý požadavek pro editaci buňky (2026-09-21)
Snímek s `Failed to fetch` potvrdil selhání transportu po potvrzení ceny;
samotné potvrzování editace proto nebylo úplným řešením. Přesnou příčinu
konkrétního síťového výpadku bez jeho síťového záznamu nelze určit. Dosavadní
RPC posílalo celý dokument tam i zpět (největší živý dokument 11 077 160 bajtů).

`construction_budget_edit_item` přijímá pouze povolená pole jedné položky,
identifikátory zdroje/revize/operace, očekávanou verzi a indexy vyřešených
číselných chyb. Server počítá množství × cenu, synchronizuje celé přiřazené
množství a volá původní validovaný save uvnitř databáze. Odpověď obsahuje jen
položku, její alokace a novou verzi. React Query sloučí potvrzenou odpověď bez
opětovného načtení dokumentu. Při psaní v editoru se součty neměnných dat
nepočítají znovu.

Opakování stejného požadavku pozná kompaktní historie (`clientEdit`) pouze pro
stejného uživatele, stejné tělo a bez novější změny revize. Jinak vrací konflikt.
Metadata jsou součástí stávající historie a jejích záloh/mazání/anonymizace;
nevzniká nová tabulka ani vazba na účet. Zachována kontrola práv read/edit/prices,
alokací, projektu, zdroje, verze, koše a zámku, prázdný search_path a zákaz anon.
Původní full-save zůstává pro import, potvrzení a jiné operace nad celou revizí.
Nasazení musí předcházet používání nového klientského volání.

Ověřený pracovní diff nad `e378870c`, integrační základna `8469a654`:
- RED: chybějící RPC v izolované DB; navíc regrese součtů zachytila 7 volání
  místo 6 po jednom stisku klávesy (1 selhání, 42 nesouvisejících testů skipped).
- `npm run test:run -- tests/constructionBudgetTable.test.tsx tests/constructionBudgetSettings.test.tsx`:
  76 PASS, bez skipped/todo; po refaktoru aktualizován mock existujícího testu undo.
- Celá izolovaná PostgreSQL sada: 27 PASS. Následná kontrola prázdné historie
  doplnila COALESCE pro opakování nezměněné hodnoty; 7 dotčených DB testů PASS.
- Syntetický dokument 11 000 řádků: malý zápis 560 ms, JSON požadavek 238 bajtů,
  JSON odpověď 1 048 bajtů. Orientační lokální WASM měření, nikoli produkční SLA.
- Prohlížeč se skutečnou tabulkou a 11 000 syntetickými řádky: klik mimo editor,
  Ukládání, 100 × 2 600 = 260 000, součty, bez console errors. Persistenci této
  vizuální fixture simuluje lokální stav; serverový zápis je ověřen odděleně SQL testy.
- `npm run typecheck`, `npm run build`, `npm run check:boundaries`,
  `npm run check:legacy-structure`, `npm run check:docs`, `git diff --check`: PASS.
  Build nadále upozorňuje na velké chunky; závislosti se nemění.
- Cloud preflight: kompaktní historie přítomna, nové RPC dosud nepřítomno;
  `supabase db push --linked --dry-run` obsahuje pouze novou migraci.
  Security/performance advisors obsahují existující globální varování; nejsou čistým auditem.
- Migrace `20260920223500_budget_item_patch.sql` je připravena k samostatně
  schválenému nasazení. Finální CI a nezávislá PR revize ještě nejsou dokladem
  pro tento diff; merge zůstává pozastavený.


Nasazení malého zápisu bylo uživatelem výslovně schváleno a dokončeno pro
`254f4c56`. `supabase db push --linked --yes`: PASS; následný dry-run:
`Remote database is up to date.` Ověřeno public RPC, authenticated EXECUTE,
zamítnuté anon EXECUTE, private SECURITY DEFINER s prázdným search_path a
odmítnutí volání bez auth.uid. Počty před/po: 5 revizí, součet verzí 9,
10 záznamů historie; nasazení žádná data nezměnilo. Security i performance
advisors mají stejné počty a žádný nález pro novou funkci. Existující globální
varování zůstávají. Živá latence zápisu uživatelské buňky se tímto read-only
ověřením neměřila. Vercel pro 254f4c56 PASS, finální Quality Checks ještě běží;
nezávislá bezpečnostní revize poslední revize a merge jsou nadále samostatné brány.
