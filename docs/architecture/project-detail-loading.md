# Načítání a obnova detailu projektu

Při otevření projektu se rozlišuje načítání, dostupný detail, chyba požadavku a nedostupný projekt. Skeleton se zobrazuje při prvním načítání. Chyba bez dříve načteného detailu nabízí **Zkusit znovu** a **Zpět na projekty**. Během opakování je tlačítko zakázané; navigace zůstává dostupná. Při výpadku aktualizace již načteného detailu zůstávají poslední úspěšná data zobrazena.

Nedostupný projekt zobrazuje společnou zprávu pro odstraněný projekt a projekt bez přístupu. Pokud ID není v aktuálním seznamu viditelných projektů, detail se nezobrazuje ani z cache a samostatný požadavek na toto ID se nespouští. U projektu, který zůstává v seznamu, lze zopakovat jeho detail. Změnu oprávnění nebo seznamu projektů lze ověřit návratem na přehled a obnovením stránky.

## Technické chování

- `useAppData` načítá přes `useProjectDetailsQuery` pouze detail viditelného projektu na projektové trase. Start na TODO ani návrat z projektu na TODO nespouští detailové dotazy. Při přechodu na jiný projekt se požadavek povolí až po shodě vybraného ID s aktuální URL. Klíče cache `['projectDetails', projectId]` zůstávají zachované; dávkový hook zůstává dostupný pro starší explicitní volání.
- `useAppData` odvozuje stav vybraného detailu z odpovídajícího výsledku dotazu a aktuálního seznamu projektů. Při otevřeném projektu se načítání detailů řeší uvnitř obrazovky; základní data aplikace si zachovávají globální načítání a zpracování chyb.
- `retrySelectedProjectDetails` volá pouze `refetch` vybraného výsledku. `cancelRefetch: false` a kontrola probíhajícího požadavku brání duplicitnímu opakování. Nekoná se globální invalidace cache.
- Pokud selže samotný seznam projektů a pro vybrané ID ještě neexistuje dotaz na detail, obrazovka hlásí chybu načtení a opakuje pouze seznam projektů. Selhání seznamu se nepovažuje za důkaz nedostupnosti projektu.
- Dotaz na řádek projektu používá `maybeSingle()`: potvrzený prázdný výsledek ukládá do cache `null` a nahrazuje předchozí detail. RLS a autentizace zůstávají v existujícím databázovém adaptéru. Databázové zprávy se nevypisují do obrazovky.
- Nedostupný detail není ani v mapě dříve otevřených projektů. Síťová chyba dalšího pokusu, změna obrazovky ani zrušení dotazu původní data neobnoví; dostupnost obnoví až úspěšné načtení skutečného detailu. Běžný výpadek bez předchozího potvrzení nedostupnosti nadále zachovává poslední úspěšná data. Chyba jiného projektu neovlivňuje stav otevřeného detailu.

## Ověření a provoz

Regresní testy pokrývají chybu, opakování pouze jednoho požadavku, souběžná kliknutí, přepnutí projektu, chybějící řádek, cizí ID v cache, lokální načítání a čekání na seznam projektů. Testy obrazovky ověřují zprávy, skeleton, tlačítka, návrat na `/app/projects` a úspěšně načtený detail.

Ruční kontrola: otevřít projekt při nedostupném požadavku na jeho detail, ověřit chybovou zprávu, obnovit spojení a zvolit **Zkusit znovu**. Otevřít nedostupné ID a ověřit zprávu **Projekt není dostupný**, potom použít **Zpět na projekty**.

Změna nevyžaduje migraci, nové proměnné prostředí ani nové závislosti. GitHub před implementací nevracel analýzy Code Scanning a měl vypnutá upozornění Dependabot; úspěšné CI tyto chybějící signály nenahrazuje.

Audit závislostí v CI prvního commitu opravy prošel s prahem `high`, ale hlásil sedm nálezů střední závažnosti v existujících závislostech (xmldom, fflate a qs včetně navazujících balíčků). Aktualizace těchto závislostí je samostatný rozsah práce.

## Start aplikace, hledání a přehledy

Start čeká na základní seznamy projektů, kontaktů a stavů, nikoli na detaily portfolia. Jeden otevřený projekt nadále používá své existující detailové dotazy. Již načtený detail se využije z React Query cache podle dosavadní doby čerstvosti.

Globální hledání načte index poptávek při prvním otevření. Investor a adresa jsou součástí již staženého seznamu projektů. Index obsahuje pouze ID, názvy, popisy a pracovní položky kategorií, bez nabídek, smluv a finančních dat. Dotazy mají filtr viditelných projektů, dávky nejvýše 100 projektů a stránky po 500 kategoriích se stabilním řazením podle ID. Stránkování pokračuje až do konce, aby standardní limit odpovědi neomezil úplnost hledání. Výsledky jsou navíc filtrovány proti aktuálnímu seznamu viditelných projektů; cache indexu je oddělena podle uživatele a celé množiny ID. Databázové RLS se neobcházejí.

