---
description: Vytvoření nového release pro Windows a macOS včetně publikování na GitHub
---

# 🚀 Release Workflow - Tender Flow

Tento workflow popisuje postup pro vytvoření nového release desktopové aplikace pro Windows a macOS, nahrání na GitHub a vytvoření release notes v češtině.

## Prerekvizity

- ✅ Všechny změny jsou committnuté
- ✅ Git working directory je čistý
- ✅ Node.js 20+ nainstalován
- ✅ Přístup k GitHub repository

---

## 1. Kontrola stavu Git repozitáře

```bash
git status
```

Ujistěte se, že jsou všechny změny committnuté.

---

## 2. Zvýšení verze (Bump Version)

Použijte jeden z následujících příkazů podle typu změn:

```bash
# Pro bug fixy (1.0.0 → 1.0.1)
// turbo
npm run version:patch

# Pro nové funkce (1.0.0 → 1.1.0)
# npm run version:minor

# Pro breaking changes (1.0.0 → 2.0.0)
# npm run version:major
```

Tyto příkazy automaticky:

- Aktualizují `package.json`
- Synchronizují `config/version.ts`

---

## 3. Commit změn verze

```bash
git add package.json config/version.ts
git commit -m "chore: bump version to X.Y.Z"
```

Nahraďte X.Y.Z novou verzí.

---

## 4. Build aplikace pro Windows

```bash
# Instalace desktop závislostí (win-hello pro Windows Hello)
npm run desktop:install

# Build
npm run desktop:build:win
```

Výstup:

- `dist-electron/Tender Flow Setup X.Y.Z.exe` - Instalátor
- `dist-electron/Tender Flow Setup X.Y.Z.exe.blockmap` - Pro delta updates
- `dist-electron/latest.yml` - Metadata pro auto-updater

---

## 5. Build aplikace pro macOS

```bash
npm run desktop:build:mac
```

Výstup:

- `dist-electron/Tender Flow-X.Y.Z-arm64.dmg` - DMG instalátor pro Apple Silicon
- `dist-electron/Tender Flow-X.Y.Z-arm64-mac.zip` - ZIP archiv
- `dist-electron/latest-mac.yml` - Metadata pro auto-updater na macOS

> ⚠️ **Poznámka**: macOS build je možné vytvořit pouze na macOS systému.

---

## 6. Vytvoření Git tagu

```bash
# Nahraďte X.Y.Z vaší novou verzí
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin main
git push origin vX.Y.Z
```

---

## 7. Nahrání na GitHub Releases

### Automatický způsob (GitHub Actions)

Po pushnutí tagu se automaticky spustí GitHub Actions workflow:

- Buildne Windows verzi
- Vytvoří release
- Nahraje všechny soubory

### Ruční způsob

1. Přejděte na: https://github.com/Martin82K/Tender-Flow/releases/new
2. Vyberte tag (např. `vX.Y.Z`)
3. Vyplňte název: `Tender Flow vX.Y.Z`
4. Nahrajte všechny soubory z `dist-electron/`:

**Windows:**

- ✅ `Tender Flow Setup X.Y.Z.exe`
- ✅ `Tender Flow Setup X.Y.Z.exe.blockmap`
- ✅ `latest.yml`

**macOS:**

- ✅ `Tender Flow-X.Y.Z-arm64.dmg`
- ✅ `Tender Flow-X.Y.Z-arm64-mac.zip`
- ✅ `Tender Flow-X.Y.Z-arm64-mac.zip.blockmap`
- ✅ `latest-mac.yml`

> ⚠️ **DŮLEŽITÉ**: Soubory `latest.yml` a `latest-mac.yml` jsou nutné pro fungování auto-updateru!

---

## 8. Release Notes (šablona v češtině)

```markdown
## 🎉 Tender Flow vX.Y.Z

### ✨ Co je nového

- Nová funkce A
- Vylepšení B
- Přidána podpora pro C

### 🐛 Opravy chyb

- Opravena chyba při načítání dat
- Opraven problém s přihlášením
- Vyřešen pád aplikace při...

### 🔧 Technické změny

- Aktualizace závislostí
- Optimalizace výkonu
- Vylepšení stability

### 📦 Instalace

#### Windows

Stáhněte soubor `Tender Flow Setup X.Y.Z.exe` a spusťte instalaci.

#### macOS (Apple Silicon M1/M2/M3)

Stáhněte soubor `Tender Flow-X.Y.Z-arm64.dmg` a přetáhněte aplikaci do složky Aplikace.

---

**Automatické aktualizace**: Existující instalace budou automaticky notifikovány o nové verzi.
```

---

## Checklist

```markdown
- [ ] Všechny změny committnuté
- [ ] Verze bumpnutá (`npm run version:patch/minor/major`)
- [ ] Git tag vytvořen a pushnutý
- [ ] Windows build úspěšný
- [ ] macOS build úspěšný
- [ ] Všechny soubory nahrány na GitHub Release
- [ ] Release notes vyplněny v češtině
- [ ] Release publikován (ne jako draft)
```

---

## Troubleshooting

### Auto-updater nenajde aktualizaci

- Zkontrolujte, že `latest.yml` / `latest-mac.yml` jsou nahrány
- Ověřte formát tagu (`vX.Y.Z`)
- Release nesmí být ve stavu "draft"

### Build selhává

```bash
rm -rf node_modules dist dist-electron desktop/node_modules
npm install
npm run desktop:install
npm run desktop:build:win
```

### macOS build nefunguje na Windows

macOS buildy lze vytvořit pouze na macOS systému. Pro cross-platform buildy použijte GitHub Actions.
