# Import přiřazení položek do projektových VŘ

## Rozsah a integrační základ

Implementace navazuje na integrační PR #486 (`e60cfd48`) a editor #487
(`adca86c0`), lokálně spojené v `138c4286`. Výchozí kontroly PR: všechny review
threads vyřešené, #487 quality/Vercel úspěšné, #486 quality v okamžiku průzkumu běželo.
Finální PR vyžaduje vlastní CI a nezávislou bezpečnostní revizi.

Rozpočet používá `allocations`, nikoli textové pole `node.tenders`, jako pravdu
o vazbách. Firemní `construction_budget_catalog` se nemění. Projektovým seznamem
zůstává `demand_categories`; `external_code` je volitelný text s limitem 100 znaků.
Vlastní opakovatelný vzor je soubor pouze s definicemi. Import souboru vyžaduje
oprávnění cílového projektu; export čte definice přes existující RLS. Soubor je
nezávislá kopie, nikoli odkaz s trvajícím oprávněním ke zdrojovému projektu.

## Serverový kontrakt a bezpečnost

`construction_budget_import_tenders(project_input, request_input)` má režimy
`assignments`, `revision` a `template`. Veřejná funkce je invoker wrapper;
privátní definer vždy ověří autentizovaného aktéra, budget read/edit/prices/allocate,
projekt, tenant a pipeline entitlement. Zakládání VŘ navíc zachovává owner/share
edit podmínku běžného INSERT. Anonymní volání a přímé čtení provozní tabulky jsou
zakázané. Peněžní plány VŘ se nepřebírají.

Režim assignments odmítá klientské `document` i `allocations`. Z uzamčené cílové
revize sestaví pouze změnu alokací; při confirmed vytváří pracovní kopii. Režim
revision využívá existující validátor `private.budget_save` a serverově odstraní
dočasné `sourcePreview`. Vzorce z XLSX se neprovádějí a původní archivní limity platí.

Očekávaný seznam projektových ID/názvů/kódů a verze revize chrání náhled před
souběžnou změnou. Advisory lock koordinuje import s běžnými změnami VŘ i mazáním.
Položky a součty se kontrolují setově; duplicity cílů nebo cizí VŘ celý zápis vrátí.
Operation UUID je svázané s projektem, aktérem a hashem požadavku. Stejný retry
neopakuje mutaci; jiné tělo se stejným UUID je odmítnuto. Hash slouží porovnání
idempotence, nikoli bezpečnostnímu podpisu.

Životní cyklus: smazání projektu odstraní provozní záznamy přes FK CASCADE;
purge revize nastaví odkaz na NULL a retry odstraněný výsledek odmítne. Soft-delete
je kontrolován také při retry. `actor_id` je historické UUID bez blokující FK na
účet; každé volání znovu ověřuje aktuální oprávnění. Definice a externí kódy jsou
v existující záloze VŘ, provozní idempotency záznamy nejsou přenosný uživatelský vzor.
Test mazání účtu zde izoluje nové tabulky po úklidu ostatních budget vazeb;
nenahrazuje integrační test celého odstranění účtu.

Párování je návrh z dostupných identifikátorů a vyžaduje potvrzení dopadů. Neověřuje
se podobnost cen. Duplicitní kandidáti jsou omezeni na 100 položek a lze dále hledat;
nepoužívá se kvadratická matice všech dvojic. Soukromý soubor není součástí repozitáře.

## Migrační plán a rollout

Verzovaná migrace: `20260920112056_budget_tender_import.sql`.

1. Preflight: potvrdit finální integrační základ, přítomnost budget tabulek a
   `private.budget_save`, `can_project_module_action`, granty a RLS projektových VŘ.
   Ověřit marker `cnt_categories := cnt_categories + 1;` v obou skutečných funkcích
   `restore_*_backup_without_offer_deadline_20260817(jsonb,uuid)`. Veřejné restore
   wrappery tento marker neobsahují. Read-only cloud preflight to potvrdil.
2. Dry-run migrací na propojeném projektu musí obsahovat jen očekávané změny;
   nesouvisející neaplikované migrace patří integrační úloze. Nasazovat výhradně
   verzovanou migraci, nikdy ruční neauditované změny produkčních dat.
3. Migrace přidá nullable kód bez backfillu, privátní idempotency tabulku s RLS,
   index FK revize, serializační trigger a autorizované RPC. Nezakládá žádná VŘ
   ani nemění existující alokace. Obnovovací funkce doplní nové kódy uvnitř jejich
   existujících autorizovaných bloků; starší zálohy kódy zachovají.
4. Po nasazení ověřit sloupce, FK, RLS, granty, funkce a trigger; počty stávajících
   VŘ/revizí musí odpovídat preflightu (s vysvětlením případných souběžných změn).
   Spustit security/performance advisors a finální dry-run bez čekajících migrací.
5. Teprve potom zpřístupnit odpovídající frontend. Při rollbacku frontendu ponechat
   aditivní schema; sloupec ani audit operací nemažte a nevracejte uživatelské alokace
   hromadnou destruktivní migrací. Opravy nasazovat další verzovanou migrací.

