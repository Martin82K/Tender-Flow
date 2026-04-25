# Tailwind v4 migration — technický dluh

Tento soubor sleduje migraci ze stávajícího "hybridního" stavu (Tailwind Play CDN za běhu) na bundlovaný Tailwind v4. Migrace se postupně aplikuje na samostatné větvi `feat/bundled-tailwind-v4`.

## Proč

Aktuální stav (na `main`, commit `c8c481f`):

- `index.html` načítá `https://cdn.tailwindcss.com?plugins=forms,container-queries` (Tailwind Play **v3**)
- Bundlovaný Tailwind v4 v `node_modules` se reálně nepoužívá — `index.css` se nikde neimportuje, takže Vite ho neprovádí přes PostCSS
- Kvůli tomu, že CDN runtime používá `eval()`, musí desktop CSP v produkci povolit `'unsafe-eval'`. Bez toho se Mac DMG zhroutí na startu (`EvalError`, černé okno)

Co tím získáme po migraci:

- Utažený CSP (žádný `unsafe-eval`, žádný external script v produkci)
- Žádný runtime CDN dependency → rychlejší startup, funguje bez netu
- Reálné používání Tailwind v4 (které už máme v `package.json`)
- Mizí Chromium varování *„cdn.tailwindcss.com should not be used in production"*

## Co je už hotové na větvi `feat/bundled-tailwind-v4`

**Commit `b3e8641` — refactor(styles): bundle Tailwind v4, drop Play CDN**

- `index.tsx` importuje `./index.css` (jádro problému: bez tohohle Vite nikdy nezpracoval `index.css`)
- `index.css` migruje legacy JS theme na nativní v4 CSS-first syntax: `@plugin`, `@theme`, `@custom-variant`
- Přejmenování `--color-primary` → `--color-primary-rgb` v `:root`, aby nekolidovalo s Tailwindovým generovaným theme tokenem
- Oprava arbitrary třídy `shadow-[0_1px_2px_rgba(0,0,0,0.05)]` (v4 přísněji parsuje mezery)
- `index.html` zbavený CDN scriptu a `tailwind-init.js`
- `desktop/main/services/csp.ts` utažený — žádné `unsafe-eval`, žádné `cdn.tailwindcss.com` v produkci
- `tests/desktopCsp.test.ts` aktualizovaný

**Commit `256289b` — fix(styles): preserve user-configurable primary color and v3 border default**

- `@theme` skládá `--color-primary` jako `rgb(var(--color-primary-rgb))`, takže runtime override z `useTheme.ts` se zachovává
- `useTheme.ts` přepsaný na zápis `--color-primary-rgb` místo `--color-primary`
- v3 → v4 compat layer pro default border color (gray-200 místo currentColor)

## Známé regrese, které jsou ještě na větvi otevřené

Vizuální rozdíly mezi `main` (CDN/v3) a `feat/bundled-tailwind-v4` po vizuální kontrole:

- [ ] **Sidebar — aktivní pill nemá zelený gradient** — primary color se nedostane do `.nav-pill-active`. Možné příčiny: timing user preferencí, nebo runtime `--color-primary-rgb` override nedorazí dřív než se renderuje
- [ ] **Sidebar — nav itemy mají větší padding/spacing** než v3 verze (větší button výška, větší gap mezi řádky)
- [ ] **Pozadí content area neodpovídá sidebaru** — viditelný předěl mezi sidebarem a hlavním obsahem (na `main` je viewport jednolitý)
- [ ] **Hover/focus stavy** vypadají jinak — pravděpodobně default ring color (v3 = blue-500/50, v4 = currentColor) a default ring width (v3 = 3px, v4 = 1px)
- [ ] Případně další drobné rozdíly v padding/spacing/typografii — projít systematicky každou obrazovku

## Co ještě udělat (TODO, postupné kroky)

### 1. Dokončit v3 → v4 compat layer

