# Tender Flow v1.9.39-beta.5

Beta pro Windows x64 s načítáním rozpočtu podle použití.

- Programová část rozpočtu se načítá až při otevření záložky Rozpočet.
  Během načítání zůstává dostupná navigace stavby.
- Seznam původních příloh se načte až v Importech a verzích nebo při opravě
  importu. Pouhé prohlížení položek či rekapitulace tento požadavek nevyvolá.
- Oprava importu počká na dostupnou přílohu. Chybu lze zopakovat; načítání
  se nezaměňuje za prázdný seznam a zavření dialogu zůstává respektováno.
- Zachována je kontrola oprávnění, uzamčení a hlavní verze při návratu
  do rozpočtu, stejně jako úspornější obnova projektů z beta.4.
- Uložená data a formáty záloh se nemění. Vydání nevyžaduje databázovou migraci.

Jde o předběžné vydání. Windows instalátor nemá Authenticode podpis.
Skutečná instalace a aktualizace na Windows nebyla na macOS sestavovacím
počítači ověřena.
