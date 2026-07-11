# Electron desktop

## Procesní model

```text
Renderer (React)
  -> window.electronAPI
     -> preload (contextBridge)
        -> IPC kanál
           -> main handler
              -> main service / OS / síť
```

Renderer není důvěryhodný proces. Main proces nesmí věřit cestě, URL, tokenu ani
payloadu jen proto, že přišel z aplikace.

## Vstupní body

- `desktop/main/main.ts` – lifecycle aplikace a BrowserWindow.
- `desktop/main/preload.ts` – omezené API vystavené přes context bridge.
- `desktop/main/ipc/contracts.ts` – IPC kontrakty.
- `desktop/main/ipc/handlers.ts` a `ipc/modules/` – registrace handlerů.
- `desktop/main/types.ts` a `shared/types/desktop` – sdílené serializovatelné typy.

## Bezpečnost BrowserWindow

Produkční okno používá:

- `contextIsolation: true`,
- `nodeIntegration: false`,
- `sandbox: true`,
- `webSecurity: true`.

Navigace, nová okna a externí URL se filtrují přes window security a external
URL policy. Produkční CSP nepovoluje eval; vývojová CSP má výjimky pouze pro
Vite/HMR na lokálních hostech.

## IPC moduly

| Modul | Odpovědnost |
| --- | --- |
| `sessionHandlers` | session, biometrika a secure credentials |
| `publicAuthHandlers` | omezený veřejný auth/deep-link tok |
| `fsHandlers` | výběr, čtení, zápis a otevírání souborů |
| `backupHandlers` | lokální zálohy a nastavení |
| `netHandlers` | řízené síťové requesty z desktopu |
| `oauthHandlers` | externí OAuth toky |
| `notificationHandlers` | nativní notifikace |
| `watcherHandlers` | hlídání složek |
| `mcpHandlers` | MCP lifecycle a konfigurace |
| `bidComparisonHandlers` | bid comparison engine/agent |
| `docxConversion` | lokální konverze dokumentů |

Handler musí validovat typy, oprávnění, velikost vstupu a cestu. Renderer používá
pouze API z preloadu; přímý import Electron main modulu je zakázaný.

## Platformní adaptér

Legacy implementace je v `services/platformAdapter.ts`; kanonický infra export
je `infra/platform/platformAdapter.ts`. Webové fallbacky vracejí bezpečný
„unavailable“ výsledek nebo explicitní chybu. Desktop-specific chování musí být
guardované `useDesktop()` nebo platformním příznakem.

## Lokální soubory

Desktop podporuje:

- výběr složky/souboru,
- omezené čtení a zápis,
- otevření/reveal v systému,
- DocHub lokální strukturu,
- watcher,
- zálohy,
- Excel tools a lokální pomocné procesy.

Cesty se normalizují a kontrolují proti povolenému scope. Renderer nemá obecný
Node filesystem přístup.

## Session a secure storage

Citlivé credentials ukládá main proces prostřednictvím secure storage.
Biometrika je dostupná podle OS a konfigurace. Renderer předává main procesu
minimální session snapshot jen přes auth IPC; tokeny se nesmějí logovat.

## Deep links a password reset

Desktop zpracovává veřejné auth/deep-link události odděleně od běžných
autorizovaných IPC operací. Reset hesla používá jednorázový serverový tok a
následnou app route; deep link nesmí sám udělit datové oprávnění.

## Auto update

Updater používá GitHub publish konfiguraci z `electron-builder.yml`. Release
artefakty se vždy sestavují lokálně a do GitHub Release se nahrávají pouze
ověřené soubory z `dist-electron/`. CI může artefakty sestavit pro validaci, ale
nesmí přepsat release assets.

## Build a balení

```bash
npm run desktop:compile
npm run desktop:dev
npm run desktop:build
npm run desktop:build:mac
npm run desktop:build:win
```

`desktop:compile` instaluje připnuté desktop dependencies, kompiluje TypeScript
a generuje veřejné build env. `desktop:build` nejprve vytvoří webový produkční
bundle a potom balí Electron přes electron-builder.

Výstup:

- `desktop/dist/` – generovaný main/preload JavaScript,
- `dist-electron/` – instalační/release artefakty.

Generované výstupy se neupravují ručně.
