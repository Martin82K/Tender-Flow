## Tender Flow v1.9.0-beta.3

Tato beta verze je určena pro ověření Windows desktop aplikace před stabilním
vydáním řady 1.9.0.

### Hlavní změny od beta.2

- **Odstranění porovnání nabídek**: aplikace již neobsahuje modul porovnání
  nabídek ani související implementaci Hermes agenta, desktop IPC a nastavení.
- **Bezpečný úklid starých dat**: desktop při startu odstraní vyřazené klíče
  modulu, ale zachová ostatní data secure storage; zápisy jsou atomické a
  serializované.
- **Single-instance desktop**: druhá instance aplikace neprovádí souběžné
  migrace ani zápisy do secure storage a aktivuje již spuštěné okno.
- **Přísnější TypeScript**: projekt používá zesílenou strict konfiguraci včetně
  `strictNullChecks` a `noImplicitAny`.
- **Aktualizace toolchainu**: aktualizovány byly mimo jiné TypeScript, Vite a
  Electron; dependency audit nehlásí známé zranitelnosti.
- **Bezpečnost dodavatelského řetězce**: CI ověřuje dependency audity a podpisy
  balíčků pro root i desktop závislosti.
- **Webová bezpečnost a výkon**: přidána CSP v report-only režimu a PDF runtime
  se načítá až při použití.

### Windows instalace

Release obsahuje lokálně sestavený x64 NSIS instalátor
`Tender-Flow-Setup-1.9.0-beta.3.exe`, jeho blockmap a `latest.yml` pro ověření
automatické aktualizace.

### Omezení beta verze

- Jde o pre-release určený k testování, ne o stabilní produkční vydání.
- Windows artefakty jsou sestavené lokálně a před publikací ověřené; plný
  runtime smoke test instalátoru vyžaduje Windows prostředí.
