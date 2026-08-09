## Tender Flow v1.9.0-beta.4

Tato beta verze nahrazuje nepublikovaného kandidáta beta.3 a je určena pro
ověření Windows desktop aplikace před stabilním vydáním řady 1.9.0.

### Hlavní změny od beta.2

- **Odstranění porovnání nabídek**: aplikace již neobsahuje modul porovnání
  nabídek ani související implementaci Hermes agenta, desktop IPC a nastavení.
- **Bezpečný úklid starých dat**: desktop odstraní vyřazené klíče modulu, ale
  zachová ostatní data secure storage; zápisy jsou atomické a serializované.
- **Single-instance desktop**: druhá instance neprovádí souběžné migrace ani
  zápisy do secure storage a aktivuje již spuštěné okno.
- **Přísnější TypeScript a aktualizovaný toolchain**: projekt používá zesílenou
  strict konfiguraci a aktualizované verze TypeScriptu, Vite a Electronu.
- **Bezpečnost dodavatelského řetězce**: CI ověřuje dependency audity a podpisy
  balíčků pro root i desktop závislosti.
- **Webová bezpečnost a výkon**: přidána CSP v report-only režimu a PDF runtime
  se načítá až při použití.

### Oprava release validace

- Kontrola supply-chain kroků nyní normalizuje také Windows CRLF konce řádků.
  Obsah ani fail-closed chování bezpečnostních bran se nemění.

### Windows instalace

Release obsahuje lokálně sestavený x64 NSIS instalátor
`Tender-Flow-Setup-1.9.0-beta.4.exe`, jeho blockmap a `latest.yml` pro ověření
automatické aktualizace.

### Omezení beta verze

- Jde o pre-release určený k testování, ne o stabilní produkční vydání.
- Windows artefakty jsou sestavené lokálně a před publikací ověřené; plný
  runtime smoke test instalátoru vyžaduje Windows prostředí.
