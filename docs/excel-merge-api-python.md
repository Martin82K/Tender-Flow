# Excel Merge API (Python, openpyxl)

Backend pro `ExcelMerger Pro`, který sloučí listy z jednoho Excel souboru do jednoho listu `Kombinovane` se zachováním formátování.

## Spuštění lokálně

```bash
cd server_py/excel_unlock_api
pip install -r requirements.txt
python app.py
```

Server poběží na `http://localhost:5000`.

## API

### `GET /health`

Vrací `{"ok": true}`.

### `POST /merge`

- `multipart/form-data`
- pole: `file` (`.xlsx` nebo `.xlsm`)
- odpověď: `.xlsx` soubor `*_combined_final.xlsx`

Funkce:
- list `Kombinovane`
- hlavička (11 sloupců) + modré oddělovače `=== NázevListu ===`
- sloupec A = název zdrojového listu
- přeskočí listy `Rekapitulace stavby`, `Pokyny pro vyplnění` + hidden/veryHidden
- nastaví autofilter na celý rozsah

Příklad:

```bash
curl -F "file=@./vstup.xlsx" http://localhost:5000/merge --output vystup_combined_final.xlsx
```

## Konfigurace frontendu (Vite)

Do `.env` dej:

```bash
VITE_EXCEL_MERGE_API=http://localhost:5000/merge
```

Pak restartuj `npm run dev`, aby se env propsaly.

