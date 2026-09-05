# Kontrola světlé palety TenderFlow

Datum: 5. 9. 2026. Rozsah: zvolená varianta 3 pro landing page a veřejné právní stránky.

## Vizuální podklady a stav

- Zdroj návrhu: `/Users/martinkalkus/.codex/generated_images/01a06e27-0f36-7682-94bd-f9197bf54aa4/exec-ab4b5771-e66e-484e-b4f5-798323456fa4.png`.
- Implementace: `http://127.0.0.1:4173/`, produkční Vite build.
- Finální screenshot: `output/playwright/ivory/desktop-final.png`.
- Společné srovnání zdroje vlevo a implementace vpravo: `output/playwright/ivory/comparison-final.png`.
- Detail panelu: `output/playwright/ivory/detail-panel.png`.
- Zdroj 1672 × 941 px byl normalizován na 1280 × 720 px. Implementace má viewport i screenshot 1280 × 720, efektivní hustotu snímku 1 px/CSS px. Srovnání má 2560 × 720 px.
- Stav: nepřihlášený návštěvník, úvod, vybraná fáze 02 / Nabídky. Mobilní kontrola 390 × 844 CSS px, screenshot ve stejné velikosti.
- Screenshoty jsou lokální ověřovací výstupy mimo commit; jejich cesty neoznačují publikované přílohy.

## Zjištění a historie srovnání

1. První společné srovnání `output/playwright/ivory/comparison.png`: P2 — úvodní ilustrace a přepínač fází přesahovaly první obrazovku 1280 × 720. Oprava pouze nad 1120 px: horní odsazení hero 7rem, ilustrace zarovnaná k začátku s odsazením 3.25rem, poměr stran 1.47.
2. Nový screenshot a společné srovnání `comparison-final.png`: celá ilustrace i CTA jsou viditelné. P2 odstraněno.
3. Test kontrastu původně odhalil 4.318:1 u oranžové na zvýšeném povrchu. Akcent byl ztmaven na `#af4821`; všechny testované kombinace běžného textu a CTA nyní splňují alespoň 4.5:1. Jde o kontrolu konkrétních tokenů, nikoli certifikaci přístupnosti celé aplikace.

## Pět oblastí vizuální věrnosti

- **Písmo:** zachované produkční písmo, řezy a česká typografie. Hierarchie a zalomení hlavního titulku odpovídají návrhu. Generovaný obrázek není přesná typografická specifikace; drobné rozdíly v panelu a metrikách písma jsou přijatelné. Detail panelu byl otevřen společně se zdrojem; popisek, titul, odstavec i stav jsou čitelné.
- **Rozvržení:** zachované dva sloupce, navigace, zaoblená ilustrace a pět fází. Po opravě se obsah vejde do prvního desktopového pohledu. Mobil se skládá do jednoho sloupce; šířka dokumentu i viewportu jsou 390 px.
- **Barvy:** slonová kost `#f5f2ec`, inkoust `#20252c`, pálená oranžová `#af4821`, světlé karty `#fffefb`. Oproti obrazovému návrhu je akcent úmyslně tmavší kvůli čitelnosti. Jemné stíny nahrazují tmavé záře. Původní názvy sdílených proměnných zůstávají kvůli kompatibilitě přihlášení.
- **Ilustrace:** nová rastrová varianta architektonického modelu, světlý kámen a oranžová cesta. JPEG 1586 × 992 px, 192132 bajtů, lokální soubor bez dalšího síťového poskytovatele. Zachované rozměry obrázku v HTML a priorita načítání.
- **Obsah:** texty, nabídka, fakturace i workflow se touto změnou nemění. Vizuálně ověřeny úvod, MCP, ceník a podmínky.

## Funkční a technické ověření

