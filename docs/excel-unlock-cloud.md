# Excel Unlock v cloudu (tenderflow.cz + Netlify)

Frontend na Netlify je statický – pro odemykání Excelu potřebujete backend. Doporučený setup:

1) Python `openpyxl` backend běží jako samostatná služba (Render/Fly/Cloud Run).
2) Netlify udělá **rewrite** z `/api/unlock` na tento backend, aby nebyl problém s CORS.
3) Frontend volá `/api/unlock` (v dev režimu fallback na `http://localhost:5000/unlock`).

## 1) Deploy Python backend

Kód backendu je v `server_py/excel_unlock_api/app.py`.

Minimální kroky (Render/Fly/Cloud Run):
- Service typu “web” (HTTP).
- Spouštěcí příkaz: `python app.py`
- Port: `EXCEL_UNLOCK_PORT` (default 5000) – platforma často nastaví `PORT`, podle platformy případně upravte env var nebo kód.

Zdravotní endpoint:
- `GET /health`

## 2) Netlify proxy (rewrite)

V `netlify.toml` je připravené:

- `from = "/api/unlock"`
- `to = "https://YOUR-EXCEL-UNLOCK-BACKEND/unlock"`

Nastavte `to` na reálnou URL vašeho backendu (např. Render URL).

## 3) Frontend konfigurace

Frontend v `Nastavení → Nástroje → Odemčení excelu` volá:
- na produkci `/api/unlock`
- lokálně `http://localhost:5000/unlock`

Pokud chcete přepsat endpoint ručně, použijte:
- `VITE_EXCEL_UNLOCK_API`

