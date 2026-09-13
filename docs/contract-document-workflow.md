# Dokumenty smlouvy a předání díla

Detail smlouvy zachovává seznam vlevo a souhrn smlouvy nad pěti záložkami:

- **Přehled:** údaje smlouvy, obchodní podmínky, dodatky a návrat na zdrojovou kartu VŘ.
- **Dokumenty:** vytvořené protokoly, historie verzí, finální soubory, původní smlouva a soubory dodatků s dosavadním OCR.
- **Fakturace:** faktury a čerpání.
- **Pozastávky:** krátkodobé a dlouhodobé pozastávky a jejich samostatné uvolnění.
- **Předání a záruka:** skutečné předání, samostatný počátek záruky a historie potvrzení.

## Vytvoření protokolu

V Dokumentech zvolte Vytvořit dokument → Předávací protokol. Údaje se předvyplní z vybrané smlouvy a stavby, údaje organizace a její logo z organizace stavby. Adresa a kontakty subdodavatele se načítají přes dodavatele navázaného na smlouvu; pokud vazba chybí, lze je dopsat. Souhrn údajů lze rozbalit a upravit pouze pro tento dokument.

Vyplňte zástupce, rozsah celého díla nebo jeho části, skutečné datum a výsledek. Datum ani výsledek se nedoplňují automaticky. Vady a nedodělky mají víceřádkové editovatelné pole. Prázdné pole neznamená „bez vad“. Volba 0, 5 nebo 10 prázdných řádků přidá prostor pro ruční zápis; lze ji kombinovat s vyplněným textem. Doklady a přílohy mají samostatné pole.

Uložit koncept uloží obsah. Pokračovat na náhled uloží verzi a zobrazí její skutečný PDF výstup. PDF i DOCX vycházejí z téže verze, včetně tehdejšího loga a údajů. DOCX obsahuje editovatelný text, podpisy a stránkování. Delší obsah se rozloží na další stránky. Chybějící logo organizace se nenahrazuje logem aplikace. Patička uvádí Tender Flow, datum vytvoření, verzi a stránku.

Úprava uloženého dokumentu vytváří další verzi; předchozí obsah se nepřepisuje. Souběžnou změnu jiného uživatele aplikace oznámí a vyžádá otevření nejnovější verze. Průvodka subdodávky je zatím označena „Připravujeme“.

## Finální soubor a potvrzení

Ve Verze a připojené soubory nahrajte finální PDF nebo externě upravený DOCX do 20 MB. Nahrání souboru nepotvrzuje podpis, předání ani začátek záruky. Změny provedené mimo aplikaci se automaticky neimportují zpět do smlouvy nebo formuláře.

Skutečné předání zapište v Předání a záruka, s datem, výsledkem a zdrojem (například číslo a verze podepsaného protokolu nebo záznam stavbyvedoucího). Počátek záruky potvrďte samostatně. Historie zaznamenává autora, serverový čas a zdroj; oprava je nový záznam. Uvolnění pozastávek je vždy samostatná akce.

Dřívější datum podpisu a termín dokončení se zachovávají. Nejsou důkazem skutečného předání a nově se nepoužívají jako potvrzený začátek záruky. Dokud ho uživatel nepotvrdí, datum konce záruky a příslušné upozornění zůstávají neurčené. Dosavadní XLSX generátor a provizorní předání staveniště zůstávají dostupné přes stávající rozhraní.

## Správa a bezpečnost

Vyžaduje migraci `20260913191425_contract_document_workflow.sql`. Přidává tři tabulky s RLS, privátní bucket `contract-protocol-files`, řízené funkce a nullable sloupec `contracts.warranty_start_at`. Nepřevádí žádná historická data. Nasazujte migraci před frontendem. Bez migrace Dokumenty zobrazí vysvětlující chybu.

Klient má nad historií pouze SELECT; zápisy probíhají přes funkce s kontrolou přihlášení, předplatného a oprávnění ke konkrétní stavbě. Archivovaná stavba zůstává bez zápisu. Funkce nepřebírají autora a čas od klienta. Cizí smlouvu nelze použít jako další verzi existujícího dokumentu. Storage kontroluje smlouvu, konkrétní verzi, velikost a MIME typ. Přepsání souboru není povoleno. Neúspěšně připojený vlastní soubor lze odstranit pouze dokud nemá uloženou vazbu.

Smazání smlouvy odstraní databázové vazby k dokumentům; soubory v privátním storage pak nejsou přístupné přes běžná oprávnění. Jejich fyzické odstranění patří do správcovského úklidu osiřelých objektů. Tato změna nepřidává automatické mazání uživatelských dokumentů.

Vrácení frontendu nevyžaduje odstranění datové migrace. Při případném rollbacku zachovejte verze, soubory i auditní historii.

Desktopová CSP povoluje `blob:` pouze navíc ve frame-src pro náhled PDF vytvořený v paměti. Skripty nadále vyžadují vlastní původ a object-src zůstává none. Nové vzdálené zdroje se nepřidávají.