- Přepnutí z Nabídek na Smlouvu změnilo obsah a aktivní stav.
- Odkazy MCP a Ceník přešly na správné sekce; CTA pro demo zůstává odkazem mailto.
- Přihlášení se otevřelo a zachovalo vlastní motiv (`--bg: #0c1210`); aplikační a přihlašovací téma nejsou součástí změny.
- Mobilní důkazy: `mobile.png`, `mobile-mcp.png`, `mobile-terms.png` ve stejném adresáři výstupů. Právní nadpisy jsou tmavé a čitelné.
- Prohlížeč v ověřených stavech nehlásil chyby v konzoli. Ilustrace se načetla.
- Regresní test nejprve RED (chybějící světlé tokeny), následně GREEN. Cílené testy: 18/18. Celá sada po dodatečných opravách: 2373/2373, 465 souborů, bez přeskočených testů.
- Typecheck, produkční build, kontrola dokumentace, hranic modulů a legacy struktury prošly. Desktop TypeScript byl zkontrolován přímo pomocí existujícího kompilátoru bez instalace balíčků.
- První běh celé sady zablokoval sandbox při otevření lokálního portu; opakovaný běh mimo toto omezení prošel.
- Build zachovává existující varování o velikosti chunků. Není změněna autentizace, oprávnění, CSP, API ani závislosti; nevznikla migrace či desktopový instalátor.

## Omezení mimo rozsah této palety

GitHub Code Scanning při kontrole neposkytl analýzu (404). Dřívější obsahové PR #409 má dodatečné připomínky k druhému AI poskytovateli při extrakci, nalezitelnosti návodu pro MCP a duplicitním podmínkám v manuálu. Tato vizuální kontrola je neuzavírá ani nepotvrzuje soulad celého AI zpracování. Přihlášený desktopový tok nebyl touto vizuální změnou znovu testován.

## Implementační kontrola

- [x] Světlé tokeny omezené na veřejné stránky.
- [x] Ilustrace, průsvitné karty, stíny a CTA sladěny.
- [x] Kontrast, desktop a mobil ověřeny.
- [x] Společné vizuální srovnání po opravě bez zbývajícího P0/P1/P2 v rozsahu palety.

## Dodatečná revize PR #410

Po prvním merge dorazily tři P2 připomínky. Všechny byly ověřeny a opraveny:

- Barevný štítek Riziko a iniciály referencí měly nedostatečný kontrast. Nyní mají neprůsvitné povrchy s explicitními páry tokenů (modrá `#24549a` na `#e8effb`, inkoust `#20252c` na `#e7e1d8`). Nový regresní test nejprve selhal a po opravě prošel; prohlížeč potvrdil stejné skutečné barvy. Důkaz: `output/playwright/ivory/references-final.png`.
- Na nízkém desktopu se výška ilustrace nyní omezuje podle viewportu, pod 700 px výšky se upravuje velikost hlavního titulku. Při 1366 × 657 px je spodní hrana fází 612.41 px a CTA 527.67 px. Důkaz: `output/playwright/ivory/low-final.png`.
- Cookie lišta je sourozenec stránky. Sdílí proto světlé tokeny pomocí selektoru `body:has(.landing-apex:not(.auth-apex-page))`; stav souhlasu ani analytika se nemění. První návštěva na čistém originu localhost ověřila světlou lištu i funkční volbu Jen nezbytné. Důkaz: `output/playwright/ivory/low-cookie.png`. Před volbou je lišta očekávaně překryvem nad spodní částí stránky.
- Nové společné srovnání zdroje a implementace po opravách při 1280 × 720: `output/playwright/ivory/comparison-followup.png`, implementace `desktop-followup.png`. Kompozice, typografie, paleta, ilustrace a obsah zůstávají v přijatých mezích; žádné zbývající P0/P1/P2 v rozsahu této palety.
- Opakovaně prošlo všech 2373 testů, typecheck, build, dokumentace, boundaries, legacy a desktop TypeScript. Konzole kontrolovaných stavů bez chyb. CI předchozího PR zaznamenalo 7 existujících moderate závislostních nálezů, žádné high/critical; tato změna závislosti nemění.

## Zapracování uživatelských anotací

Uživatel při prohlížení náhledu upřesnil finální obsah: úvod bez tlačítka Domluvit ukázku; v ceníku jediné tlačítko Kontaktujte nás; nadpis Co tedy získáte? bez ikony; položka Tender Flow MCP server. Tyto explicitní změny mají přednost před původním obrazovým návrhem. Odsazení pod úvodním odstavcem bylo zmenšeno.

Finální společné porovnání: `output/playwright/ivory/comparison-user-comments.png` (zdroj vlevo, nová implementace vpravo, 1280 × 720 na každé straně). Aktuální hero: `hero-no-cta.png`; ceník po úpravách: `pricing-contact.png` (1250 × 1212). Odstraněné CTA je záměrná změna uživatele, nikoli vizuální vada. Kontaktní odkaz má správný mailto cíl. Nový test ověřuje absenci CTA v úvodu a jediný kontakt v ceníku; test původního demo odkazu nyní kontroluje zachované odkazy v závěru stránky a patičce.

