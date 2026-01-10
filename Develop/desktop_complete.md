# Tender Flow Desktop – Kompletní implementace

> Finální shrnutí: 2026-01-10

## Status

✅ **Electron desktop aplikace je kompletně implementována a připravena k použití.**

---

## Vytvořené soubory

### Core Desktop (desktop/)
| Soubor | Popis |
|--------|-------|
| `main/main.ts` | Electron entry, BrowserWindow, auto-updater init |
| `main/preload.ts` | Context bridge s `window.electronAPI` |
| `main/types.ts` | TypeScript typy pro IPC |
| `main/ipc/handlers.ts` | Všechny IPC handlery |
| `main/services/autoUpdater.ts` | Auto-update lifecycle |
| `main/services/folderWatcher.ts` | Folder watcher se snapshot modelem |
| `main/services/secureStorage.ts` | Šifrované úložiště (OS keychain) |
| `main/services/pythonRunner.ts` | Spouštění Python nástrojů |
| `electron-builder.yml` | Build konfigurace + GitHub publish |
| `README.md` | Dokumentace desktop složky |

### Platform Layer (services/)
| Soubor | Popis |
|--------|-------|
| `platformAdapter.ts` | Jednotné API web/desktop |
| `fileSystemService.ts` | Auto-switch MCP/native fs |
| `toolsAdapter.ts` | Excel/PDF nástroje |

### Desktop UI (components/desktop/)
| Soubor | Popis |
|--------|-------|
| `DesktopWelcome.tsx` | Uvítací obrazovka |
| `UpdateBanner.tsx` | Notifikace o aktualizacích |
| `FileSystemIndicator.tsx` | Indikátor připojení |

### Hooks
| Soubor | Popis |
|--------|-------|
| `useDesktop.ts` | Desktop state management |
| `useDesktopConnection.ts` | Fs status a watcher |

### Dokumentace (Develop/)
- `first_build.md` - Základní setup
- `phase2_ui_integration.md` - UI integrace
- `phase3_auto_update.md` - Auto-update systém
- `phase4_dochub_integration.md` - DocHub integrace
- `phase5_python_tools.md` - Python nástroje

---

## Příkazy

```bash
# Dev mode (vyžaduje běžící npm run dev)
npm run desktop:dev

# Produkční build
npm run desktop:build

# Pouze macOS
npm run desktop:build:mac

# Pouze Windows
npm run desktop:build:win
```

---

## Architektura

```
┌─────────────────────────────────────────────────────────┐
│                    Electron App                          │
├─────────────────────────────────────────────────────────┤
│  Main Process                                            │
│  ├── main.ts (window management, lifecycle)             │
│  ├── AutoUpdaterService (electron-updater)              │
│  ├── FolderWatcherService (chokidar-like)               │
│  ├── SecureStorageService (safeStorage)                 │
│  └── PythonRunnerService (child_process)                │
├─────────────────────────────────────────────────────────┤
│  Preload (IPC Bridge)                                    │
│  └── preload.ts → window.electronAPI                     │
├─────────────────────────────────────────────────────────┤
│  Renderer (React App)                                    │
│  ├── platformAdapter.ts (API abstraction)               │
│  ├── useDesktop.ts (state hook)                         │
│  └── DesktopWelcome, UpdateBanner, etc.                 │
└─────────────────────────────────────────────────────────┘
```

---

## Co dělá desktop verze navíc oproti webu

1. **Přímý přístup k souborům** – bez MCP serveru
2. **Folder watcher** – real-time sledování změn
3. **Lokální Python** – zpracování Excel/PDF na počítači
4. **Auto-update** – automatické aktualizace z GitHub
5. **Secure storage** – tokeny v OS keychain

---

## Další kroky (budoucí)

- [ ] Podepisování aplikace pro produkci
- [ ] Testování na Windows
- [ ] Integrace electron-log pro logování
- [ ] Implementace více Python nástrojů
- [ ] Tray icon pro běh na pozadí
