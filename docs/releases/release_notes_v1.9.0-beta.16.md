## Tender Flow v1.9.0-beta.16

### MCP deployment a oprávnění

- Vzdálené Tender Flow MCP lze nasazovat jako samostatnou Vercel službu, aniž by
  každá MCP změna vyžadovala nový build webové nebo desktopové aplikace.
- Kanonická OAuth resource URL zůstává zachovaná a přechod na samostatnou službu
  používá omezený HTTPS proxy přepínač s fail-closed konfigurací.
- Zapisovací oprávnění MCP může být po explicitním souhlasu trvalé. Nadále je
  vázané na konkrétního uživatele, OAuth klienta a platný consent a lze je
  odvolat. MCP klient nezískává přímý databázový přístup.
- Nastavení zobrazuje stabilní skupiny oprávnění místo statického seznamu toolů,
  takže publikování nového MCP toolu není svázané s releasem aplikace.

### Smluvní přehled a exporty

- Smluvní přehled má přehlednější seskupení, stavové souhrny a vylepšené chování
  řádků, souborů a hover stavů.
- Organizační smluvní přehled lze exportovat do stylizovaného XLSX s bezpečně
  ošetřenými textovými hodnotami a bez interních storage cest nebo citlivých URL.
- Export smluv projektu zachovává bezpečné formátování buněk a ochranu před
  spreadsheet formula injection.
- Loga v exportech smluv jsou vložená přímo do aplikace, takže export nezávisí na
  vzdáleném načítání obrázků a funguje konzistentně i offline.

### Ověření

- Změnové PR prošly GitHub Quality Checks, Vercel preview a bezpečnostními
  kontrolami. Release je pre-release určený k ověření před stabilním vydáním.
