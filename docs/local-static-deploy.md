# Lokální statický build a upload

Tender Flow web se má pro statický hosting sestavit lokálně a potom se má nahrát hotový obsah adresáře `dist/`.
Hosting nemá znovu spouštět build, protože v jeho prostředí nemusí být dostupné stejné veřejné proměnné nebo návazné služby.

## Lokální postup

1. Zkontroluj lokální veřejné proměnné v `.env.local`.
2. Spusť:

   ```bash
   npm run build:local-assets
   ```

3. Nahraj celý obsah adresáře `dist/` na hosting jako finální statický artifact.

Výstup `dist/` obsahuje SPA `index.html`, buildnuté assety v `dist/assets/` a prerenderované veřejné stránky:

- `dist/terms/index.html`
- `dist/privacy/index.html`
- `dist/cookies/index.html`
- `dist/dpa/index.html`
- `dist/imprint/index.html`

## Vercel

Pro Vercel použij prebuilt deployment flow, aby Vercel nepouštěl vlastní build:

```bash
npm run build:local-assets
vercel deploy --prebuilt --prod
```

V nastavení projektu nenechávej produkční deployment spoléhat na cloudový build, pokud má být zdrojem pravdy lokální artifact.

## Ověření artifactu

Samostatné ověření existujícího `dist/`:

```bash
npm run verify:web-dist
```

Kontrola je offline. Ověřuje povinné soubory, assety, SPA fallback a běžné chyby typu zapečený service role marker nebo privátní klíč ve výstupu.

## Poznámky k API a databázi

Build nesmí vyžadovat připojení k Supabase, aplikačnímu API ani databázi. Veřejné hodnoty `VITE_*` se používají jen jako konfigurační hodnoty zabalené do klientského buildu. Skutečné tajné hodnoty, service role klíče a serverové API klíče do webového buildu nepatří.
