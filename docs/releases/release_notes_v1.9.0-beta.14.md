## Tender Flow v1.9.0-beta.14

Tato kumulativní beta verze obsahuje všechny změny řady 1.9.0-beta od prvního
testovacího sestavení po aktuální bezpečnou integraci Tender Flow MCP.

### Beta.14 — zapisovatelný kanban, smluvní dokumenty a Excel export

- Nový samostatný MCP tool připraví změnu stavu karty dodavatele v kanbanu.
  Přesun zůstává součástí třífázového toku návrh → potvrzení → provedení;
  samotná příprava kartu nikdy nezmění.
- Změna je omezená na existující nabídku a povolený stav, používá serverovou
  objektovou autorizaci, očekávaný původní stav, řádkový zámek a úzkou RPC.
  MCP role nadále nemá přímý `UPDATE` na nabídky ani široký databázový zápis.
- Produkční konverzační test ověřil vytvoření návrhu stejného cílového stavu
  bez jeho potvrzení nebo provedení a odpovídající redigovanou auditní stopu.
- Smluvní dokumenty a dodatky lze v desktopu otevřít přes bezpečný platformní
  adaptér. Povolené jsou pouze krátkodobě podepsané HTTPS odkazy z přesného
  nakonfigurovaného Supabase originu, bucketu a očekávané cesty; celé podepsané
  URL se nezapisuje do logu.
- Tabulku smluv lze exportovat do stylizovaného Excelu s logem Tender Flow,
  projektovými souhrny, přehlednými hlavičkami, zalamováním textu, filtry,
  zmrazenými panely a tiskovým rozložením. Soubor uvádí datum exportu, verzi
  aplikace a zobrazované jméno uživatele; jeho e-mail se do sdíleného výstupu
  nevkládá.

### Beta.13 — Tender Flow MCP a Outlook vazby

- MCP server používá stateless HTTP transport, discovery a publikovaný katalog
  nástrojů a resources.
- OAuth přístup je svázaný s konkrétním klientem, uživatelem a resource;
  kontaktní a zapisovací oprávnění jsou samostatná a odvolatelná.
- Izolovaná databázová role MCP nemá přímý `UPDATE` na nabídky. Změna jejich
  stavu vede jen přes úzkou serverovou/RPC operaci, RLS a projektovou autorizaci.
- Outlook zprávy lze svázat s existující kartou dodavatele a dohledat podle
  stabilního immutable/message ID. Neukládají se těla zpráv ani přílohy.
- Zapisovací MCP změny používají návrh → potvrzení → provedení, vazbu na
  uživatele a klienta, redigovaný audit a distribuovaný limiter.

### Beta.12 — stabilita smluv

- Rozpracované načítání smluv se při změně nebo opuštění projektu bezpečně
  zneplatní a opožděná odpověď neaktualizuje odpojenou komponentu.

### Beta.11 — role, Smluvní přehled a poptávky

- Projektová oprávnění používají úplnou matici rolí a serverové vyhodnocení.
- Smluvní přehled přidal projektové filtrování, uložená nastavení a export
  omezený na dostupné projekty; poptávky dostaly kompaktnější rozložení.

### Beta.10 — projektové týmy a smluvní dokumenty

- Přibyly řízené projektové týmy, read-only archivované projekty a omezený
  externí přístup.
- Smlouvy a dodatky podporují PDF/DOCX dokumenty v privátním Storage,
  krátkodobé podepsané odkazy a úklid osiřelého souboru při selhání metadat.

### Beta.9 — Kontakty ve všech skinech

- Kontakty používají společnou kompaktní lištu, jedinou primární akci,
  přístupné stavové barvy a konzistentní světlé i tmavé skiny.

### Beta.8 — Nature a kompaktní pracovní plochy

- Přibyl skin Nature a sjednocené ovládání vzhledu.
- Projektový přehled, dokumenty, nabídky, výběrová řízení, kalendář a osobní
  úkoly lépe využívají plochu; relace a databázová trigger oprávnění se zpřísnila.

### Beta.7 — smlouvy, fakturace a bezpečný přístup

- Vítěznou nabídku lze otevřít jako smlouvu se zachovanou vazbou na projekt;
  rozšířeny byly smluvní dokumenty, OCR a fakturace investorům.
- RLS zápisy nabídek jsou omezené na vlastníka nebo explicitní právo editace.

### Beta.6 — lokální a online Složkomat

- Lokální a online složku lze používat současně a bezpečně přecházet na cloud.
- Fallback respektuje uložený Google Drive nebo OneDrive odkaz a lokální cesty
  se neukládají do sdíleného cloudového nastavení.

### Beta.5 — bezpečné sdílení DocHub složek

- Opraveny názvy složek, izolace projektových kořenů, vlastnická hranice,
  cache a transakční rollback při selhání synchronizace.

### Beta.4 — validační oprava desktop releasu

- Kandidát beta.3 byl nahrazen Windows sestavením s opravou CRLF validace;
  bezpečnostní brány zůstaly fail-closed.
- Řada obsahuje single-instance desktop a serializovaný úklid secure storage.

### Beta.3 — toolchain a odstranění porovnání nabídek

- Modul porovnání nabídek včetně Hermes integrace byl odstraněn.
- Projekt přešel na přísnější TypeScript, novější Vite a Electron; CI ověřuje
  dependency audity a registry signatures a web používá CSP report-only.

### Beta.2 — opravy experimentálního Hermes vyhodnocení

- Opravena byla úplnost cenového skóre, matice, měny, identita CSV položek a
  kompatibilita historie; nejednoznačné mapování se odmítalo fail-closed.

### Beta.1 — první interní kandidát

- První beta zavedla deterministické lokální výpočty cen, odchylek, úplnosti
  a pořadí s poradní Hermes integrací bez možnosti změnit lokálního vítěze.

### Omezení beta verze

- Jde o pre-release určený k testování, ne o stabilní produkční vydání.
- MCP vyžaduje registrovaného OAuth klienta a aktivní granty; zapisovací změny
  vždy vyžadují explicitní potvrzení.
- Desktopové balíčky budou před zveřejněním sestavené a ověřené lokálně. Plný
  Windows runtime smoke vyžaduje Windows; macOS bez Developer ID/notarizace
  může vyžadovat ruční povolení při prvním spuštění.
