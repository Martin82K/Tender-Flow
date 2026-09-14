# Propojení výběrových řízení a smlouvy

Jedna smlouva může pokrývat více VŘ ve stejné stavbě. Každé VŘ (kategorie, nikoli pouze jednotlivá nabídka dodavatele) může mít nejvýše jednu smlouvu. Ve VŘ lze vybrat i smlouvu, která je už propojena s jiným VŘ. Výběr se uloží až po potvrzení. Na kartě je přechod do Smluv; při historické nejednoznačnosti zůstává výběr záznamu.

V detailu smlouvy v Přehledu je seznam propojených VŘ. Kliknutí otevře konkrétní kartu dodavatele. Výběr pro přidání dalšího VŘ nabízí pouze volná VŘ této stavby, včetně názvu nabídky dodavatele. Odpojení vyžaduje potvrzení a odstraní jen zvolenou vazbu. Smlouva, dokumenty, faktury a ostatní propojení zůstávají; smlouva může zůstat i bez VŘ.

## Data a bezpečnost

Migrace `20260914184136_shared_contract_tenders.sql` zavádí `contract_bid_links`. Primární klíč nabídky a unikátní kategorie vynucují jednu smlouvu na VŘ i při souběžném zápisu. Složené cizí klíče na smlouvu, kategorii a nabídku vynucují shodnou stavbu a brání přesunu propojených dat do jiné stavby. Smazání rodiče odstraní pouze příslušné vazby.

Stávající `contracts.source_bid_id` zůstává zdrojovým údajem pro starší klienty. Migrace převádí všechny staré vazby a při neplatném nebo nejednoznačném vstupu skončí chybou bez částečného převodu. Trigger podporuje stávající vytváření smlouvy z nabídky. Nové propojení přidává řádek a nepřepisuje zdroj ani ostatní vazby. Atomické odpojení vymaže také zdrojové ID, pokud ukazuje právě na odpojovanou nabídku. Načtený seznam vazeb je autoritativní, i když je prázdný.

RLS čtení vyžaduje dostupnou smlouvu. Trigger zápisu provede UPDATE rodičovské smlouvy jako volající, čímž uplatní její skutečné policies pro úpravy, předplatné a moduly. Nepoužívá SECURITY DEFINER. Přidání navíc vyžaduje dostupnou nabídku. Anonymní role nemá přístup; aplikační klient nemá UPDATE nové vazební tabulky. UI není bezpečnostní hranice.

Finanční přehledy stále pracují s jedním řádkem na smlouvu, s vnořeným seznamem vazeb. Cena, fakturace a pozastávky se násobením počtu VŘ nemění. Automatické rozdělování částek mezi VŘ se nepřidává.

Exporty záloh obsahují vazby uvnitř smlouvy. Obnova zachovává dosavadní ověření vlastníka/organizace a obnoví vazby až po smlouvách a nabídkách; cizí nebo konfliktní vazbu nepřepíše. Starší záloha bez seznamu vazeb zůstává podporovaná přes zdrojové ID. Obalové funkce ponechávají původní kontrolu oprávnění a původní implementace nelze samostatně volat aplikační rolí.

## Ověření

Regresní testy pokrývají přiřazení už použité smlouvy, přechod z dalšího VŘ, ochranu obsazené kategorie, potvrzení odpojení, chyby, autoritativní prázdný seznam a finanční součet jedné sdílené smlouvy. `npm run test:project-ui` ověřuje sdílené propojení a odpojení ve skutečných komponentách s produkčním CSS a syntetickými daty.

Databázový test `scripts/check-shared-contract-links.mjs` spustí migraci v PGlite a ověří constraints, RLS, převod, původní vytváření smlouvy, odpojení, zálohy a cascade. Vyžaduje již nainstalovaný `@electric-sql/pglite`, případně cestu k modulu přes `PGLITE_MODULE`; sám žádné balíčky nestahuje.

Produkční preflight 14. 9. 2026 našel 11 původních vazeb, žádnou chybějící nabídku, mezistavební vazbu ani více smluv v kategorii. Zkušební migrace v transakci zakončené ROLLBACK převedla všech 11 vazeb. Před nasazením musí projít dry-run; po nasazení kontrola katalogu, počtů, advisors a závěrečný dry-run.

Historii rozšíření identifikátorů popisuje [audit dlouhých ID](bid-id-width.md).


Nasazení 14. 9. 2026 zachovalo všech 73 smluv se shodným kontrolním součtem i všech 11 původních vazeb. RLS je aktivní, anonymní čtení/RPC a přímý klientský UPDATE vazeb jsou zakázané. Navazující migrace `20260914185726_index_shared_contract_tender_foreign_keys.sql` pokrývá oba sloupce nových složených FK. Advisors nadále obsahují starší nálezy (mimo objekty této změny) a nepoužité nové indexy; nové bezpečnostní nálezy na vazební tabulce nevznikly.


Opravy review doplňuje `20260914190809_harden_shared_contract_tender_review.sql`: každý DELETE vazby synchronizuje zdrojové ID, obnova kontroluje aktuální právo upravovat projekt a smlouvy, velikost a počty historie zálohy se zapisují z rozšířeného manifestu. MCP dostává pouze čtecí přístup k vazbám dostupných smluv; veřejné výstupy obsahují `linkedBidIds`. Edge Function `mcp-get-project-detail` zachovává ověření JWT. Původní migrace v tomto PR používá detekci `category_id` / `demand_category_id`, takže ji lze aplikovat i na starší schéma; opravy již nasazených funkcí provádí navazující verzovaná migrace.


Přejmenované původní exporty mají po opravě review pevný `search_path`. Migrace `20260914191602_keep_shared_backup_manifest_single_snapshot.sql` vrací přesně manifest použitý při zápisu historie; vnější wrapper už vazby znovu nenačítá, takže souběžná změna vazeb nemůže změnit velikost výsledku až po zápisu historie.
