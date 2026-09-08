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

`insertBids` používá RPC `insert_pipeline_bids` s oprávněními volajícího (`SECURITY INVOKER`). Transakční advisory zámek na dvojici kategorie/dodavatel serializuje požadavky aktualizovaných klientů; existující nabídku nepřepisuje. Funkce přijme nejvýše 1 000 položek / 2 MiB a vrací jen nově vložené řádky; API větší výběr rozdělí do dávek 1 000. Čtení následně načte nové i existující řádky pod RLS v dávkách nejvýše 100 ID. Po transportní chybě, HTTP 408/429 či 5xx ověřuje zápis stejným čtením; neopakuje automaticky zápis. Pokud pozdější dávka selže, ověří a vrátí částečný výsledek: potvrzené řádky sloučí do cache, oznámí změnu přehledu a vytvoří složky pro prokazatelně nové nabídky. Dialog oznámí částečné uložení a pro retry ponechá jen nepotvrzené dodavatele. Autorizační či validační chybu první dávky nepřevádí na úspěch. Výpadek ověřovacího čtení nezahodí řádky z úspěšného RPC RETURNING; novější úspěšné čtení má naopak přednost i tehdy, pokud řádek už kvůli RLS nebo smazání nevrátí. Při neúplném výsledku lze přidání bezpečně zopakovat. Zápis má klientský timeout 30 sekund, zámek 5 sekund a každá dávka ověřovacího čtení 15 sekund. Zámky se získávají v jednotném pořadí; RPC počítá s běžnou izolací PostgREST `READ COMMITTED`. Historické nabídky se stejným dodavatelem zůstávají samostatné podle ID, včetně obchodních hodnot.

Realtime odebírá výhradně INSERT a UPDATE pod SELECT RLS. DELETE se neodebírá, protože Postgres Changes tyto události tenantově nefiltruje; pro mazání zůstává lokální invalidace a periodická obnova. Viz [dokumentace Supabase](https://supabase.com/docs/guides/realtime/postgres-changes). DocHub vytváří složky jen pro prokazatelně nové řádky a dokončí je pro původní projekt i po změně zobrazení či odchodu z komponenty; upozornění se zobrazují pouze v původním stále aktivním kontextu. Při ztracené odpovědi jejich doplnění zajistí existující DocHub fallback.

Oprava vyžaduje migraci `20260907093847_idempotent_pipeline_supplier.sql` před nasazením aplikace. Přidává RPC a neunikátní podpůrný index. Před nasazením provést dry-run a zaznamenat počty/fingerprint dat, RLS, granty a vazby; po aplikaci ověřit stejné hodnoty, index, invoker režim a oprávnění funkce, advisors a finální dry-run. Migrace nemění existující data, RLS, tabulkové granty, cizí klíče ani obnovovací funkce. Nepřidává unikátní omezení či trigger, proto zachovává obnovu všech historických řádků i staré desktopové INSERT cesty. Ty nové RPC nepoužívají a jejich původní riziko duplikace zůstává do aktualizace klienta; současný souběh se starým INSERT nebo obnovou zálohy není součástí záruky idempotence nové RPC. Není potřeba nový balíček ani nové proměnné prostředí.

Regrese: `tests/usePipelineSubcontractorSelection.persistence.test.tsx`, `tests/pipelineApi.insertBids.test.ts`, `tests/pipelineRepository.insertBids.test.ts`, `tests/pipelineBidPersistence.test.ts` a testy selector modalu/realtime. SQL scénář `supabase/tests/pipeline-supplier-idempotency.sql` se spouští **pouze v prázdné lokální testovací databázi**: vytváří syntetickou tabulku a role, aplikuje skutečnou migraci a ověřuje zachování cen i historických duplicit, starý INSERT a obnovovací `ON CONFLICT(id)`, jiné kategorie a omezení RLS/oprávnění. Fixture nenahrazuje úplný test produkčních obnovovacích funkcí ani politik projektu a předplatného. Dvě nezávislé transakce nové RPC se shodnou dvojicí a různými ID musí skončit jediným novým řádkem; druhá transakce nesmí změnit hodnoty první.

### Ověření nasazení 8. září 2026

Migrace `20260907093847_idempotent_pipeline_supplier.sql` je nasazená v propojeném projektu Tender Flow. Preflight i následná kontrola zaznamenaly 2 848 nabídek, nulový počet duplicitních dvojic a shodný otisk všech hodnot. Sloupce, RLS politiky, tabulkové granty, triggery, constraints a definice obou obnovovacích funkcí zůstaly shodné. Nový neunikátní index je validní a připravený; RPC používá invoker režim, prázdný `search_path` a `lock_timeout=5s`, bez EXECUTE pro PUBLIC/anon.

Produkční kontrola v transakci ukončené ROLLBACK ověřila prázdný vstup, odmítnutí neplatného vstupu, zápisu bez oprávnění a anonymního volání. Nezanechala testovací nabídky. Závěrečný `supabase db push --dry-run` oznámil `Remote database is up to date.` Bezpečnostní a výkonnostní advisors mají stejné kategorie a počty nálezů jako před nasazením; existující nálezy nejsou tímto PR vyřešené.

CLI 2.70.5 při nasazení upozornilo, že úvodní `SET LOCAL` nemá účinek mimo explicitní transakci. Nespoléháme proto na tyto dva příkazy jako na prokázaný limit nasazení indexu. Migrace doběhla, historie i oba objekty byly ověřeny samostatně; funkční `lock_timeout=5s` RPC je potvrzen v katalogu.

Po integraci aktuálního `main` prošlo 505 testovacích souborů / 2 687 testů bez skipped/todo a neočekávaného stderr, typecheck, web build, desktop TypeScript compile, dokumentace, boundaries i legacy structure. Prohlížeč ověřil sestavené komponenty proti řízeným odpovědím RPC: pomalý zápis, blokaci opakovaného odeslání, jedinou kartu po retry, částečný úspěch, zachování ceny a výpadek ověřovacího čtení. Desktopový přihlášený tok ani zápis skutečné obchodní nabídky v produkci tento závěrečný smoke test neprováděl.
