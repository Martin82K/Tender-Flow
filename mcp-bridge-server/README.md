# CRM MCP Bridge Server

Aplikace pro automatické vytváření složek DocHub na vašem lokálním disku.

## Pro Windows uživatele

### Instalace

1. Stáhněte `crm-mcp-bridge-win-x64.exe`
2. Umístěte soubor kamkoli (např. do `C:\Programy\CRM\`)
3. **Žádná instalace není potřeba** - program je přenositelný

### Spuštění

1. Dvojklikem spusťte `crm-mcp-bridge-win-x64.exe`
2. Pokud Windows zobrazí varování "Windows protected your PC":
   - Klikněte na **"More info"**
   - Klikněte na **"Run anyway"**
3. Nechte okno terminálu otevřené

### Použití v CRM

1. Otevřete CRM aplikaci v prohlížeči
2. Přejděte do projektu → **Dokumenty** → **DocHub**
3. Vyberte **"MCP Bridge"** jako provider
4. Zadejte cestu k projektové složce (např. `C:\Dokumenty\Projekty\Stavba`)
5. Klikněte **"Připojit přes MCP"**
6. Klikněte **"Synchronizovat"** pro vytvoření složek

---

## Pro macOS uživatele

### Instalace

1. Stáhněte příslušný soubor:
   - **Apple Silicon** (M1/M2/M3): `crm-mcp-bridge-macos-arm64`
   - **Intel Mac**: `crm-mcp-bridge-macos-x64`
2. Přesuňte soubor do složky (např. `/Applications/` nebo `~/Apps/`)

### První spuštění

1. Otevřete **Terminál** (Finder → Aplikace → Utility → Terminal)
2. Přejděte do složky s aplikací:
   ```bash
   cd /cesta/ke/složce
   ```
3. Přidejte oprávnění ke spuštění:
   ```bash
   chmod +x crm-mcp-bridge-macos-arm64
   ```
4. Spusťte aplikaci:
   ```bash
   ./crm-mcp-bridge-macos-arm64
   ```

> **Poznámka:** Pokud macOS zobrazí "cannot be opened because the developer cannot be verified":
>
> - Přejděte do **System Preferences** → **Security & Privacy**
> - Klikněte na **"Open Anyway"**

### Použití v CRM

1. Otevřete CRM aplikaci v prohlížeči
2. Přejděte do projektu → **Dokumenty** → **DocHub**
3. Vyberte **"MCP Bridge"** jako provider
4. Zadejte cestu k projektové složce (např. `/Users/jmeno/Documents/Projekty/Stavba`)
5. Klikněte **"Připojit přes MCP"**
6. Klikněte **"Synchronizovat"** pro vytvoření složek

---

## Často kladené otázky

**Potřebuji administrátorská práva?**
Ne. Program běží jako běžný uživatel a složky vytváří pouze ve vašem domovském adresáři.

**Musím mít program stále spuštěný?**
Ano, MCP Bridge musí běžet, když chcete synchronizovat složky v DocHub.

**Jak ověřím, že server běží?**
Otevřete v prohlížeči: `http://localhost:3847/health`
Měli byste vidět: `{"status":"ok"}`

**Program nefunguje, co mám dělat?**

1. Zkontrolujte, že je program spuštěný
2. Zkontrolujte, že nic jiného neblokuje port 3847
3. Zkontrolujte, že firewall neblokuje localhost
