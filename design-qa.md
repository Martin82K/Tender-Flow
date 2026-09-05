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

final result: passed
