## Tender Flow v1.9.0-beta.18

### MCP kanban a bezpečné zápisy

- MCP nadále podporuje přesun jedné karty dodavatele v kanbanu přes oddělený
  přípravný, potvrzovací a prováděcí krok.
- Instrukce k zápisu se publikují pouze klientům, kterým jsou zapisovací nástroje
  skutečně dostupné; read-only klient nedostává zavádějící pokyny.
- Proxy odstraňuje hop-by-hop hlavičky včetně hlaviček deklarovaných přes
  `Connection` a po dekompresi opravuje hlavičky délky a kódování odpovědi.
- Plugin nabízí menší výchozí sadu promptů a zachovává explicitní potvrzení před
  každou změnou kanbanu.

### Kontakty v pipeline

- Kontakty vytvořené nebo upravené v pipeline se ukládají do sdíleného katalogu
  kontaktů a jsou po obnovení znovu dostupné.
- Lokální cache se aktualizuje přes idempotentní upsert a nevytváří duplicitní
  záznamy při opakovaném načtení nebo souběžném uložení.
- Databázová migrace sjednocuje historické pořadí a zachovává kompatibilitu
  existujících instalací.

### Ověření

- Release je pre-release určený k ověření před stabilním vydáním.
- Desktopové instalační balíčky a updater metadata se sestavují a kontrolují
  lokálně; GitHub Actions je nesmí připojit ani přepsat.
