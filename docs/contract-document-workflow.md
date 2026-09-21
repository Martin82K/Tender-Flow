# Dokumenty stavby a předání subdodavatelů

Detail smlouvy zachovává seznam vlevo a souhrn smlouvy nad pěti záložkami:

- **Přehled:** údaje smlouvy, obchodní podmínky, dodatky a návrat na zdrojovou kartu VŘ.
- **Dokumenty:** odkaz na předávací protokoly v Dokumentech stavby, původní smlouva a soubory dodatků s dosavadním OCR.
- **Fakturace:** faktury a čerpání.
- **Pozastávky:** krátkodobé a dlouhodobé pozastávky a jejich samostatné uvolnění.
- **Předání a záruka:** odkaz na skutečné předání v Dokumentech stavby, samostatný počátek záruky a historie jeho potvrzení.

## Vytvoření protokolu

V sidebaru rozbalte **Dokumenty → Subdodavatel**. Přehled seskupuje smlouvy a počty protokolů podle identity subdodavatele. Záložka **Předávací protokoly** nabízí hledání, filtr smlouvy a typu. Bez smlouvy se zobrazí vysvětlení a **Přejít na smlouvy**; bez práva upravovat smlouvy zůstávají zápisy zakázané s uvedeným důvodem. Neplatný filtr smlouvy v URL neblokuje založení záznamu. Klikněte na **Nový záznam**, vyberte smlouvu a typ **Předání staveniště** nebo **Předání díla**, doplňte název, plánované datum, rozsah a interní poznámku. Zvolte editor nebo připojení souboru po uložení.

**Dokumenty → Objednatel** ukládá kartu identity objednatele (firma, IČO, adresa, jeden kontakt a interní poznámka). Není to finanční smlouva. **Smlouvy → Objednatel** dál eviduje SOD, dodatky, faktury a pozastávky; jméno z karty se do `customerName` zapíše jen po výslovném potvrzení. Sdružení, Evidence reklamací a horizontální Ostatní dokumenty zobrazují **Ve vývoji**. Dosavadní Ceníky zůstávají dostupné v rozbalené sekci Dokumenty.

V editoru Údaje se předvyplní z vybrané smlouvy a stavby, údaje organizace a její logo z organizace stavby. Adresa a kontakty subdodavatele se načítají přes dodavatele navázaného na smlouvu; pokud vazba chybí, lze je dopsat. Souhrn údajů lze rozbalit a upravit pouze pro tento dokument.

Vyplňte zástupce, rozsah celého díla nebo jeho části, skutečné datum a výsledek. Datum ani výsledek se nedoplňují automaticky. Vady a nedodělky mají víceřádkové editovatelné pole. Prázdné pole neznamená „bez vad“. Volba 0, 5 nebo 10 prázdných řádků přidá prostor pro ruční zápis; lze ji kombinovat s vyplněným textem. Doklady a přílohy mají samostatné pole.

Uložit koncept uloží obsah. Pokračovat na náhled uloží verzi a zobrazí její skutečný PDF výstup. PDF i DOCX vycházejí z téže verze, včetně tehdejšího loga a údajů. DOCX obsahuje editovatelný text, podpisy a stránkování. Delší obsah se rozloží na další stránky. Velké logo se před uložením zmenšuje podle skutečné velikosti PNG, aby spolu s textem nepřekročilo limit dokumentu. Chybějící logo organizace se nenahrazuje logem aplikace. Patička uvádí Tender Flow, datum vytvoření, verzi a stránku.

Úprava uloženého dokumentu vytváří další verzi; předchozí obsah se nepřepisuje. Souběžnou změnu jiného uživatele aplikace oznámí a vyžádá otevření nejnovější verze. Protokol staveniště navíc obsahuje podmínky přístupu, BOZP, zařízení staveniště a přípojky. Interní poznámka ani plánované datum se nepovažují za skutečné předání.

## Úprava a smazání záznamu

Záznam otevřete přes **Otevřít**. **Upravit záznam** uloží změny jako novou verzi, **Náhled a export** zpřístupní obsah. **Smazat záznam** vyžaduje potvrzení; odstraní protokol z běžných seznamů. Jde o logické smazání: obsah všech verzí, přílohy i důkazy skutečného předání zůstávají pro audit. U smazaného protokolu již nelze uložit další verzi, přílohu ani potvrzení. Novější souběžná verze smazání odmítne a vyžádá obnovení seznamu.

Vyžaduje migraci `20260918125709_document_protocol_crud.sql`; nasadit před frontendem. Test `supabase/tests/document_protocol_crud.sql` ověřuje CRUD, konflikty a oprávnění s rollbackem. Migrace přidává pouze metadata smazání, žádný existující protokol nemaže a nemění záruku.

## Finální soubor a potvrzení

