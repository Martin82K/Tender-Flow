# Releasing Guide - Tender Flow Desktop (GitHub Releases)

Tento dokument popisuje release proces desktop aplikace přes GitHub Releases.

## Přehled

Distribuce používá:

- `electron-updater` s `github` providerem
- GitHub Release assets jako zdroj aktualizačních souborů
- Windows auto-update flow (`latest.yml`, `.exe`, `.blockmap`)
- macOS arm64 artefakty pro manuální distribuci (`.dmg`, `.zip`, `.zip.blockmap`, `latest-mac.yml`)

## Scope a chování

- `Windows`: auto-update je aktivní.
- `macOS arm64` (Apple Silicon): auto-update je zatím vypnutý (manual release mode), distribuují se pouze artefakty.

## Proměnné prostředí

### GitHub Actions

- Není potřeba Vercel Blob secret.
- Používá se vestavěný `GITHUB_TOKEN` s `contents: write`.

### Desktop runtime

- Není potřeba `UPDATE_BASE_URL` ani `UPDATER_BASE_URL`.
- Není potřeba updater auth token pro klienta.

## Release flow

1. Bump verze:

```bash
npm run version:patch
```

2. Commit + tag:

```bash
git add package.json package-lock.json config/version.ts
git commit -m "chore: bump version to X.Y.Z"
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin main --tags
```

3. Workflow `.github/workflows/release.yml`:

- job `release-win`:
  - buildne Windows artefakty
  - uploadne do GitHub Release:
    - `Tender-Flow-Setup-<version>.exe`
    - `Tender-Flow-Setup-<version>.exe.blockmap`
    - `latest.yml`
- job `release-mac-arm64`:
  - buildne macOS arm64 artefakty
  - uploadne do stejného GitHub Release:
    - `*.dmg`
    - `*-mac.zip`
    - `*-mac.zip.blockmap`
    - `latest-mac.yml`

## Ověření

1. Po tagu `vX.Y.Z` existuje jeden GitHub Release obsahující win + mac arm64 assets.
2. Windows desktop klient:

- přihlášený uživatel
- Nastavení -> Aktualizace -> `Zkontrolovat` -> `Stáhnout` -> `Restartovat`

3. macOS arm64 desktop klient:

- updater vrací `not-available` (expected)
- instalace přes stažený release artefakt manuálně

## Poznámky k bezpečnosti

- Odstraněním Vercel update API se snižuje attack surface.
- Public GitHub Releases eliminují potřebu distribuovat privátní updater tokeny do klientů.
