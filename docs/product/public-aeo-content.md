# Veřejný obsah a AEO

Veřejné podklady byly sjednoceny podle implementovaného stavu k 8. září 2026.
Obchodní nabídka vychází z [licencí, AI a MCP](ai-data-and-mcp.md), funkční
rozsah z [katalogu funkcí](feature-catalog.md) a aktuálního kódu. Změna obsahu
nemění historické smlouvy, billing, konfiguraci AI ani oprávnění zákazníků.

## Obsahový kontrakt

- Provozovatele identifikujeme podle aktuálních právních stránek: Martin
  Kalkuš, OSVČ, IČO 74907026. Značka Tender Flow není tvrzením o existenci s.r.o.

- Nabízíme Enterprise s individuální cenou, fakturou a bankovním převodem.
  Ukázka je na vyžádání; nenabízíme veřejný automatický trial.
- AI čtení dokumentů popisuje Mistral AI a kontrolu výstupu člověkem. ZDR je
  omezeno na podporované API a není příslibem smazání dat z Tender Flow ani
  pravidlem pro jiné poskytovatele či klienty.
- MCP podporuje autorizované čtení a konkrétní potvrzené zápisy. Externí
  e-mail a kalendář vyžadují samostatné konektory.
- TODO Osobní může synchronizovat podporované údaje se spárovanými seznamy
  Microsoft To Do. Integrace nepřenáší přílohy, opakování ani ostatní seznamy.
- Desktop není plně offline aplikace. Přístup k účtu, licence, sdílená data
  a AI závisejí na síti; lokální souborové nástroje mají vlastní chování.
- Nepublikujeme neověřené ceny, limity, podporované verze OS, termíny výmazu,
  srovnávací soudy o konkurenci ani kvantifikované zákaznické výsledky.
  Firemní reference BAU-STAV zůstává; dřívější osobní citace s nedoloženými
  výsledky byly odstraněny, nikoli přepsány na nové výroky.

## Soubory a kontrola změn

Viditelné FAQ používá `features/public/model/publicFaq.ts`. Stejné otázky a
odpovědi jsou v `index.html` (JSON-LD a obsah bez JavaScriptu) a
`public/llms.txt`. Při změně produktové odpovědi upravte všechny tři zdroje;
regresní test ověřuje jejich shodu včetně skutečně vykresleného obsahu.

Kanonická doména je `https://www.tenderflow.cz`, v souladu s produkčním
přesměrováním. Metadata, sitemap a prerender používají stejnou doménu.
Homepage nemá deklarovanou samostatnou slovenskou jazykovou variantu.
Právní prerender zachovává Organization a WebSite, ale nedědí FAQ,
SoftwareApplication ani identitu domovské stránky.

`robots.txt` sdílí výluky interních cest se všemi dosud povolenými roboty.
Změna nezavádí nové povolení tréninku. Robots.txt není bezpečnostní hranice;
data musí chránit autentizace a autorizační pravidla. Citace ve vyhledávačích
nejsou garantované a samotný `llms.txt` nezajišťuje indexaci.

## Ověření

Spusťte `npm run test:run -- tests/landingMetadata.test.ts
tests/LandingPage.modules.test.tsx tests/seoConfig.test.ts
tests/publicPrerender.test.ts`, plnou sadu testů, typecheck, build a kontroly
dokumentace a hranic modulů. U produkčního buildu ověřte FAQ, přechod na
podmínky a zpět, primární odkaz pro domluvení ukázky, konzoli a zobrazení
na počítači i mobilu. Po nasazení zkontrolujte skutečné HTML, `llms.txt`,
`robots.txt`, sitemap a kanonické adresy.

Změna nevyžaduje migraci databáze, nové závislosti ani desktopové vydání.
Před implementací nebyla dostupná analýza GitHub Code Scanning (HTTP 404);
nelze ji vydávat za provedený externí bezpečnostní audit.
