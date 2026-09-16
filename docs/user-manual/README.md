# Údržba uživatelské příručky

Veřejná příručka je na `/user-manual/`. Obsah je v
`public/user-manual/index.md`, vzhled a chování v `manual.css` a `manual.js`.
HTML a znalostní bázi generuje `npm run build:user-manual`. Generované soubory
se verzují spolu se zdrojem; běžný web build je kopíruje do `dist`.

## Obsah a ověřování

Příručka z 16. 9. 2026 byla porovnána s verzí 1.9.36. Datum a verze ověření
jsou v `review.json` a úvodním textu. Generátor nepřepíše ověřenou verzi pouze
proto, že se zvýšila verze balíčku; při rozdílu vypíše upozornění.
Při aktualizaci ověřte každou změněnou funkci, upravte údaje o ověření i snímky.

Hlavní zdroje pravdy:

- `features/projects/model/projectNavigation.ts` a `features/projects/ui/ProjectSidebar.tsx` — názvy a členění navigace.
- `features/projects/ui/TenderPlan.tsx` — plán VŘ.
- `features/projects/pipeline/ui/BidCard.tsx` a `BidRecipientPicker.tsx` — nabídky a adresáti.
- [Příjemci poptávky](../architecture/pipeline-recipient-selection.md).
- [Vazby smluv](../development/contract-bid-navigation.md).
- `features/projects/documents/ui/ProjectDocuments.tsx` — nastavení stavby a Složkomat.
- `features/tasks/ui/TasksPage.tsx` — osobní úkoly.
- `features/public/ui/landing-apex.css` — Manrope a výsledná světlá paleta: slonovinová #f5f2ec, text #20252c, pálená oranžová #af4821. Použijte poslední přepsání tokenů ve stylu, nikoli původní tmavý blok.

Právní část byla ponechána obsahově beze změny. Není předmětem nové právní
revize. Neuvádějte neověřenou tabulku tarifů nebo sliby o offline funkčnosti.

## Snímky skutečných komponent

`preview.tsx` a `catalog.tsx` vykreslují produkční komponenty s výhradně syntetickými údaji.
Nadpisy a vysvětlující rámce slouží jen dokumentaci; nejde o screenshot celého
přihlášeného klienta. Firmy a osoby jsou smyšlené, e-maily používají example.com,
telefony jsou záměrně neplatné. Náhled nečte `.env` a služby zapisující smlouvy
nebo plán jsou nahrazeny odmítajícími funkcemi. Žádný skutečný e-mail se neodesílá.

1. Spusťte `node docs/user-manual/preview.mjs` (lokálně na portu 4176).
   Ukázkové vstupní soubory obnovíte příkazem `node docs/user-manual/buildSamples.mjs`.
2. Použijte již nainstalovaný Playwright; nové závislosti nejsou nutné.
3. Nastavte `PLAYWRIGHT_MODULE` na absolutní cestu k jeho `index.mjs` a spusťte
   `node docs/user-manual/capture.mjs` a následně `node docs/user-manual/captureCatalog.mjs`. Bez `CHROME_BIN` se používá prohlížeč spravovaný Playwrightem; proměnná umožňuje zadat vlastní cestu k Chrome.
4. Prohlédněte všechny PNG uvedené v `screenshots.json` v `public/user-manual/assets/`. Zkontrolujte
   čitelnost, nezakryté prvky a shodu se scénářem.
5. Spusťte `npm run build:user-manual`. Generátor načte rozměry PNG a rezervuje
   prostor pro líně načítané obrázky.

Záznam původu snímků je v `screenshots.json`. Verze se přebírá z `review.json`, datum z okamžiku pořízení. Dílčí pořízení zapisuje metadata konkrétních snímků do `captures`; při změně ověřené verze nejprve obnovte základní sadu a pak celý katalog. Capture povoluje pouze lokální
náhled a Google Fonts. Katalog navíc u mapy povoluje veřejné OSM dlaždice se syntetickými polohami a zachovává jejich atribuci. Ostatní požadavky blokuje a považuje za chybu.
Náhled není součástí veřejného buildu aplikace.

## Kompatibilita a bezpečnost

`legacy-anchors.json` zachovává staré odkazy na kapitoly. Při odstranění nadpisu
přidejte alias do odpovídající nové kapitoly. Existující ID mají přednost.
Znalostní báze zachovává původní formát. Markdown prochází DOMPurify; obrázky
musí odkazovat do místní složky assets. Vyhledávání používá textContent a
neinterpretuje dotaz jako HTML. Skript je samostatný soubor, bez inline JS.
Zvětšení funguje přes nativní dialog, bez JS zůstává přímý odkaz na PNG.
Logo odkazuje na obsah příručky. Odkaz zpět na web se zobrazuje pouze přes HTTP(S), nikoli při desktopovém otevření přes `file://`.
Tisk zahrnuje i kapitoly skryté filtrem. Příručka nepotřebuje přihlášení.

## Kontroly

- `npm run test:run -- tests/userManualPage.test.ts tests/userManualInteractions.test.ts tests/userManualKbBuilder.test.ts tests/userManualCoverage.test.ts tests/userManualCapture.test.ts`
- `npm run typecheck`, `npm run build`, `npm run check:docs`
- `npm run check:boundaries`, `npm run check:legacy-structure`
- Celá sada: `npm run test:run`

V produkčním preview ověřte načtení `/user-manual/` i `/user-manual/index.html`,
starý fragment `#vyberova-rizeni-pipeline`, hledání „prijemce poptavky“, prázdný
výsledek a reset, otevření obrázku a Escape, mobilní obsah a tisk celého obsahu.
Prověřte všechny obrázky, odkazy, konzoli a síť. Doporučené rozměry: 1440×1000
na desktopu a 390×844 na mobilu.

Při této práci nebyly instalovány balíčky ani upravovány migrace, oprávnění
nebo produkční data. Před implementací nebyla otevřená PR a posledních šest
CI běhů bylo úspěšných. Code scanning vracel „no analysis found“, Dependabot
alerts byly vypnuté; nejde tedy o potvrzení absence bezpečnostních nálezů.

## Rozsah obrazového rozšíření

Všechny položky hlavní a projektové navigace jsou mapované v `coverage.json`. Test porovnává tento seznam s produkční navigací a ověřuje dostupnost snímků i jejich původ. To kontroluje pokrytí dokumentace, nikoli správnost všech produkčních operací. Osobní nastavení a nástroje jsou zahrnuté; systémová a organizační administrace je odložená podle zadání.

Katalog se typově kontroluje příkazem `node node_modules/typescript/bin/tsc -p docs/user-manual/tsconfig.json`. Služby v `catalogStubs.mjs` vracejí syntetická čtení a odmítají vzdálené změny. Biometrika simuluje pouze dostupnost hardwaru; nejde o test nativního ověření. OCR, e-maily a synchronizace se ve skutečných službách nespouštějí.

K pořízení jednoho opraveného snímku lze předat jeho identifikátor: `node docs/user-manual/captureCatalog.mjs slozkomat`. Po změně fixture nejprve restartujte `preview.mjs`, který sestavuje izolovaný náhled. Mapový snímek záměrně nezmrazuje hodiny, protože Leaflet používá čas pro průhlednost dlaždic; capture čeká na jejich načtení.
