## Tender Flow v1.9.0-beta.13

Tato kumulativní beta verze obsahuje všechny změny řady 1.9.0-beta od prvního
testovacího sestavení až po aktuální bezpečnou integraci Tender Flow MCP.

### Beta.13 — Tender Flow MCP a Outlook vazby

- MCP server používá protokol `2026-07-28`, stateless HTTP transport, discovery
  a publikovaný katalog nástrojů a resources.
- OAuth přístup je svázaný s konkrétním klientem, uživatelem a resource;
  kontaktní a zapisovací oprávnění jsou časově omezená, samostatně udělovaná a
  okamžitě odvolatelná.
- Izolovaná databázová role MCP nemá přímý zápis do business tabulek. Přístup
  vede jen přes úzké serverové/RPC operace, RLS, projektovou autorizaci a
  oddělený backend proof.
- Katalog nabízí bezpečné čtení projektů, úkolů a nabídek s minimálními selecty,
  pevnými limity a explicitní informací o zkrácení výsledku.
- Outlook zprávy lze svázat s existující kartou dodavatele a následně podle
  stabilního immutable/message ID dohledat. Ukládají se jen identifikátory,
  nikoli těla zpráv, adresáti nebo přílohy.
- Stav nabídky lze měnit pouze přes třífázový tok návrh → potvrzení → provedení.
  Návrh je status-only, vázaný na uživatele a OAuth klienta, kontroluje očekávaný
  původní stav a používá řádkový zámek pro bezpečný souběh a opakování.
- Potvrzení a provedení jsou kompatibilní s konverzačním rozhraním ChatGPT;
  uživatel potvrzuje přesný zobrazený text a server nikdy nepřebírá mutační
  payload z execute požadavku.
- Distribuovaný limiter, povinný redigovaný pre-audit a produkční canary
  pokrývají čtecí i zapisovací MCP tok. Přístup lze odpojit v uživatelském
  nastavení.

### Beta.12 — stabilita smluv

- Rozpracované načítání smluv se při změně nebo opuštění projektu bezpečně
  zneplatní a opožděná odpověď už neaktualizuje odpojenou React komponentu.
- Regresní testy pokrývají změnu projektu i odpojení během načítání.

### Beta.11 — role, Smluvní přehled a poptávky

- Projektová oprávnění používají úplnou matici profesních rolí a serverové
  vyhodnocení přístupu.
- Smluvní přehled nabízí rozšířené sloupce, projektové filtrování, uložené
  nastavení a export omezený na dostupné projekty.
- Tabulka poptávek má kompaktnější rozložení a uložené uživatelské preference.

### Beta.10 — projektové týmy a smluvní dokumenty

- Přibyly řízené projektové týmy, read-only režim archivovaných projektů a
  omezený externí přístup.
- Organizační Smluvní přehled respektuje roli, explicitní oprávnění a skutečný
  rozsah dostupných projektů.
- Smlouvy a dodatky podporují dodatečné PDF/DOCX dokumenty v privátním Storage;
  otevření používá krátkodobé podepsané odkazy a neúspěšný metadata zápis uklidí
  osiřelý soubor.

### Beta.9 — Kontakty ve všech skinech

- Obrazovka Kontakty / Soupis subdodavatelů používá společnou kompaktní lištu,
  jedinou primární akci a centrální skinové tokeny.
- Classic, Industrial, Botanica i Nature respektují světlý a tmavý režim,
  klávesnicový focus a přístupné stavové barvy.

### Beta.8 — Nature a kompaktní pracovní plochy

- Přibyl skin Nature se světlou lesní a tmavou noční variantou a sjednocené
  ovládání vzhledu napříč aplikací.
- Projektový přehled, dokumenty, nabídky, výběrová řízení, kalendář a osobní
  úkoly lépe využívají dostupnou plochu.
- Aktivní relace jsou omezené a oprávnění databázových triggerů zpřísněná.

### Beta.7 — smlouvy, fakturace a bezpečný přístup

- Vítěznou nabídku lze z pipeline otevřít jako smlouvu se zachovanou vazbou na
  projekt a nabídku; rozšířené byly smluvní dokumenty, OCR a fakturace
  investorům.
- Zápisy nabídek přes RLS jsou omezené na vlastníka projektu nebo explicitní
  projektové oprávnění `edit`.
- Veřejný mock demo vstup byl odstraněn a supply-chain pravidla byla doplněna o
  kontrolu integrity, podpisů, historie maintainerů a známých incidentů.

### Beta.6 — lokální a online Složkomat

- Lokální a online složku lze používat současně; nedostupná lokální cesta
  přejde na odpovídající cloudové výběrové řízení, poptávku nebo složku
  subdodavatele.
- Fallback respektuje právě uložený Google Drive nebo OneDrive odkaz a bezpečně
  zneplatňuje zastaralá cloudová ID bez poškození druhého provideru.
- Lokální cesty se neukládají do sdíleného cloudového nastavení.

### Beta.5 — bezpečné sdílení DocHub složek

- Opraveny názvy DocHub složek, izolace projektových kořenů a vlastnická hranice
  sdíleného nastavení.
- Cache je svázaná s kořenem a projektem, změna projektu zneplatní starý stav a
  transakční rollback zachová konzistenci při selhání synchronizace.

### Beta.4 — validační oprava desktop releasu

- Kandidát beta.3 byl nahrazen Windows sestavením s opravou supply-chain
  validace pro CRLF konce řádků; bezpečnostní brány zůstaly fail-closed.
- Součástí řady je single-instance desktop a bezpečný, serializovaný úklid
  vyřazených klíčů ze secure storage bez zásahu do ostatních dat.

### Beta.3 — toolchain a odstranění porovnání nabídek

- Modul porovnání nabídek včetně Hermes integrace byl z produktu odstraněn.
- Projekt přešel na přísnější TypeScript konfiguraci a aktualizovaný TypeScript,
  Vite a Electron.
- CI začalo ověřovat dependency audity a registry signatures; web získal CSP v
  report-only režimu a PDF runtime se načítá až při použití.

### Beta.2 — opravy experimentálního Hermes vyhodnocení

- Byla opravena úplnost cenového skóre, položky pouze s celkovou cenou,
  validace matice a měn, stabilní identita CSV položek a kompatibilita
  historických výsledků.
- Nejednoznačné mapování se odmítalo místo tichého přiřazení ceny a Hermes
  nemohl měnit lokální numerické skóre ani vítěze.

### Beta.1 — první interní kandidát

- První interní beta zavedla deterministické lokální výpočty cen, odchylek,
  úplnosti a pořadí a poradní experimentální Hermes integraci.
- Numerické skóre a výběr vítěze zůstávaly lokální a mimo kontrolu externího
  agenta.

### Omezení beta verze

- Jde o pre-release určený k testování, ne o stabilní produkční vydání.
- MCP vyžaduje registrovaného OAuth klienta a příslušné aktivní uživatelské
  granty; zapisovací změny vždy vyžadují explicitní potvrzení.
- Desktopové balíčky jsou sestavené a ověřené lokálně. Plný runtime smoke test
  Windows instalátoru vyžaduje Windows prostředí; macOS distribuce bez platné
  Developer ID identity a notarizace může při prvním spuštění vyžadovat ruční
  povolení.
