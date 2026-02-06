# Excel Tools API (Node.js + TypeScript)

Lokální API pro Excel nástroje v TS/Node.js.

## Spuštění

```bash
cd server/excel_tools_api
npm install
npm run dev
```

Server běží na `http://localhost:5001`.

## Endpoints

- `GET /health`
- `POST /merge` (`multipart/form-data`, pole `file` = `.xlsx`)
  - vrací `*_combined_final.xlsx`
  - vytvoří list `Kombinovane` s hlavičkou + oddělovači
  - přeskočí listy `Rekapitulace stavby`, `Pokyny pro vyplnění` + hidden/veryHidden

## CLI

Po buildu:

```bash
node dist/cli.js vstup.xlsx
node dist/cli.js vstup.xlsx vystup.xlsx
```

Nebo (po `npm install -g` v tomhle balíčku):

```bash
excel-merge-ts vstup.xlsx
```

## Poznámka k formátování

Používá `exceljs` a zachovává většinu běžných stylů (fill/font/border/alignment/numFmt, row height, col width, merges),
ale Excel je komplexní – pokud narazíte na typ stylu, který se nepřenese, pošlete vzorový soubor a doladíme kopírování.
