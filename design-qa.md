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
- Regresní test nejprve RED (chybějící světlé tokeny), následně GREEN. Cílené testy: 18/18. Celá sada: 2372/2372, 465 souborů, bez přeskočených testů.
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

final result: passed
