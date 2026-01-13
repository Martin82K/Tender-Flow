# Releasing Guide - Tender Flow Desktop

Tento dokument popisuje, jak vytvořit nový release desktopové aplikace Tender Flow.

## Přehled

Aplikace používá **GitHub Releases** pro distribuci a **electron-updater** pro automatické aktualizace. Když publikujete nový release na GitHubu, všechny nainstalované aplikace budou automaticky notifikovány o dostupné aktualizaci.

## Před Vydáním Release

### 1. Kontrola Změn

- ✅ Ujistěte se, že všechny změny jsou committnuté
- ✅ Otestujte aplikaci lokálně (`npm run desktop:dev`)
- ✅ Zkontrolujte, že všechny testy prochází (`npm test`)

### 2. Bump Verze

Použijte jeden z těchto příkazů podle typu změn:

```bash
# Pro bug fixy (1.0.0 → 1.0.1)
npm run version:patch

# Pro nové funkce (1.0.0 → 1.1.0)
npm run version:minor

# Pro breaking changes (1.0.0 → 2.0.0)
npm run version:major
```

Tyto příkazy automaticky:
- Aktualizují `package.json`
- Synchronizují `config/version.ts`

### 3. Commit Změn Verze

```bash
git add package.json config/version.ts
git commit -m "chore: bump version to X.Y.Z"
git push origin main
```

### 4. Vytvoření Git Tagu

```bash
# Nahraďte X.Y.Z vaší novou verzí
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

## Build Aplikace

### Windows

```bash
npm run desktop:build:win
```

Toto vytvoří:
- `dist-electron/Tender Flow Setup X.Y.Z.exe` - Instalátor pro Windows
- `dist-electron/latest.yml` - Metadata pro auto-updater

### macOS (pokud budete buildovat v budoucnu)

```bash
npm run desktop:build:mac
```

### Výstupní Soubory

Po buildu najdete distribučnísoubory ve složce `dist-electron/`:

```
dist-electron/
├── Tender Flow Setup 1.0.0.exe  (Hlavní instalátor)
├── Tender Flow Setup 1.0.0.exe.blockmap
└── latest.yml  (Auto-updater metadata - DŮLEŽITÉ!)
```

## Vytvoření GitHub Release

### Ruční Způsob

1. **Přejděte na GitHub Releases**
   ```
   https://github.com/Martin82K/Tender-Flow/releases/new
   ```

2. **Vyplňte Informace**
   - **Tag**: Vyberte tag, který jste vytvořili (např. `v1.0.0`)
   - **Release title**: `Tender Flow v1.0.0`
   - **Description**: Popište změny v této verzi

3. **Uploadujte Soubory**
   
   **DŮLEŽITÉ**: Musíte uploadovat všechny soubory z `dist-electron/`:
   
   - ✅ `Tender Flow Setup X.Y.Z.exe`
   - ✅ `Tender Flow Setup X.Y.Z.exe.blockmap`
   - ✅ `latest.yml`

   ⚠️ **Bez `latest.yml` auto-updater nebude fungovat!**

4. **Publikujte Release**
   - Klikněte na "Publish release"

### Automatický Způsob (GitHub Actions - Budoucnost)

V budoucnu můžete použít GitHub Actions workflow pro automatický build a publish:

```bash
# Jen vytvoříte a pushnete tag
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# GitHub Actions automaticky:
# 1. Buildne aplikaci
# 2. Vytvoří release
# 3. Uploadne soubory
```

## Po Publikování Release

### Ověření Auto-Updateru

1. **Nainstalujte předchozí verzi** aplikace (pokud máte)
2. **Spusťte aplikaci**
3. **Vyčkejte několik sekund** - aplikace automaticky zkontroluje updates
4. **Měla by se objevit notifikace** o nové verzi
5. **Klikněte na "Stáhnout aktualizaci"**
6. **Po stažení klikněte na "Nainstalovat a restartovat"**

### Monitoring

Aplikace kontroluje aktualizace:
- ✅ Při startu (po 5 sekundách)
- ✅ Automaticky každých 6 hodin

Logy najdete v konzoli aplikace (Ctrl+Shift+I v dev módu).

## Release Notes - Best Practices

Při psaní release notes doporučujeme strukturu:

```markdown
## 🎉 Co je nového

- Nová funkce X
- Vylepšení Y

## 🐛 Opravy

- Opraven bug A
- Opraven crash B

## 🔧 Technické změny

- Aktualizace závislostí
- Performance vylepšení

## 📦 Instalace

Stáhněte si instalátor níže a spusťte ho. Existující instalace budou automaticky aktualizovány.
```

## Troubleshooting

### Auto-updater nenajde update

**Příčiny:**
- ❌ Nepřítomný `latest.yml` soubor v release
- ❌ Špatný tag (musí být ve formátu `vX.Y.Z`)
- ❌ Release není publikovaný (je draft)

**Řešení:**
1. Zkontrolujte, že všechny 3 soubory jsou nahrané
2. Zkontrolujte tag formát
3. Publikujte release (ne draft)

### Build selhává

**Příčiny:**
- ❌ Node modules nejsou aktuální
- ❌ Chybějící závislosti
- ❌ Nekompatibilní verze Node.js

**Řešení:**
```bash
# Vyčistit a reinstalovat
rm -rf node_modules dist dist-electron
npm install
npm run desktop:build:win
```

### Code Signing (Volitelné)

Pro produkční použití doporučujeme podepsat aplikaci:

1. **Získejte Code Signing Certificate**
   - Pro Windows: OV/EV certifikát (~$100-500/rok)
   - Pro macOS: Apple Developer účet ($99/rok)

2. **Konfigurujte electron-builder**
   - Přidejte certifikát do build procesu
   - Aplikace nebude zobrazovat "Unknown publisher" varování

## GitHub Token Setup

Pro publikování releases potřebujete GitHub Personal Access Token:

1. Jděte na: https://github.com/settings/tokens
2. "Generate new token" → "Generate new token (classic)"
3. Scope: Zaškrtněte `repo` (celý)
4. Zkopírujte token a uložte si ho

Token použijte jako environment variable:
```bash
# Windows PowerShell
$env:GH_TOKEN="your_token_here"

# Windows CMD
set GH_TOKEN=your_token_here
```

## Checklist pro Release

```markdown
- [ ] Všechny změny committnuté
- [ ] Verze bumpnutá (`npm run version:patch/minor/major`)
- [ ] Changelog/Release notes připravené
- [ ] Git tag vytvořen a pushnutý
- [ ] Build úspěšný (`npm run desktop:build:win`)
- [ ] Všechny soubory z dist-electron/ uploadnuté na GitHub
- [ ] latest.yml přítomný v release
- [ ] Release publikován (ne draft)
- [ ] Auto-updater otestován na starší verzi
```

## Automatizace (Volitelné)

Pro zjednodušení procesu můžete vytvořit PowerShell script:

```powershell
# scripts/release.ps1
param([string]$version)

Write-Host "Creating release $version..."

# Build
npm run desktop:build:win

# Create tag
git tag -a "v$version" -m "Release v$version"
git push origin "v$version"

Write-Host "Build complete! Create GitHub release manually and upload files from dist-electron/"
```

Použití:
```bash
.\scripts\release.ps1 -version 1.0.1
```

## Podporované Platformy

Aktuálně:
- ✅ Windows (x64)

V budoucnu:
- 🔄 macOS (Intel + Apple Silicon)
- 🔄 Linux (AppImage, deb)

## Kontakt

Pokud máte problémy s release procesem, kontaktujte vývojový tým.
