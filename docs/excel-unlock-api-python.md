# Excel Unlock API (Python, openpyxl)

Tento backend odemyká Excel soubory spolehlivě pomocí `openpyxl` a vrací nový soubor ke stažení. Frontend v `Nastavení → ExcelUnlocker Pro → Odemčení excelu` volá defaultně `http://localhost:5000/unlock`.

## Spuštění

1) Přejděte do složky:

`cd server_py/excel_unlock_api`

2) Nainstalujte závislosti:

`pip install -r requirements.txt`

3) Spusťte server:

`python app.py`

Server poběží na `http://localhost:5000`.

## API

### `POST /unlock`

- `multipart/form-data`
- pole: `file` (`.xlsx` nebo `.xlsm`)
- odpověď: `.xlsm` soubor `*-odemceno.xlsm`

Příklad (curl):

`curl -F "file=@./input.xlsx" http://localhost:5000/unlock --output odemceno.xlsm`

## Konfigurace frontendu

V prohlížeči lze přesměrovat endpoint přes env:

- `VITE_EXCEL_UNLOCK_API=http://localhost:5000/unlock`
