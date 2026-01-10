# Tender Flow Desktop – Phase 4: DocHub Integration

> Vytvořeno: 2026-01-10

## Přehled

Integrace desktop file systému s existujícími DocHub operacemi. Vytvořen jednotný service, který automaticky přepíná mezi:
- **Desktop**: Native Electron fs
- **Web**: MCP Bridge Server

---

## Nové soubory

### services/fileSystemService.ts

Jednotné API pro souborové operace:

```typescript
import { checkFileSystemStatus, pickFolder, folderExists, 
         createFolder, deleteFolder, openPath, openInExplorer,
         startWatching, stopWatching } from '../services/fileSystemService';

// Zjistit stav připojení
const status = await checkFileSystemStatus();
// { available: true, mode: 'desktop' | 'mcp' | 'none' }

// Vybrat složku
const folder = await pickFolder();

// Otevřít v průzkumníku
await openInExplorer('/path/to/folder');
```

### hooks/useDesktopConnection.ts

Hook pro správu připojení:

```typescript
const { fsStatus, isWatching, startWatching, stopWatching } = useDesktopConnection();
```

### components/desktop/FileSystemIndicator.tsx

Vizuální indikátor stavu:
- 🟢 Desktop - přímý přístup
- 🔵 MCP - bridge server
- ⚪ Nepřipojeno

---

## Nové IPC handlery

Přidáno do `handlers.ts`:

| Handler | Popis |
|---------|-------|
| `fs:createFolder` | Vytvoření složky (recursive) |
| `fs:deleteFolder` | Smazání složky (recursive) |
| `fs:folderExists` | Kontrola existence složky |

---

## Jak používat

### Na webu

Pokud MCP Bridge běží → funkce fungují normálně

### Na desktopu

Automaticky se použije nativní fs, MCP není potřeba

### V komponentách

```tsx
import { FileSystemIndicator } from './components/desktop';

// V UI:
<FileSystemIndicator showLabel />
```

---

## Status

✅ Desktop compilation – úspěšná  
✅ Web build – úspěšný
