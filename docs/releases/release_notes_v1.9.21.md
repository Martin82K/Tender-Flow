# Tender Flow v1.9.21

Opravný patch zajišťuje bezpečné hromadné mazání dokončených osobních úkolů.

## Vymazání hotových osobních úkolů

- Akce **Vymazat vše hotové** nyní odstraní pouze dokončené osobní úkoly
  přihlášeného uživatele.
- Projektové úkoly, projektové podúkoly a osobní rodiče projektových podúkolů
  zůstávají zachované.
- Archivované projekty už nezablokují úklid osobního seznamu chybou
  `Project is archived`.
- Potvrzovací dialog zobrazuje počet skutečně mazatelných osobních úkolů.
- Pokud server mazání odmítne, aplikace zobrazí srozumitelné české hlášení
  namísto globální chyby `UNHANDLED_REJECTION`.

## Bezpečnost a ověření

- Databázová funkce běží jako `SECURITY INVOKER`, vyžaduje přihlášeného
  uživatele a respektuje Row Level Security.
- Regresní testy pokrývají oddělení osobních a projektových úkolů, ochranu
  projektových potomků a zachycení chyby RPC.
- Produkční migrace byly ověřené rollback smoke testem; test neodstranil žádná
  uživatelská data.
- Kompletní testovací sada, webový build, desktop kompilace, dokumentace a
  kontroly architektonických hranic prošly před vydáním.
- Release artefakty jsou sestavené a ověřené lokálně před nahráním na GitHub.