V `index.css` přidat do `@layer base` další compat resety podle [Tailwind v4 upgrade guide](https://tailwindcss.com/docs/upgrade-guide):

- [ ] Default ring color = blue-500/50 (kvůli focus/hover ringům bez explicitní barvy)
- [ ] Default ring width = 3px (pokud projekt používá `ring` bez šířky)
- [ ] Cursor `pointer` pro `<button>` (v4 má default cursor)
- [ ] Placeholder color přibližně jako v v3 (gray-400)

### 2. Audit deprecated utility tříd

Greppem najít a nahradit:

- [ ] `bg-opacity-X` → `bg-color/X` (slash syntax)
- [ ] `text-opacity-X` → `text-color/X`
- [ ] `border-opacity-X` → `border-color/X`
- [ ] `outline-none` → `outline-hidden` všude, kde se opravdu chce reset (nebo `outline-0` pro šířku)
- [ ] Případně další v3-only třídy, které v4 nemá (např. `flex-shrink-X` → `shrink-X`, `flex-grow-X` → `grow-X`)

### 3. Vyřešit primary color flow

- [ ] Ověřit v DevTools, že `--color-primary-rgb` je opravdu nastavená na `<html>` po načtení user preferencí (přidat console.log nebo breakpoint do useEffectu v `useTheme.ts`)
- [ ] Pokud override dorazí pozdě, zvážit synchronní inicializaci (např. už při mountu z localStorage/IndexedDB, ne až po async fetchnutí user profilu)
- [ ] Ověřit, že `.nav-pill-active` opravdu vidí novou hodnotu — gradient používá `rgb(var(--color-primary-rgb) / 0.X)`, takže je to citlivé na to, jestli je proměnná nastavená v okamžiku malby

### 4. Sjednotit pozadí

- [ ] Identifikovat, který wrapper kolem hlavního obsahu má jiné pozadí než sidebar (pravděpodobně v `app/AppContent.tsx` nebo některý layout)
- [ ] Sjednotit na stejný `bg-slate-900` (resp. `bg-background-dark`) jako sidebar

### 5. Pluginové kompatibility

- [ ] Ověřit, že `@tailwindcss/forms@^0.5.10` (psaný pro v3) opravdu funguje s v4 přes `@plugin` direktivu — porovnat výstupní styly inputů s v3 verzí
- [ ] Pokud forms plugin chybí v base styly (`[type=text]`, `[type=email]` apod.), zvážit downgrade na statické styly v `index.css` nebo přepsat na ručně psané utility
- [ ] `@tailwindcss/container-queries@^0.1.1` — ověřit, že `@container` se generuje, jakmile někde v projektu vznikne první container query použití (zatím se nikde nepoužívá)

### 6. Vizuální regrese — projít obrazovku po obrazovce

Doporučený postup: spustit `npm run desktop:dev` z větve, otevřít každou obrazovku vedle sebe se screenshotem z `main`:

- [ ] Login / Register / ForgotPassword (custom landing-apex.css — možná narazí na vlastní problémy)
- [ ] Dashboard / Command Center
- [ ] Subdodavatelé (seznam i karta detail)
- [ ] Project layout — Přehled, Plán VŘ, Výběrová řízení (Pipeline), Harmonogram, Dokumenty, Smlouvy
- [ ] Settings — všechny záložky
- [ ] Modaly (TaskFormModal, ConfirmationModal, AlertModal)
- [ ] URL shortener
- [ ] Public stránky (terms, privacy, cookies, dpa, imprint) — `npm run build` je generuje přes prerender

Každý nalezený rozdíl buď opravit cílenou utility třídou, nebo doplnit do compat layeru, pokud jde o systémový default.

### 7. Cleanup po úspěšném ověření

- [ ] Smazat `tailwind.config.js` (v4 native config je v `index.css`, JS config už je dead code)
- [ ] Smazat `public/tailwind-init.js` (byl jen pro CDN init)
- [ ] Smazat `postcss.config.js` pokud `@tailwindcss/postcss` nepotřebuje další PostCSS plugin (autoprefixer je v v4 už integrovaný)
- [ ] Zvážit přechod na `@tailwindcss/vite` plugin místo `@tailwindcss/postcss` (rychlejší build)

### 8. Verifikace před merge

- [ ] `npm run test:run` — všechny testy zelené
- [ ] `npm run check:boundaries` — žádné nové porušení
- [ ] `npm run check:legacy-structure` — žádné porušení
- [ ] `npm run build` — bez chyb a varování (kromě existujících chunk-size)
- [ ] `npm run desktop:build:mac` — DMG vznikne, **ověřit instalací**, že okno opravdu naběhne se správným vzhledem
- [ ] `npm run desktop:build:win` — totéž pro Windows
- [ ] Screenshoty hlavních obrazovek vedle sebe (před/po) jako součást PR popisu

## Rollback plán

Pokud se v půlce migrace ukáže, že je toho moc:

```bash
git checkout main         # zůstaneš na fungujícím workaroundu (variant A)
# větev nech jako artefakt; z částečné práce se dá pokračovat později
```

`feat/bundled-tailwind-v4` můžeš nechat zachovaný i kdyby se nikdy nedotáhl — dokumentuje, kam až se došlo, a jaké byly slepé uličky.

## Reference

- Tailwind v4 upgrade guide: https://tailwindcss.com/docs/upgrade-guide
- v4 release notes: https://tailwindcss.com/blog/tailwindcss-v4
- Současná `main` verze používá CDN `https://cdn.tailwindcss.com?plugins=forms,container-queries` (Tailwind Play, v3 + plugins)
- Bundlovaná verze v `package.json`: `tailwindcss@^4.1.17`, `@tailwindcss/postcss@^4.1.17`
