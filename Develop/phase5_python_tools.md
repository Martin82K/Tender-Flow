# Tender Flow Desktop – Phase 5: Python Tools

> Vytvořeno: 2026-01-10

## Přehled

Integrace lokálních Python nástrojů pro zpracování Excel/PDF souborů. Na desktopu běží přímo lokálně, na webu se volá existující server.

---

## Nové soubory

### desktop/main/services/pythonRunner.ts

Služba pro spouštění Python skriptů:

```typescript
const runner = getPythonRunner();

// Kontrola dostupnosti
const { available, version } = await runner.isPythonAvailable();

// Merge Excel listů
const result = await runner.mergeExcel('/path/to/input.xlsx');
```

**Funkce:**
- Automatická detekce Python v PATH
- Kontrola závislostí (openpyxl)
- Spouštění s timeoutem
- Error handling

### services/toolsAdapter.ts

Jednotné API pro nástroje:

```typescript
import { mergeExcelSheets, checkPythonStatus } from './toolsAdapter';

// Na desktopu: lokální Python
// Na webu: HTTP API na localhost:5001
const result = await mergeExcelSheets(inputFile);
```

---

## Nové IPC handlery

| Handler | Popis |
|---------|-------|
| `python:isAvailable` | Kontrola dostupnosti Python |
| `python:checkDependencies` | Kontrola nainstalovaných knihoven |
| `python:runTool` | Spuštění libovolného nástroje |
| `python:mergeExcel` | Sloučení Excel listů |

---

## Jak to funguje

```
Desktop Mode:
  inputFile.xlsx → pythonRunner → merge_final.py → output.xlsx

Web Mode:
  inputFile.xlsx → HTTP POST → Flask API → output.xlsx
```

---

## Podporované nástroje

1. **excel-merge** - sloučení listů do jednoho
2. **excel-unlock** - odemčení chráněných souborů (TODO)

---

## Prerekvizity pro desktop

```bash
# Python 3 musí být nainstalován
python3 --version

# Knihovna openpyxl
pip3 install openpyxl
```

---

## Status

✅ Desktop compilation – úspěšná  
✅ Web build – úspěšný