Po odstranění nevyužitého importu z ceníku se počet hran architektonického grafu snížil z 1791 na 1790 (vyřešených 1509 → 1508); odpovídající kontrolní počty byly aktualizovány. Celá sada po těchto změnách: 2374/2374 v 465 souborech; typecheck, build, dokumentace a strukturální kontroly prošly.

## Firemní reference BAU-STAV

Na výslovnou žádost uživatele přibyla samostatná karta BAU-STAV a.s., stavební společnost, Karlovy Vary, s odkazem na https://www.baustav.cz/cs/. Název a sídlo byly ověřeny na této oficiální stránce dne 5. 9. 2026; zařazení mezi reference je podloženo pokynem uživatele. Karta nemá připsanou citaci ani hvězdičkové hodnocení. Externí odkaz používá noopener noreferrer, bez načítání cizích skriptů či obrázků.

Vizuálně ověřeno ve stejných světlých tokenech na desktopu 1250 × 1212 (`output/playwright/ivory/baustav-desktop.png`) a mobilu 390 × 844 (`baustav-mobile.png`), bez horizontálního přetečení. Jde o nově vyžádaný obsah mimo původní hero obrázek, nikoli o odchylku od něj. Regresní test ověřuje firmu, město, cíl odkazu a absenci citace/hodnocení. Celá finální sada: 2375/2375 v 465 souborech; typecheck, build, dokumentace, boundaries a legacy prošly.

## Odolnost selektorů po revizi

Připomínka k nepodporovanému `:has()` je vyřešena použitím odpouštějícího seznamu `:is(...)` pro sdílené tokeny. Neznámý selektor lišty tak nevyřadí platný selektor veřejné stránky. Chování odpovídá dokumentaci MDN pro :is() (https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:is). Výsledný minifikovaný CSS zachovává :is(); v prohlížeči byla jeho větev :has() nahrazena neznámou pseudotřídou při read-only dotazu, který nadále správně našel landing page. Skutečné pozadí zůstalo #f5f2ec. Vzhled a dříve schválené kompozice se nemění; plná sada 2375 testů znovu prošla. Starší Firefox nebyl samostatně spuštěn.

final result: passed

## Postup výstavby v hero — 5. 9. 2026

**Zdroj a rozsah:** uživatel schválil postupnou výstavbu ve stávajícím obrázku. Vizuální pravda je `assets/landing/tender-landscape-ivory.jpg` a čtyři jeho cílené editace, produkční výstupy `assets/landing/construction-{site,foundations,shell,finishing,complete}.webp`. Úplné zadání a původ jsou v `assets/landing/construction.md`. Scény představují metaforu postupu tendru, popisy zachovávají skutečné funkce produktu. Žádné změny sloganu, ceníku nebo jiných sekcí.

**Společné srovnání:** `output/playwright/construction/comparison-full.png` obsahuje zdrojovou produkci (`source-production.png`) a novou implementaci (`desktop-finishing.png`) vedle sebe, stejný krok 04, posun stránky 0, viewport 1250 × 1211 CSS px, screenshoty 1250 × 1211 px, hustota 1. Výsledný obraz 2500 × 1211 px. Rozdílná poloha běžícího marquee není odchylkou layoutu. Předchozí nesrovnatelný snímek sekce referencí byl nahrazen správným zdrojem před hodnocením.

**Detail:** `comparison-complete.png` porovnává finální zdroj a odpovídající výřez skutečné scény po přepnutí na 05. Zdroj 1586 × 992 je normalizován stejným cover výřezem na 760 × 517 px; implementace má cca 760.4 × 517.3 CSS px, bez hustotního rozdílu. Zdroj bez UI a implementace se schváleným panelem a navigací jsou očekávaně odlišné pouze překryvy. Scéna, cesta, velikost budovy, světlo i odstín odpovídají.

