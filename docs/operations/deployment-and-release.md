# Deployment a release

## Webový build

```bash
npm run build
```

Příkaz vytvoří Vite bundle a prerenderuje veřejné právní stránky. Výstup je
`dist/`. Ověření lokálních assetů:

```bash
npm run build:local-assets
npm run verify:web-dist
```

Vercel používá standardní webový build a vytváří preview pro PR.

Webové delivery konfigurace (`vercel.json`, `public/_headers`, `app.yaml` a
Node middleware) musí držet stejnou `Content-Security-Policy-Report-Only`.
Po deployi se na HTML odpovědi kontroluje přítomnost vynuceného
`frame-ancestors` i report-only politiky. Pilot nemá centrální report endpoint;
legitimní CSP porušení se zachycují při smoke testu v konzoli a před vynucením
se řeší po jednotlivých origin/feature tocích.

## Node/static server

```bash
npm run start
```

Spouští `server.js`. Nasazení musí dodat odpovídající veřejné hodnoty a případné
serverové secrets podle zapnutých endpointů.

## Supabase

### Migrace

- Nová změna schématu má vlastní pojmenovanou migraci.
- Pořadí migrací je součást kontraktu.
- Před deployem se kontrolují grants, RLS, functions a závislosti na pozdějších
  hotfix migracích.

### Edge Functions

Cloud deploy preferuje API režim, například:

```bash
npx supabase functions deploy <name> --use-api
```

`verify_jwt` se drží ve `config.toml` konkrétní funkce. Docker warning není chyba
aplikace, pokud úloha nepoužívá lokální Supabase stack.

## Desktop build

```bash
npm run desktop:build:mac
npm run desktop:build:win
```

`electron-builder.yml` definuje app ID, platformní cíle, ikony, ASAR, updater a
publikaci na GitHub. macOS cíl obsahuje DMG a ZIP pro arm64; Windows NSIS pro x64.

## Release pravidlo

Desktop release artefakty se vždy nahrávají z lokálně sestaveného a ověřeného
`dist-electron/`. GitHub Actions nesmí připojit ani přepsat soubory v GitHub
Release. CI artefakty slouží pouze k validaci nebo internímu stažení.

Ověření:

```bash
npm run release:prepare
npm run release:verify-artifacts
```

Typické artefakty:

- Windows `.exe`, blockmap a latest YAML,
- macOS `.dmg`, `.zip`, blockmap a latest YAML.

## Versioning

1. Změnit verzi přes `version:patch|minor|major`.
2. Zkontrolovat synchronizované verze.
3. Spustit úplné testy a buildy.
4. Lokálně sestavit platformní artefakty.
5. Ověřit jejich názvy, velikost a spustitelnost.
6. Vytvořit tag/release podle release workflow.
7. Nahrát pouze ověřené lokální artefakty.

## CI Quality Checks

PR a push do `main/master` spouští:

- `npm ci`,
- root dependency audit pro high/critical zranitelnosti,
- ověření registry podpisů root závislostí,
- kompletní Vitest,
- TypeScript,
- dokumentační odkazy,
- import boundaries,
- legacy freeze,
- web smoke build,
- fail-fast instalaci desktop závislostí z commitnutého lockfile přes `npm ci`,
- desktop smoke compile,
- desktop dependency audit pro high/critical zranitelnosti,
- ověření registry podpisů desktop závislostí.

Auditní kroky jsou fail-closed. Nedostupnost npm registry, neplatný podpis nebo
high/critical advisory proto workflow zastaví; nepřidává se
`continue-on-error`. Desktop dependency strom se před kompilací instaluje přes
`npm ci --prefix desktop --ignore-scripts`, aby neshoda mezi
`desktop/package.json` a commitnutým `desktop/package-lock.json` selhala dříve,
než ji může lokální `desktop:install` dorovnat. Podpisy se ověřují až po desktop
compile nad tímto nainstalovaným stromem.

Před merge se kontroluje celý log a thread-aware review, ne pouze zelená ikona.

## Rollback

- Web: vrátit poslední známý dobrý deployment/commit.
- Desktop: nepublikovat vadný updater; podle potřeby vydat vyšší opravnou verzi.
- Edge Function: redeploy předchozí známou verzi bez změny databáze.
- DB: preferovat dopřednou opravnou migraci; destruktivní ruční rollback jen s
  ověřenou zálohou a explicitním provozním rozhodnutím.
