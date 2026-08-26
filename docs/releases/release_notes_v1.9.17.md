# Tender Flow v1.9.17

Patch přináší novou vizuální podobu veřejného webu a sjednocuje jeho hlavní
akce s přihlašovací stránkou.

## Nový příběh stavebního tendru

- Úvodní stránka pracuje s prostorovou krajinou a modelem stavby.
- Pět ovladatelných kroků ukazuje cestu od zadání přes nabídky a vyhodnocení
  až po rozhodnutí a smlouvu.
- Původní logo Tender Flow zůstává beze změny.
- Texty neprezentují bezplatnou zkušební dobu ani veřejnou registraci.

## Klidnější vizuální hierarchie

- Hlavní CTA a aktivní krok používají tlumenou šalvějovou zelenou.
- Modrá zůstává pouze jako drobný funkční akcent v procesní ilustraci.
- Nadbytečné tlačítko Domluvit ukázku bylo odstraněno z horní navigace.
- Přihlašovací tlačítko používá stejnou zelenou paletu a tmavý, dobře čitelný
  text.

## Přístupnost a bezpečnost

- Kontrast zeleného CTA s tmavým textem je 8,35:1.
- Animace respektují nastavení omezeného pohybu v operačním systému.
- Změna nepřidává závislosti, oprávnění, datové migrace ani nové síťové toky.
- Release artefakty jsou sestavené a ověřené lokálně před nahráním na GitHub.

## Ověření

- Veřejný tok landing page, interaktivní příběh a přihlášení byl ručně ověřen
  v prohlížeči.
- Kompletní testovací sada, TypeScript, webový build, desktop kompilace,
  dependency audit a kontroly architektury prošly úspěšně.
