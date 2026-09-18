# Namapovaná cenová nabídka

V desktopové aplikaci otevřete Smlouvy → Tabulka. Mezi Dokument a Stav je
Cenová nabídka. Klikněte na Připojit a v systémovém dialogu vyberte PDF, DOCX
nebo XLSX uvnitř složky projektu připojené ve Složkomatu. Adresu nevkládáte.
Tender Flow uloží pouze relativní cestu. Soubor se nekopíruje ani nenahrává.
Dokument smlouvy zůstává beze změny.

Tlačítko Otevřít použije místní složku aktuálního uživatele. Změnit umožní
vybrat jiný soubor. Zrušení výběru zachová původní vazbu. Přesunutý nebo
přejmenovaný soubor je nutné znovu vybrat; synchronizaci zajišťuje původní úložiště.

Na telefonu nelze získat místní cestu pomocí systémového výběru souborů.
Již namapovaný soubor lze otevřít online, pokud má Složkomat nastavený podporovaný
online kořen SharePointu (přímá cesta nebo OneDrive stránka s parametrem id).
Pro osobní OneDrive, Google Drive a samotný krátký sdílecí odkaz se cloudová
adresa z místní cesty neodvozuje. Bez dostupného online kořene aplikace zobrazí
vysvětlení. Oprávnění na původním úložišti jsou vždy nutná.

## Nasazení a bezpečnost

Před frontendem nasaďte migrace `20260918085250_contract_price_offer.sql` a
`20260918104557_preserve_price_offer_restore.sql`.
První přidává pouze nullable `contracts.price_offer_path` s kontrolou relativní cesty
bez traversal segmentů, řídicích znaků, dvojtečky a zpětných lomítek a s omezením
na PDF/DOCX/XLSX. Není potřeba backfill, index, cizí klíč, nové granty ani Storage.
RLS smluv nadále řídí čtení a změny vazby; lokální přístup používá existující
přihlášené Electron IPC a uživatelem povolené kořeny. Absolutní cesta uživatele
se nesdílí do databáze. Žádné závislosti se nepřidávají.

Ověření: zrušení výběru, mapování ve složce projektu, odmítnutí cizí složky a
spustitelných souborů, otevření přes vlastní kořen jiného uživatele, chyba při
chybějícím souboru, zamítnutý zápis a online fallback. Po nasazení proveďte
`supabase db push --dry-run` a ověřte validovaný constraint a nezměněné RLS.

Druhá migrace rozšiřuje existující obnovu uživatelských i tenantních záloh o
cestu nabídky. Záloha s explicitním null vazbu odstraní, starší záloha bez tohoto
pole již existující vazbu zachová. Autorizace, vlastnictví, tenantní omezení,
podpisy historie i granty funkcí obnovy zůstávají zachovány. SQL regresní test
`supabase/tests/price_offer_backup_roundtrip.sql` používá nové UUID a všechny
zápisy vrací zpět pomocí rollbacku.

Mapování podporuje i starší provider `local`. Systémový picker dostane
`withinRoot`: hlavní proces před vrácením souboru ověří jeho skutečnou cestu
včetně symlinků uvnitř již povoleného kořene. Odmítnutý výběr nepřidá žádný grant.
