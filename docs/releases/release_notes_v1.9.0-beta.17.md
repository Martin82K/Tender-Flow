## Tender Flow v1.9.0-beta.17

### Oprava desktopového přihlášení

- Windows instalátor je sestaven lokálně z ověřené konfigurace a nepochází z
  GitHub Actions artefaktu.
- Produkční desktop build nyní skončí chybou, pokud chybí veřejná Supabase
  konfigurace nebo pokud cílový Supabase projekt anon/publishable klíč odmítne.
- Oprava nahrazuje beta.16, ve které byl zabalen poškozený anon klíč a standardní
  přihlášení proto nemohlo odeslat autentizační požadavek.

### MCP deployment a oprávnění

- Vzdálené Tender Flow MCP lze nasazovat jako samostatnou Vercel službu bez
  nutnosti nového buildu webové nebo desktopové aplikace při každé MCP změně.
- Zapisovací oprávnění MCP zůstává vázané na konkrétního uživatele, OAuth klienta
  a platný souhlas; MCP klient nemá přímý databázový přístup.
- Nastavení zobrazuje stabilní skupiny oprávnění místo statického seznamu toolů.

### Smluvní přehled a exporty

- Smluvní přehled má seskupení smluv a dodatků, souborový sloupec a opravené
  hover stavy přes celou šířku tabulky.
- Organizační i projektový smluvní přehled lze exportovat do stylizovaného XLSX
  s logem Tender Flow, údaji o exportu a bezpečně formátovanými buňkami.
- Exporty neobsahují interní storage cesty ani citlivé podepsané URL a chrání
  textové hodnoty proti spreadsheet formula injection.
- Loga jsou vložená přímo v aplikaci, takže export funguje konzistentně i offline.

### Ověření

- Release je pre-release určený k ověření před stabilním vydáním. Windows
  instalátor, blockmap a `latest.yml` jsou publikovány výhradně z lokálního
  `dist-electron/` po kontrole obsahu a kontrolních součtů.
