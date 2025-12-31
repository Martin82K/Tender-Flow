# Excel Merge backend (Node.js + TypeScript)

Netlify nasazuje frontend jako statický web. Pro zachování Excel formátování při merge je potřeba serverová část (Node.js) běžící mimo Netlify (nebo jako vlastní služba).

## Lokální vývoj

```bash
cd server/excel_tools_api
npm install
npm run dev
```

- API: `http://localhost:5001`
- Health: `GET /health`
- Merge: `POST /merge` (multipart `file`)

Frontend (Vite na `:3000`) volá `POST /api/merge`, které se lokálně proxyuje do `:5001/merge` (`vite.config.ts`).

## Produkce (Netlify)

Na produkci jsou 2 možnosti:

### Varianta A: Netlify proxy redirect (doporučené)

1) Nasaďte backend (např. Render / Railway / Fly.io / Cloud Run) a získejte URL, např.:
`https://excel-merge.yourdomain.com`

2) V `netlify.toml` nastavte:

- `to = "https://excel-merge.yourdomain.com/merge"` pro `/api/merge`
- `to = "https://excel-merge.yourdomain.com/:splat"` pro `/api/excel-tools/*`

3) Frontend bude volat:
- `POST /api/merge`
- `GET /api/excel-tools/health`

### Varianta B: Přímý endpoint přes env

Nastavte v Netlify environment variables:

- `VITE_EXCEL_MERGE_API=https://excel-merge.yourdomain.com/merge`

Pak frontend volá backend přímo (musí být povolený CORS).

## Poznámky

- `exceljs` umí zachovat hodně stylů, ale Excel je široký ekosystém (theme/conditional formatting apod.). Pokud narazíte na konkrétní prvek, který se nepřenese, pošlete vzorový soubor a doladíme.

