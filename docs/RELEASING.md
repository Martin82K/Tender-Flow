# Releasing Guide - Tender Flow Desktop (Vercel Blob)

Tento dokument popisuje release proces desktop aplikace s privátním update streamem přes Vercel Blob.

## Přehled

Auto-update používá:

- `electron-updater` (`generic` provider)
- update metadata endpoint `GET /api/updates/win/latest.yml`
- stream endpoint `GET /api/updates/win/file?path=...`
- privátní soubory v Vercel Blob pod `releases/win/...`
- autorizaci přes `Authorization: Bearer <Supabase access token>`

## Proměnné prostředí

### Vercel projekt

- `SUPABASE_JWT_SECRET`
- `BLOB_READ_WRITE_TOKEN`

### Desktop build/runtime

- `UPDATE_BASE_URL` (např. `https://<domena>/api/updates/win`)

### GitHub Actions

- `BLOB_READ_WRITE_TOKEN`

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

- buildne Windows artefakty
- uploadne je do Blob:
  - `releases/win/<version>/latest.yml`
  - `releases/win/<version>/Tender-Flow-Setup-<version>.exe`
  - `releases/win/<version>/Tender-Flow-Setup-<version>.exe.blockmap`
  - `releases/win/latest.yml`

## Ověření

1. Bez tokenu:

- `GET /api/updates/win/latest.yml` => `401`

2. S valid tokenem:

- `GET /api/updates/win/latest.yml` => `200`
- `GET /api/updates/win/file?path=releases/win/<version>/Tender-Flow-Setup-<version>.exe` => `200`

3. Desktop:

- přihlášený uživatel
- Nastavení -> Aktualizace -> `Zkontrolovat` -> `Stáhnout` -> `Restartovat`
