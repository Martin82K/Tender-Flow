# Tender Flow – Electron Desktop App (First Build)

> Vytvořeno: 2026-01-10

---

## Vytvořené soubory

### Desktop Core (`desktop/`)
| Soubor | Popis |
|--------|-------|
| `main/main.ts` | Electron main process, vytváří BrowserWindow, registruje IPC handlery |
| `main/preload.ts` | Bridge mezi main a renderer, exponuje `window.electronAPI` |
| `main/types.ts` | TypeScript typy pro IPC API |
| `main/ipc/handlers.ts` | IPC handlery pro fs, watcher, storage, dialogy |
| `main/services/folderWatcher.ts` | Sledování složek se snapshot modelem |
| `main/services/secureStorage.ts` | Šifrované úložiště tokenů |
| `electron-builder.yml` | Build konfigurace pro macOS/Windows/Linux |
| `entitlements.mac.plist` | macOS oprávnění pro hardened runtime |
| `package.json` | CommonJS override pro Electron |
| `tsconfig.json` | TypeScript konfigurace pro main process |

### Platform Adapter
| Soubor | Popis |
|--------|-------|
| `services/platformAdapter.ts` | Jednotné API pro web vs desktop |

### Desktop UI
| Soubor | Popis |
|--------|-------|
| `components/desktop/DesktopWelcome.tsx` | Uvítací obrazovka s "Co je nového" |
| `components/desktop/index.ts` | Export desktop komponent |

---

## Příkazy

```bash
# Spustit desktop v dev módu (nejdříve spustit npm run dev)
npm run desktop:dev

# Build pro macOS
npm run desktop:build:mac

# Build pro Windows  
npm run desktop:build:win

# Pouze kompilace TypeScriptu
npm run desktop:compile
```

---

## Klíčové funkce

1. **Přímý přístup k filesystemu** – bez nutnosti MCP serveru
2. **Folder watcher** – sledování změn v synchronizovaných složkách
3. **Snapshot model** – detekce nových/změněných/smazaných souborů
4. **Secure storage** – tokeny šifrované OS-level úložištěm
5. **Platform adapter** – jednotné API pro web i desktop

---

## Další kroky

- [ ] Integrace DesktopWelcome do App.tsx
- [ ] Implementace auto-update (electron-updater)
- [ ] Podepisování aplikace pro produkci
- [ ] Testování na Windows
