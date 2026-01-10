# Tender Flow Desktop – Phase 3: Auto-Update System

> Vytvořeno: 2026-01-10

## Přehled

Implementace kompletního auto-update systému pomocí `electron-updater` s GitHub Releases jako backendem.

---

## Nové soubory

### desktop/main/services/autoUpdater.ts

Hlavní update služba v main procesu:

```typescript
// Klíčové funkce
checkForUpdates()  // Kontrola nových verzí
downloadUpdate()   // Stažení aktualizace
quitAndInstall()   // Instalace a restart

// IPC handlery (automaticky registrované)
'updater:checkForUpdates'
'updater:downloadUpdate'  
'updater:quitAndInstall'
'updater:getStatus'
'updater:statusChanged' (event)
```

---

## Změny v souborech

### desktop/main/types.ts
Přidáno:
- `UpdaterAPI` interface
- `UpdateStatus` interface s progress info

### desktop/main/preload.ts  
Přidáno:
- `updater` objekt s IPC bindingem
- `onStatusChange` listener pro real-time status

### desktop/main/main.ts
Přidáno:
- Import `getAutoUpdaterService`
- Inicializace po vytvoření okna
- Auto-check 5s po startu (pouze v produkci)

### services/platformAdapter.ts
Přidáno:
- `UpdateStatusInfo` interface
- `updaterAdapter` s všemi metodami
- Export v `platformAdapter`

### desktop/electron-builder.yml
Přidáno:
```yaml
publish:
  provider: github
  owner: tenderflow
  repo: desktop
  releaseType: release
```

---

## Jak to funguje

1. **Start aplikace** → `AutoUpdaterService` se inicializuje
2. **5s po startu** → automatická kontrola aktualizací
3. **Nová verze nalezena** → `UpdateBanner` se zobrazí
4. **Uživatel klikne "Aktualizovat"** → stažení a instalace

---

## Update Flow

```
App Start
   ↓
AutoUpdater.checkForUpdates()
   ↓
[checking] → [available] → [downloading] → [downloaded]
   ↓              ↓
[not-available]  UpdateBanner shows
                  ↓
           User clicks "Install"
                  ↓
           quitAndInstall()
```

---

## Konfigurace GitHub Releases

Pro publikování releases:

1. Vytvořit GitHub repo `tenderflow/desktop`
2. Nastavit `GH_TOKEN` environment proměnnou
3. Spustit `npm run desktop:build`
4. electron-builder vytvoří a uploadne release

---

## Status

✅ Desktop compilation – úspěšná  
✅ Web build – úspěšný  
✅ Auto-update ready – připraveno pro GitHub Releases