**Pět povinných povrchů:**
- Typografie: fonty, hierarchie, slogan a desktopové zalomení zachované, malé texty čitelné; žádné zkrácené popisy.
- Rozestupy/layout: desktop stejné rozměry a překryvy; mobil záměrně používá panel nad obrazem, aby stavbu nic nezakrývalo. Výška obrazu rezervována před načtením.
- Barvy/tokeny: stávající ivory/ink/orange, původní tokeny a kontrastní stavy tlačítek zachovány.
- Ilustrace: pět skutečných lokálních bitmap, shodná kamera a oranžová cesta; jemné generativní rozdíly detailů modelu akceptovány jako P3, nikoli měřítkový nebo kompoziční skok. WebP bez viditelných rušivých artefaktů při cílové velikosti.
- Obsah: každý krok má vlastní ilustraci, správný popisek a původní vysvětlení tendru. Výchozí krok 01 umožní prohlédnout postup od pláně.

**Historie oprav:**
1. [P2] Původní mobilní cover výřez a panel překrývaly budovu. Důkaz `mobile-before.png`. Opraveno oddělením panelu a zobrazením celé scény; následný `mobile-complete.png` (390 × 844) ukazuje celý model, celý popis a pět tlačítek.
2. [P2] Na 320 px přesahovaly dlouhé názvy svou buňku (Vyhodnocení scrollWidth 62 při clientWidth 52). Pod 360 px nyní lišta umožňuje vodorovný posun, tlačítka 66 px bez přesahu. `mobile-320-final.png` (320 × 740), dokument scrollWidth=viewport=320. Všechna tlačítka dostupná; fokus zvoleného koncového kroku posune lištu správně.
3. Společné desktopové srovnání po opravách zachovává schválené rozložení. Žádné zbývající P0/P1/P2 v rozsahu změny.

**Ověření chování:** všech pět klikacích kroků a Tab/Enter, správná dostupná aktivní ilustrace, žádný prázdný přechod při čekání na další asset; opožděné načtení starší volby a chyba assetu ověřeny regresními testy. Konzole prohlížeče bez chyb, všech pět obrazů skutečně načteno s naturalWidth > 0. V načteném produkčním CSS ověřeno transition:none pro ilustrace pod prefers-reduced-motion; samostatná OS emulace omezeného pohybu nebyla spuštěna. Na mobilu 390 px všech pět tlačítek viditelných, pod 360 px záměrně posuvná lišta.

**Technické kontroly:** první RED 3 nové testy selhaly, po implementaci všechny prošly. Finální plná sada 2378/2378, 465 souborů. Typecheck, web build, docs, boundaries, legacy a lokální desktop tsc prošly. Nové závislosti ani instalace nejsou potřeba. Pět assetů celkem 540194 B, první 87724 B s vysokou prioritou, ostatní nízká priorita. První úplný běh nalezl pouze očekávanou změnu počtu obrazových importů v architektonickém snapshotu; po ověření a aktualizaci prošel druhý úplný běh.

**Bezpečnost a omezení:** pouze statické assety ze stejného originu a lokální UI stav, žádné nové síťové API, tenant data, tajemství, oprávnění nebo změny CSP. Code-scanning signál GitHubu nebyl dostupný (404/no analysis); předchozí nesouvisející nálezy popsané výše tato změna neřeší. Nenahrazuje měření výkonu na fyzickém pomalém zařízení. Celkem se načítá přibližně o 348 kB více obrazových dat než u předchozího jediného JPEG, první snímek je menší.

final result: passed

## Dodatečná anotace — odstranění posuvného pásu

Uživatel výslovně požádal odstranit marquee s názvy funkcí. Odstraněna celá sekce, její animace apexScroll a nepoužívané CSS; související test palety již nevyžaduje zrušený dekorativní oddělovač. Obsah samotných modulů zůstává zachovaný.

Společné srovnání před/po: `output/playwright/construction/comparison-no-marquee.png`, 1250 × 1211 na každé straně, krok 05. Zdrojový snímek před odstraněním byl posunut o 16 px, což je zohledněná odchylka polohy, nikoli layoutová regrese. Finální snímek `desktop-no-marquee.png`: přímý následující sourozenec hero je #funkce, .marquee-section neexistuje, dokument nepřetéká. Typografie, barvy, obrazová kvalita a texty ostatních sekcí zůstávají zachované. Zmizel celý pás i jeho rezervované místo; ostatní odsazení se nemění. Žádný nový P0/P1/P2 nález.

final result: passed
