# Design QA — tabulka výběrových řízení

## Podklady

- Referenční obrazovka: `/var/folders/s6/77rp_7mn3cngz8ythy3sn4y00000gn/T/TemporaryItems/NSIRD_screencaptureui_mrDliV/Snímek obrazovky 2026-08-19 v 18.34.17.png`
- Browser-renderovaná implementace: `/private/tmp/tender-flow-pipeline-desktop.png`
- Responzivní kontrola: `/private/tmp/tender-flow-pipeline-narrow.png`
- Kontrola vrstvení tooltipu: `/private/tmp/tender-flow-tooltip-layer.png`
- Skinovaný dropdown Kontaktů: `/private/tmp/tender-flow-dropdown-desktop.png`
- Skinovaný dropdown Kontaktů na užší šířce: `/private/tmp/tender-flow-dropdown-narrow.png`
- Společné vizuální porovnání: `/private/tmp/tender-flow-pipeline-comparison.png`
- Zdrojový snímek: 2215 × 1012 px.
- Implementační snímek: 2196 × 990 px při CSS viewportu 2200 × 990 a `deviceScaleFactor` 1.
- Úzký snímek: 820 × 900 px při CSS viewportu 820 × 900 a `deviceScaleFactor` 1.
- Pro porovnání byly oba desktopové snímky normalizovány na výšku 990 px a vloženy vedle sebe do jediného obrazu 4379 × 990 px.

## Testovaný stav a interakce

- Tabulkové zobrazení se třemi výběrovými řízeními.
- Rozbalení řádku „AL Výplně otvorů“ pomocí přístupného tlačítka; `aria-expanded` se změnilo na `true`.
- Dodavatelé byli vykresleni v pořadí: Zasmluvněn, Vybrán, Dodal cenu, Nedodal cenu, Poptán, Zamítnut / odstoupil; při shodném stavu abecedně.
- Stavy detailu jsou zobrazené prostým barevným textem, barevným levým okrajem a jemným tónováním řádku, bez pill komponent.
- Na viewportu 820 px zůstaly viditelné filtry, obě exportní akce, přepínač zobrazení a tlačítko nové poptávky.
- Tabulka na viewportu 820 px zachovala minimální šířku 1228 px a její kontejner měl `overflow-x: auto` (client width 770 px), takže se obsah neskládá do nečitelných sloupců.
- Zkontrolovány browser konzolové warningy a chyby: žádné.
- Tooltip přepínače tabulky byl při fokusování viditelný nad tabulkou na viewportech 1280 × 720 i 820 × 720. Horní panel vytvořil vrstvu `z-index: 20`, tooltip měl `z-index: 30` a překrývající část zůstala vizuálně nad tabulkou.
- Dlouhý seznam specializací byl porovnán ve stejném vizuálním vstupu s dodaným snímkem Kontaktů. Nová nabídka přebírá skin aplikace, má omezenou výšku, vlastní posuv a vyhledávání místo nativního systémového menu přes celou obrazovku.
- Portal dropdownu měl na desktopu i viewportu 820 × 720 `z-index: 400`, byl skutečně horním prvkem v místě překryvu s tabulkou a nevytvářel horizontální přetečení dokumentu.
- Na úzké šířce vyhledání „beton“ zobrazilo pouze tři odpovídající položky. Žádný nativní select nebyl viditelný a konzole neobsahovala chyby ani varování.

## Vizuální posouzení

- Struktura rodičovského řádku a vnořených dodavatelů odpovídá schválené referenci.
- Záměrná odchylka od screenshotu: stavové pill prvky detailu byly na výslovné přání nahrazeny barevným oddělením celých řádků a prostým textem.
- Barevné stavy jsou čitelné v tmavém motivu, udržují konzistentní výšku řádků a nezasahují do kontaktů ani cen.
- Desktopové i úzké zobrazení zachovává vizuální hierarchii, zarovnání sloupců a použitelné ovládání.
- Pro tuto změnu nebylo potřeba samostatné zvětšení výřezu: společný obraz zachycuje celý relevantní blok tabulky ve stejném rozbaleném stavu.

## Historie oprav

1. První browser průchod odhalil, že interní stav `shortlist` byl označen jako „Dodal cenu“.
2. Mapování bylo opraveno na „Vybrán“ a doplněno regresním testem.
3. Opakovaný browser průchod ověřil schválené pořadí i barevné oddělení bez pillů.
4. Horní panel byl přesunut do vlastní vrstvy nad tabulku a browser kontrola ověřila tooltip v místě skutečného překryvu na desktopové i užší šířce.
5. Nativní dropdowny byly nahrazeny sdíleným skinovaným ovládáním. Kontrola Kontaktů odhalila a odstranila zdvojené šipky; dlouhé seznamy dostaly vyhledávání a bezpečně omezenou výšku.

final result: passed