V detailu záznamu v části Soubory a historie verzí nahrajte finální PDF nebo externě upravený DOCX do 20 MB. Nahrání souboru nepotvrzuje podpis, předání ani začátek záruky. Změny provedené mimo aplikaci se automaticky neimportují zpět do smlouvy nebo formuláře.

Skutečné předání zapište akcí **Zapsat skutečné předání** v detailu dokumentu, s datem, výsledkem a zdrojem (například číslo a verze podepsaného protokolu nebo záznam stavbyvedoucího). Potvrzení patří přesně k vybrané verzi. Nová verze se nepovažuje za potvrzenou automaticky. Starší potvrzení smlouvy bez vazby na protokol zůstávají čitelná ve smlouvě i bez vytvořeného dokumentu a jsou také v oddělené historii detailu protokolu. Počátek záruky potvrďte samostatně ve smlouvě. Historie zaznamenává autora, serverový čas a zdroj; oprava je nový záznam. Uvolnění pozastávek je vždy samostatná akce.

Dřívější datum podpisu a termín dokončení se zachovávají. Nejsou důkazem skutečného předání a nově se nepoužívají jako potvrzený začátek záruky. Tabulkový XLSX export používá stejný potvrzený počátek jako detail smlouvy. Dokud ho uživatel nepotvrdí, datum konce záruky a příslušné upozornění zůstávají neurčené. Dosavadní XLSX generátor a provizorní předání staveniště zůstávají dostupné přes stávající rozhraní.

## Správa a bezpečnost

Vyžaduje základní migraci `20260913191425_contract_document_workflow.sql` a rozšíření `20260918083859_subcontractor_document_workspace.sql`. Rozšíření přidává typ staveniště a vazbu auditní události na verzi, zachovává všechny starší záznamy a nemění oprávnění storage. Přidává tři tabulky s RLS, privátní bucket `contract-protocol-files`, řízené funkce a nullable sloupec `contracts.warranty_start_at`. Nepřevádí žádná historická data. Nasazujte migraci před frontendem. Bez migrace Dokumenty zobrazí vysvětlující chybu.

Klient má nad historií pouze SELECT; zápisy probíhají přes funkce s kontrolou přihlášení, předplatného a oprávnění ke konkrétní stavbě. Archivovaná stavba zůstává bez zápisu. Funkce nepřebírají autora a čas od klienta. Cizí smlouvu nelze použít jako další verzi existujícího dokumentu. Storage kontroluje smlouvu, konkrétní verzi, velikost a MIME typ. Přepsání souboru není povoleno. Neúspěšně připojený vlastní soubor lze odstranit pouze dokud nemá uloženou vazbu.

Smazání smlouvy odstraní databázové vazby k dokumentům; soubory v privátním storage pak nejsou přístupné přes běžná oprávnění. Jejich fyzické odstranění patří do správcovského úklidu osiřelých objektů. Tato změna nepřidává automatické mazání uživatelských dokumentů.

Vrácení frontendu nevyžaduje odstranění datové migrace. Při případném rollbacku zachovejte verze, soubory i auditní historii.

Desktopová CSP povoluje `blob:` pouze navíc ve frame-src pro náhled PDF vytvořený v paměti. Skripty nadále vyžadují vlastní původ a object-src zůstává none. Nové vzdálené zdroje se nepřidávají.

## Ověření rozšíření

`supabase/tests/subcontractor_document_workspace.sql` ověřuje v transakci s rollbackem uložení obou typů, souběžné verze, potvrzení, nezměněnou záruku, RLS cizího uživatele a zákaz anonymního zápisu. Před nasazením použijte `supabase db push --linked --dry-run`, po nasazení test a kontrolu schématu, počtů a advisorů. Závěrečný dry-run musí hlásit aktuální databázi.

Při kontrole 18. 9. 2026 advisor označuje nové potvrzovací RPC jako dostupné přihlášeným uživatelům v režimu SECURITY DEFINER. To je úmyslné: klient nemá přímý INSERT a funkce ověřuje uživatele, aktivní předplatné i právo zápisu konkrétní stavby; anonymní EXECUTE je odebrané a search_path je pevný. Nový index vazby na verzi je zatím bez provozního využití. Viz [kontrola oprávnění funkcí](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) a [využití indexů](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). Další hlášení advisorů mimo dokumentovou agendu nejsou součástí této změny.

CRUD kontrola 18. 9. 2026: novým nálezem advisoru je záměrně dostupné `delete_contract_document` v režimu SECURITY DEFINER, chráněné přihlášením, předplatným, právem ke konkrétní stavbě, zákazem archivované stavby a očekávanou verzí. Klient stále nemá přímý UPDATE ani DELETE; anonymní EXECUTE je zakázané. Viz [kontrola oprávnění funkcí](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Nový index autora smazání zatím není využitý; kryje cizí klíč. Viz [využití indexů](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). Produkční počty po migraci zůstaly beze změny a žádný existující dokument nebyl označen jako smazaný.
