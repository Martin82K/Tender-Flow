# Tender Flow v1.9.2

Patch release sjednocuje aktuální hlavní větev po vydání `v1.9.1` a přináší
opravy desktopového balíčku, spolehlivější odkazy DocHub a bezpečnější vnitřní
architekturu. GitHub Release zůstává před publikací v režimu draft.

## Opravy a zlepšení

- **Desktopové ikony a písma:** zabalená Electron aplikace načítá lokální
  Material Symbols bez závislosti na online fontu a bez chybných náhrad ikon.
- **Sdílené odkazy DocHub:** obnova odkazů na projektové složky lépe zachovává
  identitu sdílené složky, bezpečně pracuje s přepínáním projektů a používá
  read-only cloudové dohledání tam, kde lokální stav nestačí.
- **Výběrová řízení:** pipeline a její modály, karty, přehledy a dokumenty jsou
  přesunuty do kanonického projektového modulu se zachováním stávajícího UX.
- **Projektové dokumenty:** obrazovky a integrační logika dokumentů mají
  jednotnou vlastnickou hranici v projektovém modulu.
- **Landing page:** popisy modulů přesněji odpovídají současným možnostem
  Tender Flow.

## Bezpečnost a spolehlivost

- Odstraněn je nepoužívaný lokální desktopový MCP server včetně starého IPC a
  synchronizace tokenu; vzdálené Tender Flow MCP API zůstává zachováno.
- Importní hranice pro feature, shared, infra a desktop vrstvy jsou přísněji
  kontrolované automatickými testy.
- Release zachovává oddělené limity first-party a OAuth session z `v1.9.1` i
  normalizaci nedůvěryhodných kontaktních JSON dat před mobilním vyhledáváním.

## Ověření před publikací

- Lokálně sestavit macOS ARM64 DMG/ZIP a Windows x64 NSIS včetně blockmap a
  updater YAML souborů.
- Ověřit shodu verze, názvy, velikosti a SHA-512 metadata všech updater assetů.
- Ověřit instalaci a aktualizaci z `v1.9.1`, přihlášení, hlavní navigaci,
  výběrové řízení a otevření sdíleného odkazu DocHub.
- Publikovat draft pouze po manuálním ověření instalačních balíčků.

## Instalace

Assety budou připojeny k draft release výhradně z lokálního
`dist-electron/`. GitHub Actions je nesmí připojit ani přepsat.
