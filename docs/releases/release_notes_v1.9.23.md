# Tender Flow v1.9.23

Opravný patch zpřístupňuje okamžitou synchronizaci nabídek dodavatelů mezi MCP
a otevřenou aplikací Tender Flow.

## Realtime synchronizace nabídek

- Změna ceny, poznámky nebo stavu karty dodavatele provedená přes MCP se v
  otevřeném projektu projeví bez ručního obnovení stránky.
- Aplikace odebírá pouze změny nabídek z projektů dostupných přihlášenému
  uživateli a po události bezpečně obnoví projektová data přes existující query
  vrstvu.
- Připojení se při změně aktivního projektu korektně odhlásí a nahradí novým,
  aby nevznikaly duplicitní odběry ani úniky mezi projekty.

## Bezpečnost a spolehlivost

- Realtime publikace je povolena pouze pro tabulku `bids` s aktivním RLS;
  migrace se odmítne provést, pokud tyto podmínky nejsou splněny.
- MCP oprávnění, potvrzovací workflow a databázová tenant izolace zůstávají
  beze změny.
- Cílené Realtime testy, kompletní testovací sada, webový build, desktopová
  kompilace a kontroly architektonických hranic prošly před vydáním.
- Release artefakty byly sestavené a ověřené lokálně před nahráním na GitHub.
