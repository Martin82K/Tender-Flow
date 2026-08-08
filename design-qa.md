# Nature skin — design QA

## Vizuální cíl

- Light: schválený projektový Přehled 26031 Sokolov s chladným březovým lesem.
- Dark: schválená tabulka Výběrová řízení projektu 26026 s nočním jehličnatým lesem.

## Automatické kontroly

- Nature light/dark tokeny a lokální assety: prošly.
- Kontrast hlavního textu: WCAG AAA.
- Kontrast primárních CTA: WCAG AA.
- Produkční build, typecheck, web artifact a desktop TypeScript compile: prošly.
- Cílené skin/settings testy: 37/37.
- Plná sada testů: 1754/1754 ve 360 souborech.
- Boundary a legacy-structure kontroly: prošly.
- Assety jsou lokální JPEG bez vzdálených URL, skriptů nebo vloženého textu.

## Živé ověření

Správná přihlášená TenderFlow Desktop Dev instance byla jednoznačně vybrána přes `/tmp/tender-flow-dependency-security/node_modules/electron/dist/Electron.app` na `localhost:3000`.

- Nature light: Profil a Vzhled, Nástroje/Excel/import kontaktů a společné settings povrchy bez cizí modré; lesní artwork je ztlumený.
- Nature dark: Profil a Vzhled, Nástroje, Organizace a Administrace; stromy jsou čitelné v sidebaru/headeru a datové plochy zůstávají kryté.
- Po synchronizaci s mainem byl Profil/Vzhled znovu ověřen přes hot reload: přímý Režim a skinovaný Motiv se vykreslují bez Vite/PostCSS overlay.
- Avatarové menu i Profil/Vzhled používají jednu sdílenou komponentu režimu a jeden společný registr voleb.

Přepnutí na Botanica/Industrial/Classic v posledním post-sync průchodu automatizace odmítla, proto jejich živý stav kryjí předchozí vizuální kontroly a společné tokenové/regresní testy. Uživatelská data nebyla změněna.

final result: passed with documented cross-skin live-QA limitation
