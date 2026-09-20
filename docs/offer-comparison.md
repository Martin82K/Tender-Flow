# Porovnání nabídek

V detailu VŘ otevřete **Porovnat nabídky**. Základem je samostatný poptávkový XLSX, nebo konkrétní revize rozpočtu s množstvím přiřazeným do tohoto VŘ. Interní rozpočtové ceny se do základny nepřenášejí. V desktopu výběr souboru začíná ve složce VŘ ze Složkomatu; web používá výběr existujícího lokálního souboru.

1. Zkontrolujte listy a mapování kódu, popisu, MJ, množství a cen.
2. Přidejte dodavatelské XLSX/PDF. Shoda kódu sama nestačí: kontrolují se popis, jednotka, množství a objekt. Duplicitní protějšky zůstávají k ověření.
3. Nejasnou vazbu vyhledejte a potvrďte. Odlišné množství/MJ se nepřepočítává. Nulová cena, chybějící cena a nespárovaná položka jsou odlišné stavy.
4. Ověřte shodnou měnu a režim DPH originálů. Automatická detekce měny, konverze ani normalizace DPH nejsou součástí tohoto pohledu.
5. Uložte pohled a případně exportujte XLSX/PDF. Pruhy pokračují přes všechny sloupce. PDF dělí dodavatele po třech a opakuje hlavičky.

Součty zahrnují jen spárované položky se shodnou MJ a množstvím, nejsou vždy celkovou cenou nabídky. Výhrady a položky bez protějšku zůstávají dostupné. Zdrojové soubory, rozpočet a souhrnné ceny nabídek se nemění. Nový soubor vyžaduje nový snapshot/párování; původní soubor se nehlídá na pozadí. Změna rozpočtové revize blokuje uložení zastaralého pohledu. Souběžná editace vrací konflikt místo přepsání cizích změn.

## Mistral a MCP

XLSX nepotřebuje OCR. Mistral je volitelný a firma jej musí povolit v administraci. Uživatel ještě výslovně povoluje odeslání vybraného PDF nebo malé dávky nejasných položek. PDF má limit 10 MB / 20 stran; XLSX 30 MB, 100 listů a 10 000 položek. OCR a extrakce nejsou důkazem správnosti — vazby z PDF zůstávají k ručnímu ověření. Strana zdroje je zachována, číslo řádku u PDF je pořadí extrahované položky, nikoli přesná souřadnice originálu.

AI párování navrhuje pouze dodané kandidáty, ceny neposílá a vazby samo nepotvrzuje. V administraci jsou spotřeba, model/verze, odhad USD, neznámé náklady, neúspěšné pokusy a uživatelsky ověřené správné/chybné návrhy. Neověřené návrhy se do úspěšnosti nezapočítávají. Přehled zobrazuje nejvýše 1 000 běhů za vybrané období; není účetní fakturací.

MCP používá stejný deterministický engine bez volání Mistralu. Externí asistent si zdroj přečte dostupným klientským nástrojem a předá položky. Jeho předplatné/spotřebu TF nezná. Nové nástroje jsou v [MCP referenci](mcp/tools-reference.md).

## Nasazení a provoz

Před zapnutím:

- Prověřit a aplikovat migrace `20260920123012`, `20260920123359`, `20260920123919` po existujících migracích rozpočtu a podepsaných záloh. Použít linked-project preflight, `supabase db push --dry-run`, verzované migrace a následný dry-run bez změn. Ověřit katalog, granty/RLS, cizí klíče a Supabase security/performance advisors.
- Nasadit `offer-assist` s ověřením JWT, např. `supabase functions deploy offer-assist --use-api`.
- Nastavit serverové secrets `MISTRAL_API_KEY`, `OFFER_OCR_MODEL`, `OFFER_MATCH_MODEL`, `OFFER_MODEL_PRICES_JSON`. Modely a sazby musí odpovídat aktuální smlouvě/ceníku. JSON je mapa přesného ID modelu na `{version, inputPerMillion, outputPerMillion, perPage}`; chat vyžaduje kladné sazby za milion vstupních/výstupních tokenů, OCR kladnou sazbu za stranu. Klíče nikdy nepatří do VITE proměnných.
- Povolit zpracování v administraci firmy a určit měsíční USD limit. Bez modelu, sazebníku nebo povolení firmy se placené volání neuskuteční. Tato změna sama žádný model ani sazebník v produkci nezapíná.

Před každým voláním se v transakci rezervuje konzervativní odhad; souběžné požadavky zamykají nastavení firmy. Opakování stejného request ID nepřidává volání. Dokončení ukládá spotřebu, použitý sazebník a odhad ceny; při chybě/neznámé spotřebě zůstává rezervace v měsíčním limitu. Nové uživatelské spuštění je nový pokus a může znovu stát peníze. Zvláště při chybě uprostřed vícestránkového PDF nejprve zkontrolujte statistiku. Automatické síťové retry jsou vypnuté.

Výsledky OCR a návrhů jsou v neveřejné tabulce pro idempotenci a ověření zpětné vazby. V administraci se obsah nezobrazuje; audit MCP jej nezapisuje. Záznamy jsou oddělené podle firmy a projektu, původce může být smazán bez odstranění pohledu. Projektové pohledy se mažou s projektem; provozní spotřeba zůstává ve firmě s prázdným projektem/původcem, při smazání firmy se maže. Automatická retenční lhůta záznamů spotřeby není nastavena. Podepsaná projektová/tenant záloha obsahuje snapshoty porovnání a hashe, nikoli externí soubory ani provozní statistiku.

## Ověření

Cílené testy: `npm run test:run -- tests/offers`. Databázová regrese: `PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node --test tests/postgres/offerComparison.test.mjs` (samostatný existující auditovaný runtime, žádná produkční data). Testuje granty, cizí projekt/VŘ, souběh verzí, retry, rezervace limitu, správce, feedback, zálohu/obnovu a mazání. Běžná CI navíc kontroluje celý frontend/MCP test suite, hranice modulů, typecheck a build.
