# Tender Flow Desktop

Electron desktop aplikace pro Tender Flow CRM.

## Rychlý start

```bash
# Instalace závislostí
npm install

# Spuštění v dev módu (nejdříve spustit web dev server)
npm run dev &
npm run desktop:dev

# Build pro produkci
npm run desktop:build
```

## Struktura

```
desktop/
├── main/                    # Electron main process
│   ├── main.ts             # Entry point, vytváří BrowserWindow
│   ├── preload.ts          # Context bridge pro renderer
│   ├── types.ts            # TypeScript typy pro IPC
│   ├── ipc/
│   │   └── handlers.ts     # IPC handlery (fs, watcher, storage, python)
│   └── services/
│       ├── autoUpdater.ts     # Auto-update s electron-updater
│       ├── folderWatcher.ts   # Sledování změn složek
│       ├── secureStorage.ts   # Šifrované úložiště
│       └── pythonRunner.ts    # Spouštění Python skriptů
├── dist/                    # Kompilovaný JS (generováno)
├── electron-builder.yml     # Build konfigurace
├── entitlements.mac.plist   # macOS oprávnění
├── package.json             # CommonJS override
└── tsconfig.json            # TypeScript konfigurace
```

## Klíčové služby

### platformAdapter (services/platformAdapter.ts)
Jednotné API pro web i desktop:
- `fs` - souborové operace
- `watcher` - sledování složek
- `storage` - bezpečné úložiště
- `updater` - auto-update
- `dialog` - systémové dialogy

### fileSystemService (services/fileSystemService.ts)
Auto-switch mezi desktop fs a MCP bridge:
- `pickFolder()` - výběr složky
- `createFolder()` - vytvoření složky
- `openInExplorer()` - otevření v průzkumníku

### toolsAdapter (services/toolsAdapter.ts)
Excel/PDF nástroje:
- `mergeExcelSheets()` - sloučení listů
- `unlockExcel()` - odemčení ochrany

## Příkazy

| Příkaz | Popis |
|--------|-------|
| `npm run desktop:dev` | Spustí dev verzi |
| `npm run desktop:compile` | Kompiluje TypeScript |
| `npm run desktop:build` | Vytvoří produkční build |
| `npm run desktop:build:mac` | Build pro macOS |
| `npm run desktop:build:win` | Build pro Windows |

## Auto-update

Konfigurace pro GitHub Releases v `electron-builder.yml`:

```yaml
publish:
  provider: github
  owner: tenderflow
  repo: desktop
```

Pro publikování release:
```bash
GH_TOKEN=xxx npm run desktop:build
```

## Prerekvizity

- **Node.js** 18+
- **Python 3** (pro Excel nástroje)
- **openpyxl** (`pip3 install openpyxl`)

## Desktop vs Web

| Funkce | Desktop | Web |
|--------|---------|-----|
| Přístup k souborům | Nativní fs | MCP Bridge |
| Excel nástroje | Lokální Python | HTTP API |
| Úložiště tokenů | OS Keychain | localStorage |
| Auto-update | electron-updater | ❌ |
| Folder watcher | ✅ | ❌ |
