# Tender Flow MCP Bridge Server

Aplikace pro automatické vytváření složek DocHub na vašem lokálním disku.

## Pro Windows uživatele

### Instalace

1. Stáhněte `tender-flow-mcp-bridge-win-x64.exe`
2. Umístěte soubor kamkoli (např. do `C:\Programy\TenderFlow\`)
3. **Žádná instalace není potřeba** - program je přenositelný

### Spuštění

1. Dvojklikem spusťte `tender-flow-mcp-bridge-win-x64.exe`
2. Pokud Windows zobrazí varování "Windows protected your PC":
   - Klikněte na **"More info"**
   - Klikněte na **"Run anyway"**
3. Nechte okno terminálu otevřené

### Použití v Tender Flow

1. Otevřete Tender Flow v prohlížeči
2. Přejděte do projektu → **Dokumenty** → **DocHub**
3. Vyberte **"MCP Bridge"** jako provider
4. Zadejte cestu k projektové složce (např. `C:\Dokumenty\Projekty\Stavba`)
5. Klikněte **"Připojit přes MCP"**
6. Klikněte **"Synchronizovat"** pro vytvoření složek

---

## Pro macOS uživatele

### Rychlý start (Doporučeno)

Nejjednodušší způsob, jak spustit server bez problémů s bezpečnostním upozorněním (nepodepsaný vývojář):

1. Jděte do hlavní složky projektu (`/Users/martin/TenderFlow/Tender-Flow`)
2. Dvojklikem spusťte soubor **`run-bridge.command`**
3. Otevře se terminál a server se spustí. Nechte okno otevřené.

Alternativně přes terminál:
```bash
npm run mcp
```

### Klasická instalace (Binárka)
*Tato metoda může vyžadovat povolení v nastavení zabezpečení (System Preferences -> Security & Privacy).*

1. Stáhněte příslušný soubor:
   - **Apple Silicon** (M1/M2/M3): `tender-flow-mcp-bridge-macos-arm64`
   - **Intel Mac**: `tender-flow-mcp-bridge-macos-x64`
2. Přesuňte soubor do složky (např. `/Applications/` nebo `~/Apps/`)
3. Spusťte:
   ```bash
   chmod +x tender-flow-mcp-bridge-macos-arm64
   ./tender-flow-mcp-bridge-macos-arm64
   ```
4. Pokud macOS blokuje spuštění, musíte aplikaci povolit v "Security & Privacy".

### Použití v Tender Flow

1. Otevřete Tender Flow v prohlížeči
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
