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
| `VITE_MICROSOFT_LOGIN_ENABLED` | bezpečnostní release přepínač; nastavte na `true` až po aktivaci Azure provideru, Before User Created hooku, ručního linkování a povolených návratových URL |

Microsoft přihlášení je určeno pouze existujícím účtům. Před zapnutím přepínače
musí být v Supabase Authentication nastaven Azure provider, povoleno ruční
linkování identit, aktivován hook
`hook_restrict_microsoft_login_to_existing_users` a přidány webové i desktopové
loopback návratové URL. Azure callback v Entra ID zůstává HTTPS callback Supabase;
loopback `127.0.0.1` je až interní návrat Supabase do desktopové aplikace.

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

Microsoft DocHub OAuth používá registraci aplikace typu Web s callbackem
`dochub-microsoft-callback`. Pro osobní připojení sdíleného uživatele žádá
delegované scope `User.Read`, `Files.Read.All` a `offline_access`; správcovský
token vlastníka zůstává uložen odděleně. Produkční nasazení musí nejprve použít
migraci s `dochub_user_tokens.access_kind` a teprve potom nasadit související
Edge Functions.

## Desktop/main a Node

Používané provozní hodnoty zahrnují:

- `NODE_ENV`, `PORT`, `CI`, `ELECTRON_BUILD`,
- `EXCEL_TOOLS_PORT`,
- Supabase serverové hodnoty pro důvěryhodné helpery,
- MCP client/access/read-only konfiguraci,
- OAuth/Resend hodnoty pro serverové toky.

`scripts/write-desktop-build-env.mjs` generuje pouze povolené veřejné hodnoty
pro desktop build. Generovaný soubor se neupravuje ručně.

### Remote MCP 2.0

Remote endpoint `/api/mcp` používá MCP protokol `2026-07-28` přes stateless
Streamable HTTP. Starší klienti mohou dočasně vyjednat stateless legacy režim;
noví klienti používají `server/discover` a metadata v každém requestu.

| Proměnná | Účel |
| --- | --- |
| `MCP_ALLOWED_CLIENT_IDS` | povolená OAuth client ID; v produkci je povinná |
| `MCP_ALLOWED_AUDIENCES` | povolené JWT audience včetně kanonického MCP resource URI |
| `MCP_REQUIRED_SCOPES` | minimální OAuth scopes endpointu; výchozí je `openid` |
| `MCP_ALLOWED_ORIGINS` | přesný allowlist browser originů oddělený čárkou |
| `SUPABASE_MCP_SECRET_KEY` | povinný server-only Supabase `sb_secret_…` klíč; nikdy nesmí do `VITE_*` ani k MCP klientovi |
| `TENDER_FLOW_MCP_ACCESS_TOKEN` | pouze lokální dedikovaný MCP OAuth token; běžná TF session se odmítne |
| `TENDER_FLOW_MCP_READ_ONLY` | zakáže write tools v lokálním stdio režimu |

`MCP_REQUIRED_SCOPES` smí obsahovat jen scopes inzerované MCP serverem:
`openid`, `email` a `profile`. Staré nebo vlastní `tenderflow.*` hodnoty server
odmítne jako chybnou konfiguraci místo publikování neproveditelného OAuth toku.

HTTP access token musí být vydaný pro kanonický resource endpoint a server jej
ověřuje jako Supabase JWT. `MCP_ALLOWED_ORIGINS` není náhrada autentizace;
chrání browserové požadavky a DNS-rebinding scénáře. Requesty bez `Origin`
(typicky serverové MCP klienty) stále musí projít OAuth kontrolou.

OAuth klient žádá standardní Supabase identity scopes, typicky
`openid email profile`. Doménová oprávnění jsou oddělená interní permissions:
`tenderflow.read`, `tenderflow.contacts.read` a `tenderflow.write`. Vlastní
`tenderflow.*` hodnota v OAuth access tokenu permission neudělí.

Remote i lokální stdio vyžadují token s izolovanou rolí
`tenderflow_mcp_client`. Datové volání vzniká až na serveru kombinací tohoto
uživatelského JWT v `Authorization` a `SUPABASE_MCP_SECRET_KEY` v `apikey`.
Contacts/write se zapnou až samostatným autoritativním grant modelem vázaným
na uživatele a schváleného klienta; pouhá konfigurace OAuth scope k tomu
nestačí.

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