Během načítání hledání ukazuje průběh; při chybě vysvětlí neúplnost a nabídne opakování. Změna projektu nebo kategorie zneplatní index. Názvy projektů se pro výsledky kategorií odvozují vždy z aktuálního seznamu, včetně přejmenování ve správě staveb. Změna uživatele resetuje požadavek na načtení indexu, i když desktopový renderer zůstává otevřený. Demo hledání používá místní data. Úkoly a smlouvy se do vyhledávání touto změnou nepřidávají.

Přehledy používají existující `get_overview_tenant_data`, včetně jeho kontroly organizace a projektových oprávnění. I prázdný úspěšný souhrn je autoritativní; nenahrazuje se detailem posledního otevřeného projektu. Načítání a chyba mají vlastní obrazovku s možností opakování. Osobní projekty bez organizace, které tenant RPC nepokrývá, doplňuje `fetchPersonalProjectOverview`: načítá pouze analytické sloupce projektů, kategorií, nabídek, investorské ceny a dodatků. Dotazy používají RLS, viditelná ID, dávky a stránkování; nejprve znovu ověří dostupnost osobních projektů. Souhrn zachovává termíny kategorií pro analytiku dodavatelů; nestahuje obsah souborů, smluvní parametry ani faktury. Selhání kterékoli části zabrání zobrazení neúplného přehledu a nabídne opakování. Demo přehled používá úplná místní demo data až při otevření přehledu.

Ruční kontrola startu: v síťovém panelu otevřít TODO a ověřit absenci požadavků na detailové tabulky. Otevřít hledání, najít pracovní položku dosud neotevřeného projektu a otevřít kategorii. Detailové požadavky musí patřit jen tomuto projektu. Přehled musí použít souhrnný RPC a po vynucené chybě nabídnout **Zkusit znovu**.

Souhrnná cache se zneplatní také po úspěšném uložení, přidání nebo smazání nabídky, změně jejího stavu či příznaku smlouvy a při realtime události nabídky. Událost se publikuje až po potvrzení databázového zápisu, takže návrat do přehledu nezůstane na starých součtech; neúspěšný zápis se za uloženou změnu nepovažuje.

Rollback neúspěšné úpravy nebo archivace neobnovuje původní detail, pokud mezitím refetch přístup zamítl nebo cache zanikla. Ověřují to regrese s rozpracovanou mutací a následnou síťovou chybou.

## Přidávání dodavatelů do pipeline

Přidání má synchronní zámek a stav `Přidávám…`. Do detailu se zapisují až potvrzené řádky. Před sloučením se ruší starý dotaz přes `cancelQueries`; následně se obnovuje přesný klíč `['projectDetails', projectId]`. Chyba obnovy zachová potvrzená data a hlásí úspěšné uložení s neúspěšnou obnovou. Zaniklá nebo zamítnutá cache se nevytváří znovu. Dokončení operace nesmí zavřít výběr jiné kategorie či projektu.

`insertBids` používá konflikt na dvojici `(demand_category_id, subcontractor_id)` s `ignoreDuplicates: true`, tedy bez aktualizace původní nabídky. Čtení následně načte nové i existující řádky pod RLS v dávkách nejvýše 100 ID. Po transportní chybě ověřuje zápis stejným čtením; neopakuje automaticky INSERT. Při neúplném výsledku lze přidání bezpečně zopakovat. Zápis má timeout 30 sekund, každá dávka ověřovacího čtení 15 sekund. Jedinečnost zajišťuje databáze i mezi klienty. Realtime naslouchá změnám `bids` včetně INSERT a zneplatňuje odpovídající detail; interval zůstává záložním mechanismem. DocHub spouští vytvoření složek pouze pro řádky vrácené jako nově vložené. Při ztracené odpovědi nelze novost spolehlivě určit a složky případně doplní existující DocHub fallback.

Oprava vyžaduje migraci `20260907093847_unique_pipeline_supplier.sql`. Před nasazením webového kódu provést dry-run a kontrolu konfliktních dvojic. Migrace při existujících duplicitách selže bez mazání řádků; během tvorby omezení znovu kontroluje jedinečnost PostgreSQL. Nemění RLS, granty, vazby ani data; neprovádí backfill a zachovává legacy řádky s NULL identifikátorem. Po aplikaci ověřit omezení `bids_category_supplier_key`, počty, RLS/granty a finální dry-run. Stejný název firmy s různými ID kontaktů se automaticky neslučuje. Není potřeba nový balíček ani nové proměnné prostředí.

Regrese: `tests/usePipelineSubcontractorSelection.persistence.test.tsx`, `tests/pipelineApi.insertBids.test.ts`, `tests/pipelineRepository.insertBids.test.ts` a testy selector modalu/realtime. SQL scénář `supabase/tests/pipeline-supplier-idempotency.sql` se spouští **pouze v prázdné lokální testovací databázi**: vytváří syntetickou tabulku a dvě role, aplikuje skutečnou migraci a ověřuje zachování cen, použití jiné kategorie, chování RLS a zákazu zápisu čtenáři. Jeho RLS fixture ověřuje chování PostgreSQL při konfliktu; nenahrazuje audit existujících produkčních pravidel projektu a předplatného. Dvě nezávislé transakce se shodnou dvojicí a různými ID musí skončit jediným řádkem; druhá transakce nesmí změnit hodnoty první.
