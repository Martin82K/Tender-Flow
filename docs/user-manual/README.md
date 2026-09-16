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

`preview.tsx` vykresluje produkční komponenty s výhradně syntetickými údaji.
Nadpisy a vysvětlující rámce slouží jen dokumentaci; nejde o screenshot celého
přihlášeného klienta. Firmy a osoby jsou smyšlené, e-maily používají example.com,
telefony jsou záměrně neplatné. Náhled nečte `.env` a služby zapisující smlouvy
nebo plán jsou nahrazeny odmítajícími funkcemi. Žádný skutečný e-mail se neodesílá.

1. Spusťte `node docs/user-manual/preview.mjs` (lokálně na portu 4176).
2. Použijte již nainstalovaný Playwright; nové závislosti nejsou nutné.
3. Nastavte `PLAYWRIGHT_MODULE` na absolutní cestu k jeho `index.mjs` a spusťte
   `node docs/user-manual/capture.mjs`. `CHROME_BIN` případně určuje cestu k Chrome.
4. Prohlédněte všech šest PNG v `public/user-manual/assets/`. Zkontrolujte
   čitelnost, nezakryté prvky a shodu se scénářem.
5. Spusťte `npm run build:user-manual`. Generátor načte rozměry PNG a rezervuje
   prostor pro líně načítané obrázky.

Záznam původu snímků je v `screenshots.json`. Capture povoluje pouze lokální
náhled a Google Fonts, ostatní požadavky blokuje a považuje za chybu.
Náhled není součástí veřejného buildu aplikace.

## Kompatibilita a bezpečnost

`legacy-anchors.json` zachovává staré odkazy na kapitoly. Při odstranění nadpisu
přidejte alias do odpovídající nové kapitoly. Existující ID mají přednost.
Znalostní báze zachovává původní formát. Markdown prochází DOMPurify; obrázky
musí odkazovat do místní složky assets. Vyhledávání používá textContent a
neinterpretuje dotaz jako HTML. Skript je samostatný soubor, bez inline JS.
Zvětšení funguje přes nativní dialog, bez JS zůstává přímý odkaz na PNG.
Tisk zahrnuje i kapitoly skryté filtrem. Příručka nepotřebuje přihlášení.

## Kontroly

- `npm run test:run -- tests/userManualPage.test.ts tests/userManualInteractions.test.ts tests/userManualKbBuilder.test.ts`
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
