## Tender Flow v1.9.0-beta.7

Tato beta verze navazuje na beta.6 a je určena pro ověření nových smluvních,
fakturačních a bezpečnostních změn před stabilním vydáním řady 1.9.0.

### Smlouvy a fakturace investorům

- Vítěznou nabídku lze z pipeline otevřít přímo jako smlouvu a zachovat vazbu
  mezi projektem, nabídkou a smluvním záznamem.
- Smlouvy podporují související dokumenty, přílohy a přesnější OCR aktualizace.
- Přehled smluv má rozšířené filtrování, uživatelské nastavení tabulky a
  doplněnou navigaci na detail smlouvy.
- Fakturace investorům používá sjednocený datový model a přehlednější výpočty.

### Složkomat a cloudové odkazy

- Fallback mezi lokální a cloudovou složkou lépe respektuje aktuální projekt,
  kategorii a uložený Google Drive nebo OneDrive odkaz.
- Přepnutí projektu zneplatní starý stav a zabrání použití odkazu z předchozího
  projektu.

### Bezpečnost a přístup

- Zápisy nabídek přes RLS jsou omezené na vlastníka projektu nebo uživatele s
  explicitním oprávněním `edit`; samotné členství v organizaci k zápisu nestačí.
- Veřejný mock demo vstup byl odstraněn. Neautentizovaný vstup do aplikace
  zůstává přesměrovaný na přihlášení.
- Globální override `brace-expansion` byl odstraněn, protože rozbíjel runtime
  kontrakt starších větví `minimatch`. Lockfily nyní používají kompatibilní a
  bezpečnostně opravené řady podle konkrétního consumeru.
- Pravidla instalace balíčků vyžadují supply-chain kontrolu integrity, podpisů,
  maintainerů, historie vydání, známých zranitelností a hlášených incidentů.

### Omezení beta verze

- Jde o pre-release určený k testování, ne o stabilní produkční vydání.
- Windows instalátor je sestaven lokálně na macOS; plný runtime smoke test
  instalátoru vyžaduje Windows prostředí.
- macOS build bez dostupné Developer ID identity není notarizovaný ani podepsaný
  pro distribuci mimo vývojové prostředí.
