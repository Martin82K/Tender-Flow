# Tender Flow Desktop – Phase 6: Excel Merger Pro Integration

> Vytvořeno: 2026-01-10

## Přehled

Integrace Excel Merger Pro jako nativního nástroje. Nyní funguje přímo v prohlížeči bez potřeby externího serveru.

**Zdroj:** https://github.com/Martin82K/ExcelMerger-Pro

---

## Nové soubory

### services/excelMergerService.ts

Hlavní služba s `ExcelService` třídou:

```typescript
import { ExcelService } from './excelMergerService';

// Analyzovat soubor - získá názvy listů
const sheets = await ExcelService.analyzeFile(file);

// Sloučit listy do jednoho
const blob = await ExcelService.mergeSheets(
  file,
  sheets,
  onProgress,
  onProgressUpdate,
  headerMapping,
  applyFilter,
  freezeHeader,
  showGridlines
);
```

### services/excelMergerTypes.ts

Typy pro Excel merger:
- `ExcelSheetInfo` - info o listu
- `ProcessingStatus` - stav zpracování
- `HeaderMapping` - mapování hlavičky
- `MergeOptions` - volby sloučení

---

## Jak používat

### Přes toolsAdapter (doporučeno)

```typescript
import { mergeExcelSheets } from './services/toolsAdapter';

const result = await mergeExcelSheets(file, {
  sheetsToInclude: ['List1', 'List2'],
  applyFilter: true,
  freezeHeader: true,
  onProgress: (msg) => console.log(msg),
});

if (result.success && result.outputBlob) {
  // Stáhnout výsledek
  const url = URL.createObjectURL(result.outputBlob);
  // ...
}
```

---

## Funkce

1. **Sloučení listů** – všechny vybrané listy do jednoho
2. **Zachování formátování** – barvy, fonty, ohraničení
3. **Transformace formulí** – přepočet referencí
4. **Autofiltr** – volitelně přidá filtry
5. **Zmrazení hlavičky** – freeze panes
6. **Separátory listů** – barevné oddělení

---

## Rozdíl oproti iframe řešení

| Aspekt | Iframe (Railway) | Nativní |
|--------|------------------|---------|
| Latence | HTTP request | Okamžité |
| Závislost | Vyžaduje internet | Offline |
| Hosting | Railway náklady | Zdarma |
| Kontrola | Omezená | Plná |

---

## Status

✅ Build úspěšný  
✅ Nativní implementace funkční
