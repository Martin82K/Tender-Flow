# Troubleshooting

## Aplikace zůstane v loadingu

1. Rozlišit auth loading a core data loading.
2. Zkontrolovat incident referenci a runtime log.
3. Ověřit `VITE_SUPABASE_URL` a veřejný klíč.
4. Prověřit session/refresh token chyby.
5. Ověřit dostupnost Supabase projektu.

Stuck loading recovery může session bezpečně invalidovat. Neobcházejte problém
vypnutím auth guardu.

## Načítání projektů selže

- vlastní projekty: ověřit query `projects`, identitu a RLS,
- sdílené projekty: ověřit metadata RPC a normalizovaný e-mail,
- timeout: rozlišit „Načtení projektů“ a „Načtení oprávnění“,
- demo: databázová volání se nemají spouštět.

Klientská filtrace nesmí být rozšiřovaná jako náhrada DB politiky.

## Přihlášení nebo refresh session

- 400/401 Invalid Refresh Token: invalidovat uloženou session a přihlásit znovu,
- opakované auth chyby: query client spustí centralizovaný recovery,
- desktop biometrika: ověřit OS podporu a uložené credentials,
- MFA: ověřit pending MFA stav a aktuální assurance flow.

Tokeny nikdy nekopírujte do ticketu; použijte incident referenci.

## Reset hesla

- web: ověřit reset route a jednorázový token,
- desktop: ověřit registraci/protokol deep linku a předání do renderer route,
- Edge Functions: request/confirm funkce mají veřejný vstup, ale vlastní validaci,
- neplatný nebo použitý token má skončit bezpečnou chybou bez změny hesla.

## Supabase CLI hlásí Docker

Pro cloudový Edge deploy použijte `--use-api`. Docker je nutný jen pro lokální
stack příkazy jako `supabase start`, lokální DB reset nebo lokální serve.

## Edge Function vrací 401/403

- ověřit, zda funkce očekává JWT nebo vlastní veřejný token,
- zkontrolovat `config.toml`,
- zkontrolovat expiration/session,
- ověřit role/grants/RLS,
- nepřidávat service role do klienta jako „opravu“.

## DocHub/OAuth

- ověřit provider-specific client ID/secret a redirect URI,
- zkontrolovat state a callback URL,
- lokální OneDrive desktop provider nepoužívá stejné cloud token workflow,
- při sync chybě prověřit root folder vazbu a Edge log.

## Excel tools

- ověřit `VITE_EXCEL_TOOLS_PROVIDER` a URL/port,
- web potřebuje dostupný HTTP provider,
- desktop může použít nativní provider/Python runner,
- zkontrolovat limity velikosti a podporovaný formát,
- neinstalovat nový balíček bez supply-chain kontroly.

## Electron nejde spustit

```bash
npm run desktop:compile
```

Potom ověřit:

- `desktop/dist/` existuje,
- preload cesta odpovídá buildu,
- veřejné build env byly zapsané,
- port 3000 není obsazený při desktop dev,
- native modul odpovídá platformě/architektuře.

## CSP nebo externí odkaz

- Produkční CSP záměrně blokuje nepovolené originy/eval.
- Externí URL musí projít external URL policy.
- Nepřidávat široké `https:*`, `unsafe-eval` nebo vypnutí `webSecurity` jako
  rychlou opravu.

## Test je zelený, ale loguje chybu

To je chyba testu. Console guard má běh shodit. Pokud log vzniká po ukončení
testu, awaitněte asynchronní práci nebo mockujte vedlejší feature hranici.
Legitimní negativní scénář deklaruje přesný očekávaný log.

## Build warning o velkém chunku

Build může projít s warningem nad 750 kB. Nezvyšujte limit bez analýzy. Nejprve
změřte, který import drží modul v hlavním chunku, a použijte bezpečný lazy import
nebo upravte manual chunk strategii.

## Jak eskalovat problém

Přiložte:

- app verzi a platformu,
- route/modul,
- kroky reprodukce,
- očekávané a skutečné chování,
- incident/error referenci,
- relevantní sanitizovaný log,
- zda problém nastává na webu, desktopu nebo obou.

Nepřikládejte access/refresh token, service role key, OAuth secret ani obsah
citlivých dokumentů.
