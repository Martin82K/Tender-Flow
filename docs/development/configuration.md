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
| `VITE_MICROSOFT_TENANT_ID` | produkční desktop build | veřejné ID existujícího Entra tenantu; desktop broker jím připíná Microsoft authorize URL |
| `VITE_MICROSOFT_OAUTH_CLIENT_ID` | produkční desktop build | veřejné client ID existující registrace Tender Flow; desktop broker odmítne jinou registraci |

Bez Supabase hodnot aplikace zobrazí konfigurační varování a datové/auth funkce
nebudou fungovat. Bez obou Microsoft hodnot se produkční desktop build záměrně
zastaví. Pro současnou existující registraci Tender Flow patří do `.env.local`
tyto veřejné, nikoli tajné hodnoty:

```dotenv
VITE_MICROSOFT_TENANT_ID=f84a89a3-e428-4deb-8c95-a2b2decfb656
VITE_MICROSOFT_OAUTH_CLIENT_ID=df0e80c8-ac5e-4733-8ee1-7dae0ba09802
```

Jde o Directory (tenant) ID a Application (client) ID již používané registrace
Tender Flow v Entra a Azure provideru Supabase. Kvůli lokálnímu buildu se v Entra
nic nevytváří ani nemění.

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

Microsoft připojení používá jednu Entra registraci aplikace pro Supabase Azure
login i Graph API. Nové propojení žádá standardní identity scopes,
`offline_access` a `https://graph.microsoft.com/.default`; konkrétní delegovaná
oprávnění tak autoritativně řídí správce tenantu v App Registration. V Entra
musí být pro používané funkce schválena alespoň odpovídající oprávnění k
dokumentům a `Tasks.ReadWrite` pro Microsoft To Do.

Server při převzetí provider refresh tokenu okamžitě provede jeho obnovu přes
`MS_OAUTH_CLIENT_ID` a `MS_OAUTH_CLIENT_SECRET`. Tím ověří, že Supabase Azure a
Graph používají stejnou App Registration, a teprve potom uloží jediný šifrovaný
token s `access_kind = microsoft_graph`. Starší `personal_read` a `todo_sync`
granty zůstávají podporované jako migrační fallback. Správcovský projektový
token `manage` zůstává oddělený.

`MS_OAUTH_CLIENT_ID` musí být shodné s client ID nastaveným u Azure provideru
v Supabase Auth a `MS_OAUTH_CLIENT_SECRET` musí patřit ke stejné existující
Entra App Registration. Jde o dvě konfigurace téhož OAuth klienta; jejich
nesoulad způsobí bezpečné odmítnutí jednotného Graph grantu. Hodnoty se
nesmějí zapisovat do repozitáře ani do klientského bundle.

Migrace `20260827163315_unified_microsoft_graph_grant.sql` musí být nasazena
před funkcí `microsoft-graph-connection` a aktualizovanými funkcemi
`dochub-auth-url`, `dochub-microsoft-callback`, `dochub-personal-microsoft`,
`microsoft-todo-connection` a `microsoft-todo-sync`. Tokenové tabulky, delta
odkazy a tombstones jsou dostupné pouze serverovému `service_role`; renderer
provider token předá autentizované Edge Function pouze bezprostředně po PKCE
výměně a nikdy jej nečte z databáze ani nevypisuje do logu.

Synchronizace vytváří „Tender Flow – Inbox“ a jeden Microsoft To Do seznam pro
každý osobní TODO projekt. Stávající nesouvisející Microsoft seznamy se
automaticky neimportují. Aktivní TODO obrazovka spouští delta synchronizaci po
otevření, po lokální změně a periodicky; zavřená aplikace změny dorovná při
dalším spuštění.

## Desktop/main a Node

Používané provozní hodnoty zahrnují:

- `NODE_ENV`, `PORT`, `CI`, `ELECTRON_BUILD`,
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
