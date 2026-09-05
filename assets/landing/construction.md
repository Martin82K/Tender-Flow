# Postup výstavby v úvodu landing page

Pět lokálních WebP ilustrací navazuje na schválený model `tender-landscape-ivory.jpg`. Mapování v `features/public/model/landingContent.ts`: Zadání → pláň, Nabídky → základy, Vyhodnocení → hrubá stavba, Rozhodnutí → dokončování, Smlouva → dokončená budova s okolím. Jde o vizuální metaforu postupu; popisy stále vysvětlují tender, nikoli sledování skutečné výstavby.

Úvod začíná Zadáním. Každý krok mění text a po načtení také obraz. Předchozí načtená scéna zůstává při čekání nebo chybě; opožděná odpověď opuštěného kroku nepřepne aktuální výběr. Selhání se oznámí textem, ostatní kroky zůstávají použitelné. Přechod opacity trvá 450 ms, při prefers-reduced-motion je vypnutý. Žádné automatické přehrávání nebo intervaly. Nativní tlačítka podporují Tab/Enter/mezerník; pouze viditelný obraz má přístupný popisek.

Na desktopu zůstává překryvný panel a spodní navigace; na mobilu je panel nad nezakrytou celou scénou a od 360 px se všech pět tlačítek vejde na šířku; pod 360 px je lišta vodorovně posuvná. Rozměry scény rezervuje CSS, načítání nezpůsobuje posun rozložení.

Obrázky jsou 1586 × 992, WebP quality 82 (celkem 540194 B; první 87724 B). První obraz má fetchPriority high, zbývající low. Použit existující sharp bez instalace závislostí. Všechny assety se obsluhují ze stejného originu, žádné nové API, skripty, oprávnění nebo analytické události.

## Původ a prompty

Vytvořeno 5. 9. 2026 vestavěným imagegen, přesná editace dodané předlohy. Čtvrtá scéna je WebP převod původní schválené ilustrace. Generované originály jsou lokálně v `output/imagegen/construction-originals/`, produkční soubory v tomto adresáři. Výstupní odchylka rozměru o 1–2 pixely byla při exportu sjednocena, bez dalšího retušování.

Společné zadání: Preserve exact camera, perspective, crop, 1586:992 aspect ratio, ivory architectural model material and lighting, terraced terrain, papers, central circular platform, orange route and all five nodes in identical positions. Change only the upper-right building and specified immediate grounds. No text, labels, UI or watermark.

- `construction-site.webp`: Remove the entire tall building and scaffolding; replace its identical footprint with a flat empty graded construction plot and subtle survey stakes. Fill vacated space with warm ivory background. Keep foreground unchanged.
- `construction-foundations.webp`: Remove all above-ground floors and facade; replace with excavated foundation pit, footings and ground-level slab in identical building footprint. No floors or tall building, empty ivory background above.
- `construction-shell.webp`: Replace the whole tall building with exposed reinforced-concrete skeleton at same footprint, height and floor levels. No facade, glazing, windows or cladding. Open slabs, beams, columns and partly unfinished roof; foreground unchanged.
- `construction-finishing.webp`: Existing approved ivory image; no generation.
- `construction-complete.webp`: Finish all facades and windows of the exposed wing, remove scaffolding, preserve architecture. Add tidy paths and miniature ivory trees/shrubs around building and a planted courtyard in the small foreground pit. No saturated green; orange route is the sole accent.

## Ověření

Regresní testy v `tests/LandingPage.modules.test.tsx` pokrývají pět různých scén, první stav, načítání, rychlé přepínání a chyby. Vizuální důkazy a omezení jsou v kořenovém `design-qa.md`. Změna přidává čtyři čisté importy obrázků; kontrola architektonického grafu eviduje 1794 hran, z toho 1508 vyřešených kódových hran a 286 mimo zdrojové kořeny (23 assetů). Nevzniká nová vazba mezi moduly.