Externí dokumentové složky nejsou součástí databázové transakce. Po úspěšném RPC
se vrácená nová VŘ synchronizují přes existující cloudový upsert nebo lokální
ensureStructure s ověřenou osobní cestou. Dotazy jsou omezené na daný projekt,
cloudové požadavky na čtyři souběžná volání. Lokální synchronizace vyžaduje desktop.
Selhání složek vrací upozornění u úspěšného importu; zápis se neopakuje a složky
lze doplnit v nastavení DocHubu. Opakovaná synchronizace používá stejné identity. Produkční
průchod proti skutečné cílové revizi nelze nahradit porovnáním souboru se sebou samým.

## Ověření podle dopadu

Průběžné důkazy se vztahují k pracovnímu diffu nad `138c4286`:

| Kontrola | Rozsah a výsledek |
| --- | --- |
| `constructionBudgetTenderImport.test.ts` | RED chybějící model; později RED soubor bez cen. GREEN posunuté sloupce, názvy, identity, duplicity, alokace a vzory. |
| `constructionBudgetImport.test.ts`, `constructionBudgetGlobus.test.ts`, `constructionBudgetImportDialog.test.tsx` | Spolu s novým modelem 50 testů prošlo v počáteční iteraci. |
| `constructionBudgetTenderImportUi.test.tsx` | 5 testů prošlo: nové potvrzení po změně seznamu VŘ, omezené ruční návrhy s dohledáním dalších cílů, vynechané skupiny neblokují duplicity, potvrzení náhledu, serverový payload bez cen/množství, konflikty a stejný operation UUID při retry. |
| `node --test tests/postgres/budgetTenderImport.test.mjs` | 11 PostgreSQL scénářů prošlo: atomický rollback, oprávnění, cizí projekt, verze, kopie confirmed, kódy/restore, revision režim, granty. Fixtures modelují oprávnění; nejde o produkční RLS end-to-end. |
| `constructionBudgetTenderRealFile.test.ts` | Soukromý dodaný XLSX prošel read-only smoke testem. Bez `TENDER_IMPORT_SMOKE_FILE` je test výslovně skipped. Skutečná cílová revize nebyla poskytnuta. |
| `constructionBudgetTenderTemplates.test.tsx` | 3 testy prošly: nezávislé editovatelné definice, vynechání a explicitní řešení duplicit. |
| Sestavený UI harness v Chrome | Desktop 1440 a mobil 390 px: výběr sloupců, potvrzení, import přiřazení, použití vzoru; bez console/page/network chyb. API je fixture, nejde o produkční E2E. |
| `npm run typecheck` | Pro průběžný diff prošlo. |
| `npm run check:boundaries`, `npm run check:legacy-structure` | Pro průběžný diff prošlo; žádný nový soubor ve frozen roots. |
| `npm run build` | Pro průběžný diff prošlo; existuje varování o velkých chunkech. |

Finální výsledky a přesný testovaný commit musí být doplněny v PR. Plná automatická
sada zůstává CI bránou. PostgreSQL scénáře nově běží také v quality workflow.

## Izolovaný PostgreSQL testovací runtime

