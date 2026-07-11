# Konfigurace a proměnné prostředí

## Pravidla

- lokální secrets patří do `.env.local`,
- veřejná proměnná s prefixem `VITE_` je součástí klientského bundle,
- serverové secrets nemají prefix `VITE_`,
- hodnoty se dokumentují názvem a účelem, nikdy skutečným secret obsahem,
- Electron dostává pouze explicitně povolené veřejné build hodnoty.

## Povinné veřejné hodnoty

| Proměnná | Runtime | Účel |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | web/renderer | URL Supabase projektu |
| `VITE_SUPABASE_ANON_KEY` | web/renderer | veřejný anon/publishable klíč |

Bez těchto hodnot aplikace zobrazí konfigurační varování a datové/auth funkce
nebudou fungovat.

## Volitelné veřejné hodnoty

| Proměnná | Účel |
| --- | --- |
| `VITE_APP_VERSION` | veřejná verze buildu; běžně synchronizovaná skriptem |
| `VITE_BILLING_PROVIDER` | volba billing provideru |
| `VITE_EXCEL_TOOLS_PROVIDER` | `http` nebo nativní/provider strategie |
| `VITE_EXCEL_TOOLS_URL` | endpoint Excel tools služby |
| `VITE_EXCEL_MERGER_MIRROR_URL` | alternativní endpoint/mirror |
| `VITE_GOOGLE_OAUTH_CLIENT_ID_DESKTOP` | veřejné desktop OAuth client ID |

Veřejné hodnoty nesmějí obsahovat client secret ani service role key.

## Supabase/Edge secrets

Podle nasazených funkcí mohou být potřeba:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
- `STRIPE_SECRET_KEY`, webhook secrets a API verze,
- Google/Microsoft OAuth client ID, client secret, redirect URI a tenant,
- `RESEND_API_KEY`, `DEFAULT_EMAIL_FROM`,
- `TINYURL_API_KEY`,
- kontraktové šifrovací klíče a aktivní key/version identifikátory,
- `SITE_URL` a allowlist checkout originů,
- AI/provider konfigurace podle funkce.

Tyto hodnoty se nastavují v secret managementu cílového runtime. Nikdy se
nepřidávají do `VITE_*`.

## Desktop/main a Node

Používané provozní hodnoty zahrnují:

- `NODE_ENV`, `PORT`, `CI`, `ELECTRON_BUILD`,
- `EXCEL_TOOLS_PORT`,
- Supabase serverové hodnoty pro důvěryhodné helpery,
- MCP client/access/read-only konfiguraci,
- OAuth/Resend hodnoty pro serverové toky.

`scripts/write-desktop-build-env.mjs` generuje pouze povolené veřejné hodnoty
pro desktop build. Generovaný soubor se neupravuje ručně.

## Feature flags a tarify

Výchozí katalog je v `config/features.ts`; subscription tier normalizace je v
`config/subscriptionTiers.ts`. Backend může vrátit runtime feature stav nebo
override. UI používá `FeatureContext` a `RequireFeature`.

## Mapy

Mapová konfigurace je v `config/maps.ts`. Externí API secrets mají zůstat na
serverovém proxy; browser dostává pouze veřejnou konfiguraci nutnou pro klienta.

## Versioning

Verze je v `package.json` a synchronizovaných souborech. Měňte ji přes:

```bash
npm run version:patch
npm run version:minor
npm run version:major
```

Potom spusťte `npm run release:prepare` a ověřovací buildy.

## Kontrola konfigurace

- Necommitujte `.env*`.
- Nezobrazujte `gh auth` token ani Edge secrets v logu.
- CI používá bezpečné placeholder hodnoty pro inicializaci klienta; neověřuje
  spojení s produkčním Supabase.
- Chybějící volitelná feature konfigurace má skončit jasným disabled/fallback
  stavem, ne tichým částečným chováním.
