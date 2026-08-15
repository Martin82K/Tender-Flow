# Design QA

## Archiv — Nature skin

### Vizuální cíl

- Light: schválený projektový Přehled 26031 Sokolov s chladným březovým lesem.
- Dark: schválená tabulka Výběrová řízení projektu 26026 s nočním jehličnatým lesem.

### Automatické kontroly

- Nature light/dark tokeny a lokální assety: prošly.
- Kontrast hlavního textu: WCAG AAA.
- Kontrast primárních CTA: WCAG AA.
- Produkční build, typecheck, web artifact a desktop TypeScript compile: prošly.
- Cílené skin/settings testy: 37/37.
- Plná sada testů: 1754/1754 ve 360 souborech.
- Boundary a legacy-structure kontroly: prošly.
- Assety jsou lokální JPEG bez vzdálených URL, skriptů nebo vloženého textu.

### Živé ověření

Správná přihlášená TenderFlow Desktop Dev instance byla jednoznačně vybrána přes `/tmp/tender-flow-dependency-security/node_modules/electron/dist/Electron.app` na `localhost:3000`.

- Nature light: Profil a Vzhled, Nástroje/Excel/import kontaktů a společné settings povrchy bez cizí modré; lesní artwork je ztlumený.
- Nature dark: Profil a Vzhled, Nástroje, Organizace a Administrace; stromy jsou čitelné v sidebaru/headeru a datové plochy zůstávají kryté.
- Po synchronizaci s mainem byl Profil/Vzhled znovu ověřen přes hot reload: přímý Režim a skinovaný Motiv se vykreslují bez Vite/PostCSS overlay.
- Avatarové menu i Profil/Vzhled používají jednu sdílenou komponentu režimu a jeden společný registr voleb.

Přepnutí na Botanica/Industrial/Classic v posledním post-sync průchodu automatizace odmítla, proto jejich živý stav kryjí předchozí vizuální kontroly a společné tokenové/regresní testy. Uživatelská data nebyla změněna.

Archivovaný výsledek: passed with documented cross-skin live-QA limitation.

## Profil a účet — varianta 1

## Evidence

- Source visual truth: `/Users/martinkalkus/.codex/generated_images/01a0020e-dd4a-7013-b2be-af7ba9184073/exec-9a4c3a35-79ae-4b74-944e-c271d3624e44.png`
- Browser-rendered implementation: `/private/tmp/tender-flow-settings-chrome-final.png`
- Full-view comparison: `/private/tmp/tender-flow-settings-comparison-final.png`
- Focused account/profile comparison: `/private/tmp/tender-flow-settings-focus-comparison.png`
- Responsive implementation evidence: `/private/tmp/tender-flow-settings-responsive-fixed.png`
- Route: `http://localhost:3000/app/settings?tab=user&subTab=profile`
- Browser: user-selected signed-in Google Chrome
- State: authenticated existing user, light Industrial theme, Microsoft provider intentionally not enabled by the administrator
- CSS viewport: `1440 × 1024`; responsive check: `1024 × 768`
- Source pixels: `1487 × 1058`, density 72 DPI
- Implementation pixels: `1440 × 1024`, density 72 DPI, `deviceScaleFactor: 1`
- Density normalization: both full views were normalized with `contain` to `1440 × 1024` panels before the side-by-side comparison.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: the implementation preserves the reference hierarchy, compact labels, readable body copy, and distinct card headings. The product's existing font stack was retained intentionally.
- Spacing and layout rhythm: the reference's account/profile pair, full-width signature panel, and lower-frequency settings order are preserved. Card radii, borders, spacing, and alignment follow the existing Tender Flow design system.
- Colors and visual tokens: the implementation uses the existing Industrial background grid and orange primary token. Disabled Microsoft setup is communicated with both opacity and explanatory text.
- Image and icon fidelity: existing Tender Flow logo assets and the product's Material Symbols icon system are preserved. The Microsoft card uses the product icon language instead of introducing a new third-party asset.
- Copy and content: the implementation keeps real profile and signature fields and clarifies that Microsoft login is administrator-gated. It does not expose the former raw `Missing projectId` rollout error.

Residual P3 difference: the selected concept uses a Microsoft four-square brand mark, while the implementation uses the established account icon. This keeps the repository's current icon system consistent and does not affect comprehension or task completion.

## Focused comparison

The focused account/profile comparison confirms the important detail surfaces are readable: card headings, primary CTA, two permission states, profile metadata, borders, and vertical alignment. A separate focused crop was necessary because these labels were too small to judge reliably in the full 2880-pixel comparison.

## Comparison history

1. Initial responsive pass found a P2 layout issue at the `1024 px` breakpoint: the two account cards switched to columns while two persistent sidebars left insufficient content width.
2. Fix: changed the account and secondary settings grids from `lg` to `xl` column breakpoints and removed the `lg:col-span-2` implicit-grid trigger from the update card.
3. Post-fix evidence: `/private/tmp/tender-flow-settings-responsive-fixed.png`; both top cards measure `470 px`, share no horizontal row at this width, and document width equals viewport width (`1024 px`) with no horizontal overflow.
4. Final `1440 × 1024` comparison shows the intended two-column account/profile composition and full-width signature section.

## Interaction and runtime checks

- Opened the profile settings route as an authenticated user.
- Verified the settings navigation label and page heading `Profil a účet`.
- Verified the Microsoft connection card, profile card, signature, appearance, biometric, additional settings, update, and contact-type sections in the DOM.
- Toggled and closed the user menu to confirm the page remained interactive.
- Verified both `1440 × 1024` and `1024 × 768` layouts and confirmed no horizontal overflow.
- Did not activate Microsoft OAuth or document grants, so no account permission or document sharing state was mutated.
- Checked browser warnings/errors. The tab contained an earlier expired-refresh-token error from the pre-login session; after the user logged in, the settings screen rendered correctly and no `Missing projectId` error was present.

## Implementation checklist

- [x] Account and profile lead the page.
- [x] One progressive Microsoft connection card replaces duplicate competing choices.
- [x] Signature is a dedicated full-width section.
- [x] Existing document sharing and local-folder behavior remain outside this UI change.
- [x] Narrow desktop layout stacks cards before they become cramped.
- [x] Focused regression and security tests cover the changed behavior.

final result: passed