`tests/postgres/package-lock.json` pinuje jedinou testovací závislost
`@electric-sql/pglite@0.5.8`; hlavní ani desktopové závislosti se nemění. Před
instalací byl ověřen npm registr, integrita tarballu, čtyři správci, kontinuita
publikování od roku 2024, [repozitář a releasy](https://github.com/electric-sql/pglite/releases)
a [bezpečnostní oznámení](https://github.com/electric-sql/pglite/security). Ve veřejném
vyhledávání nebyl doložen kompromis této verze; nedostatek hlášení není důkaz absence.
Instalace použila `--ignore-scripts`. Následný `npm audit`: 0 zranitelností;
`npm audit signatures`: 1 ověřený podpis registru a 1 provenance attestation.
Lockfile obsahuje pouze tuto verzi a odpovídající SHA-512 integritu.

```sh
npm ci --prefix tests/postgres --ignore-scripts
npm audit --prefix tests/postgres --audit-level=high
npm audit signatures --prefix tests/postgres
PGLITE_MODULE="$PWD/tests/postgres/node_modules/@electric-sql/pglite/dist/index.js" node --test tests/postgres/budgetTenderImport.test.mjs
```

### Navazující integrační ověření

Integrační opravy #486 `3702a4aa` jsou zahrnuté od `5a7b00f3`. Při sloučení
zůstal zachován zákaz přenosu alokací bez oprávnění; test editoru nově explicitně
zadává oprávněného uživatele (`e9d30f3e`). Další cílené RED/GREEN testy ověřily
omezení ručních návrhů na 100 s dohledáním dalších položek a možnost zrušit
vybranou definici, která se při editaci stala duplicitou (`e49d8df3`).

Dry-run `supabase db push --linked --dry-run --include-all` po aktualizaci
propojení na IPv4 uvedl výhradně tuto migraci. Před nasazením bude zopakován pro
finální revizi. Oprava po testu RED přidala atomické dokončení stavu příchozího
souboru také v režimu assignments; autoritativní source_id revize se nemění.
Celý izolovaný PostgreSQL průchod: 11 passed, 0 skipped/todo.

Cloud advisors před nasazením nejsou čisté: existují varování search_path,
anonymních i přihlášených SECURITY DEFINER RPC, vypnuté kontroly uniklých hesel
a výkonu RLS/indexů. Relevantní stávající signál: veřejné restore wrappery jsou
záměrně autorizované definer funkce; `demand_categories` má performance upozornění
na opakované vyhodnocování auth v restriktivní OAuth policy. Tato migrace jejich
oprávnění nemění. Doporučení viz [database linter](https://supabase.com/docs/guides/database/database-linter)
a [ochrana hesel](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Review opravilo náhled širokých vícelistových sešitů: omezený počet buněk vždy
zahrnuje rozpoznanou hlavičku a při kapacitě alespoň dvou řádků i následující vzorek.
Import VŘ a vlastní vzory vyžadují také dostupný `MODULE_PIPELINE`; stávající
přenos alokací mezi revizemi nadále používá samostatné oprávnění allocate.
Na pracovním diffu po `f04603ae`, základ #486 `3702a4aa`: cílený Vitest průchod
`constructionBudgetTenderImport`, `constructionBudgetSettings`,
`ProjectLayout.selectCaret`, `constructionBudgetImportDialog` má 64 passed,
0 skipped/todo. Dva nové scénáře nejprve prokázaly RED. `npm run typecheck`
prošel. Lokální produkční browser harness ověřil vypnutý i zapnutý pipeline,
celý import přiřazení a vzoru, desktop i mobil bez console/page chyb.

Další životní cykly ověřené při review: během náhledu přiřazení zůstává zdroj
přílohou (nebo si ponechá dřívější stav ready); převod nové revize po parsování
ukončí processing a čeká na potvrzení jako příloha. Zavření náhledu nebo chyba
RPC proto nezanechá neprobíhající operaci jako processing. Seznam skupin má
stránky po 30, hledání a limit 1 000 nových VŘ před odesláním; automatické shody
používají index názvů/kódů místo opakovaných průchodů katalogem.

Migrace také rozšiřuje existující INSERT kategorií při převodu projektu do
realizace o external_code. Zachovává aktuální funkci včetně kontrol předplatného
a přístupu; neočekávaný tvar zastaví celou migraci. Cloud preflight potvrdil oba
jednoznačné body vložení i přítomnost subscription guardu. Izolovaná regrese
spouští skutečné tělo klonovací funkce proti syntetickým tabulkám a ověřuje kód
007, nové ID, nezávislost kopie i zamítnutí cizího uživatele.

Ověření pracovního diffu po bd1d9cc8 na main 67bc303d: cílený Vitest importního
dialogu a VŘ má 33 passed; PostgreSQL průchod má 12 passed, 0 skipped/todo.
Nové scénáře nejprve prokázaly RED. Typecheck a browser průchod bez console/page
chyb prošly. Finální CI musí proběhnout pro publikovanou revizi.

Navazující review sjednotilo klíče VŘ podle normalizovaných názvů (mezery a velikost
písmen) a zachovalo původní cílovou revizi po dobu otevřeného dialogu. Změna hlavní
revize při refetchi nesmí změnit cíl ani způsobit pád; server nadále kontroluje
verzi zachyceného cíle. RED/GREEN testy ověřují obě vazby i synchronizaci DocHubu
po commitu. Chyba RPC nikdy nespouští složky, chyba složek neruší uložená data.

Na diffu po 7c4b75c7 (main 67bc303d) prošlo 74 cílených testů importu, persistence,
DocHubu a architektury. Dvě další bezpečnostní regrese následně prošly v desetici
persistence/DocHub testů. Typecheck, web build, browser desktop/mobil a docs prošly;
hranice zůstávají bez nových výjimek (36), legacy importů 126 a frozen souborů 111.
Graf má 684 uzlů, 2144 hran, 1828 vyřešených a 316 očekávaných externích odkazů.
Testy DocHubu používají mockované cloudové i lokální služby, nikoli skutečné složky.

Finální editor #487 je sloučený v main `0b4af027`. Integrace do importu zachovává
limit náhledu 1 000 000 znaků / 256 na hodnotu, původní nezkrácená zdrojová data
i náš výběr řádků s hlavičkou. Opravy existujících revizí dostávají oprávnění
allocate stejně jako nový import. Na integračním diffu nad `140941a0` a této
základně prošlo 91 cílených testů parseru, editoru, VŘ, UI a architektury;
read-only test skutečného soukromého souboru a typecheck také prošly.

Poslední úplná CI před touto integrací: `140941a0` / main `67bc303d`, testovaný
merge `52b2f5a1`, běh `35512184890`: 3339 passed / 3 skipped (externí fixtures),
PostgreSQL 12 passed / 0 skipped. Nezávislá bezpečnostní revize této revize
bez nálezu. Finální společný commit vyžaduje novou CI. Root audit zůstává na
7 známých nálezech v nezměněných závislostech (2 low, 5 moderate); desktop a
izolovaný PostgreSQL runtime mají 0. Existující varování velkých chunků trvá.
