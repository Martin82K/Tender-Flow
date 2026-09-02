# Tender Flow v1.9.22

Opravný patch dokončuje bezpečný workflow pro zápis ceny nabídky subdodavatele
z MCP do výběrového řízení.

## Nabídky subdodavatelů přes MCP

- Agent může po výslovném udělení finančního oprávnění uložit celkovou cenu
  nabídky bez DPH do karty subdodavatele.
- K ceně lze připojit stručné informace z nabídky, například že nezahrnuje
  dopravu nebo pozastávky; uživatel vždy obdrží souhrn změn ke kontrole.
- Vstup ceny je omezen na dvě desetinná místa a délka doplňujících informací je
  kontrolována před vytvořením návrhu i před jeho provedením.
- Finanční oprávnění lze bezpečně odebrat i po dřívějším odebrání obecného
  oprávnění k zápisu.

## Bezpečnost a spolehlivost

- Databázový zápis je dostupný pouze vyhrazené MCP roli a vyžaduje platný
  OAuth kontext, souhlas uživatele a samostatné finanční oprávnění.
- Každá změna nabídky aktualizuje revizi záznamu, takže zastaralý návrh nelze
  provést nad mezitím změněnými daty.
- Historie cen se bezpečně normalizuje i u starších záznamů s neplatným JSON
  tvarem a změny zobrazované uživateli odpovídají skutečně uloženým hodnotám.
- Regresní testy pokrývají oprávnění, validaci ceny a poznámek, odvolání
  finančního přístupu, revize i kompatibilitu starší historie.
- Kompletní testovací sada, webový build, desktop kompilace, dokumentace a
  kontroly architektonických hranic prošly před vydáním.
- Release artefakty jsou sestavené a ověřené lokálně před nahráním na GitHub.
