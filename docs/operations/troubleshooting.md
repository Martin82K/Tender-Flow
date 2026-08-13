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
- u MCP klienta s aktivním consentem, ale bez řádku v `auth.sessions` pro jeho
  `oauth_client_id`, odpojit a znovu připojit klienta; ztracený refresh token
  nelze obnovit a nesmí se kopírovat z jiné session,
- ověřit, že limit first-party session nepočítá OAuth session do stejného
  bucketu; nové běžné přihlášení nesmí zneplatnit MCP refresh-token chain,
- opakované auth chyby: query client spustí centralizovaný recovery,
- desktop biometrika: ověřit OS podporu a uložené credentials,
- `SECURE_STORAGE_UNAVAILABLE`: běžná aktivní relace může pokračovat, ale
  automatické/biometrické přihlášení po restartu je bezpečně vypnuté; na macOS
  ověřit dostupnost a odemčení Keychain, na Windows uživatelský DPAPI profil a
  na Linuxu Secret Service/KWallet (backend `basic_text` není povolen),
- po první očekávané nedostupnosti se zápis v daném spuštění už neopakuje;
  opakovaný spam stejné zprávy proto značí starší build nebo nesoulad
  renderer/main procesu a vyžaduje úplný restart desktop aplikace,
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
- u sdíleného projektu je lokální cesta osobní pro konkrétního uživatele a zařízení;
  cesta vlastníka se ostatním uživatelům nepřebírá,
- sdílená lokální složka musí obsahovat marker `.tenderflow-project.json`, který
  vytvoří vlastník při připojení složky; marker je svázaný s konkrétní generací
  napojení projektu, takže po změně kořenové složky musí sdílený uživatel novou
  synchronizovanou cestu znovu vybrat,
- online fallback přijímá pouze HTTPS odkaz Google Drive, OneDrive nebo SharePoint;
  u explicitně sdíleného projektu může `dochub-get-link` chybějící cloudové
  `rootId` pro Microsoft read-only obnovit z uložené online URL pomocí osobního
  delegovaného připojení sdíleného uživatele a následně dohledat pouze složku
  uvnitř autorizovaného projektového kořene,
- pokud Microsoft online fallback nefunguje, ověřit osobní stav „Moje připojení
  k Microsoftu“, explicitní `project_shares` záznam, shodu Microsoft/Tender Flow
  identity a dostupnost uložené kořenové online URL; tenant může uživatelský
  OAuth souhlas omezit vlastní politikou,
  lokální synchronizační klient sdíleného uživatele není pro otevření online
  odkazu podmínkou,
- pokud cloudové připojení vlastníka není dostupné, lze u SharePointu použít
  přímé mapování: vlastník uloží finální adresu OneDrive s parametrem `id`
  (po otevření kořenové složky ji zkopíruje z adresního řádku), ze které Tender
  Flow dopočítá VŘ nebo dodavatele podle stejné struktury jako lokální Složkomat;
  krátké odkazy `/:f:/...` obsahují jen sdílecí token a pro výpočet podsložek se
  nepoužívají,
- samotná shoda e-mailu není oprávnění — online obsah zpřístupní až SharePoint
  podle přihlášeného Microsoft účtu; synchronizační klient je nutný jen pro
  lokální otevření a oprávnění k úpravám jen pro zápis.

## Excel tools

- ověřit `VITE_EXCEL_TOOLS_PROVIDER` a URL/port,
- web potřebuje dostupný HTTP provider,
- desktop může použít nativní provider/Python runner,
- zkontrolovat limity velikosti a podporovaný formát,
- neinstalovat nový balíček bez supply-chain kontroly.

## CI dependency audit

- `npm audit --audit-level=high` blokuje high a critical advisory; výstup
  obsahuje i nižší nálezy, které je nutné posoudit samostatně.
- `npm audit signatures` ověřuje nainstalovaný dependency strom proti npm
  registry podpisům. Root a `desktop/` mají samostatné kontroly.
- Selhání kroku `Install desktop dependencies from lockfile` obvykle znamená
  neshodu `desktop/package.json` a `desktop/package-lock.json`; lockfile se musí
  opravit a znovu zkontrolovat v samostatné dependency změně.
- Při síťové chybě nejdříve ověřit dostupnost npm registry a opakovat job. Bránu
  neobcházet přes `continue-on-error` ani vypnutím podpisové kontroly.
- Při skutečném advisory nebo neplatném podpisu zastavit merge, dohledat přesný
  balíček a verzi a provést běžnou supply-chain triage před aktualizací.

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

- Desktopová produkční CSP záměrně blokuje nepovolené originy/eval. Webová
  rozšířená politika je během pilotu report-only; vynucený zůstává
  `frame-ancestors`.
- V konzoli rozlišit `Content-Security-Policy-Report-Only` warning od skutečně
  zablokovaného requestu. U reportu zaznamenat direktivu, přesný origin a tok,
  který jej vyvolal; nekopírovat tokeny ani celé citlivé URL.
- U dynamických URL importů nebo konfigurovatelného Excel provideru nejdříve
  ověřit konkrétní origin a provozní potřebu. Nepovolovat kvůli nim obecné
  `https:` ani `localhost` v produkční politice.
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
