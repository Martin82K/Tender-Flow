# Bezpečnostní model

## Cíle

- zabránit přístupu uživatele k cizím tenant/project datům,
- nepropustit serverové secrets do browseru nebo rendereru,
- omezit Electron renderer a IPC,
- sanitizovat chyby, logy a incidenty,
- chránit auth/session a password reset toky,
- zachovat auditovatelné release a CI brány.

## Trust boundaries

| Hranice | Nedůvěryhodná strana | Kontrola |
| --- | --- | --- |
| Browser → Supabase | uživatel a klientský JavaScript | Auth token, grants, RLS, RPC validace |
| Browser → Edge Function | request payload a veřejný klient | JWT/vlastní token, schema validace, rate/origin kontrola |
| Renderer → Electron main | renderer a vstup uživatele | preload allowlist, IPC kontrakt, auth guard, path/URL validace |
| Externí OAuth → callback | provider callback parametry | state, redirect allowlist, jednorázovost |
| MCP client → MCP server | externí klient a tool argumenty | access token/client ID, consent, read-only režim, rate limit |
| Release artefakt → uživatel | build pipeline a distribuční kanál | lokální build, ověření artefaktů, podpis/notarizace podle platformy |

## Identity a session

- Supabase Auth je zdroj identity.
- Autorizační rozhodnutí nesmí používat uživatelsky editovatelná metadata.
- Auth chyby jsou centralizované v session/query recovery.
- Při opakovaných token/session chybách se session invaliduje a uživatel se
  vrací na login.
- Logout a kritická invalidace čistí citlivý lokální stav a query cache.
- Desktop credentials ukládá main proces, ne localStorage rendereru.
- MFA a biometrika jsou další kontrola; nenahrazují serverovou autorizaci.

## Datová autorizace

RLS je primární ochrana řádků v Supabase. Správná politika kombinuje cílovou
Postgres roli s vlastnictvím, organizací nebo explicitním sdílením. Samotné
`TO authenticated` není tenant autorizace.

Klientská filtrace:

- zlepšuje UX a defense-in-depth,
- musí selhat uzavřeně při prázdné identitě nebo neúplných metadatech,
- nikdy neopravňuje data, která DB neměla vrátit.

Živé RLS integrační testy nejsou aktuálně součástí CI na základě vědomého
rozhodnutí projektu. Statické testy migrací proto nejsou vydávané za end-to-end
důkaz nasazené databáze.

## Keys a secrets

Do browseru/rendereru smějí pouze veřejné hodnoty:

- Supabase URL,
- anon/publishable klíč,
- veřejná feature/provider konfigurace,
- veřejné OAuth client ID, pokud to daný tok vyžaduje.

Do browseru nesmějí:

- `SUPABASE_SERVICE_ROLE_KEY`,
- Stripe secret a webhook secrets,
- OAuth client secrets,
- e-mail/API serverové keys,
- MCP access tokeny,
- šifrovací klíče kontraktů.

Secrets patří do Supabase secrets, hosting secret store, CI secrets nebo lokálního
necommitnutého prostředí. `.env*` obsah se nekopíruje do logů ani dokumentace.

## Edge Functions a RPC

- Funkce ověřuje identitu a autorizaci před datovou operací.
- `verify_jwt = false` vyžaduje explicitní vlastní ochranu.
- Externí URL/origin/redirect se porovnávají s allowlistem.
- RPC přijímající `user_id` nesmí slepě věřit klientovi.
- `SECURITY DEFINER` má omezený grant, řízený `search_path` a kontrolu identity.
- Service role se používá pouze uvnitř důvěryhodného serverového runtime.

## Electron

- context isolation, sandbox a vypnutý Node integration,
- minimální preload API,
- IPC auth guard a validace payloadů,
- path traversal a externí URL policy,
- CSP bez eval v produkci,
- secure storage pro credentials,
- generické síťové/filesystem operace nejsou volně vystavené rendereru.

## Webová CSP

- Vynucená webová politika zatím zachovává kompatibilní
  `frame-ancestors 'self'`.
- Rozšířená politika pro `script-src`, `connect-src`, `object-src`, `base-uri`
  a `form-action` se nejprve doručuje hlavičkou
  `Content-Security-Policy-Report-Only`.
- Report-only politika nepovoluje `unsafe-inline`, `unsafe-eval`, obecné
  `https:` ani wildcard zdroj. Síťový allowlist pokrývá Supabase, Mapy.com,
  ARES, OpenAI Realtime a výchozí EU PostHog endpointy.
- Dynamické cíle importu kontaktů a konfigurovatelný Excel tools provider se
  nepovolují obecným `https:` ani produkčním `localhost` pravidlem. Jejich
  legitimní reporty jsou vstupem pro samostatný návrh explicitní konfigurace
  před případným vynucením politiky.
- Pilot nemá veřejný reportovací endpoint. Porušení se ověřují v browserové
  konzoli při runtime smoke testech, aby nevznikl nechráněný ingest pro URL,
  DOM nebo formulářová metadata.
- Přechod na vynucení je samostatné rozhodnutí až po ověření webových toků a
  vyřešení legitimních reportů. Široké zdroje se nepřidávají jako rychlá oprava.

## Logy a incidenty

- `summarizeErrorForLog`/sanitizační utility odstraňují tokeny a PII.
- Kritická chyba má stabilní error code a unikátní `INC-...` referenci.
- Uživatel vidí referenci, nikoli syrový backend payload.
- Neočekávaný `console.error`/`console.warn` shodí test.
- Incident log nesmí obsahovat authorization header, refresh token ani secret.

## Privacy a telemetrie

- PostHog/usage tracking se řídí souhlasem a session kontextem.
- Demo režim a nepřihlášené stavy nesmí odesílat identifikovanou telemetrii.
- Cookie consent, právní verze a acceptance mají samostatné modely.
- Retention, DSR, breach a access review jsou dostupné v compliance administraci.

## Supply chain

- lockfiles se commitují,
- CI používá `npm ci`,
- závislosti se pravidelně auditují,
- nové balíčky se před instalací prověřují podle integrity, podpisu/provenance,
  zdrojového repozitáře, maintainerů, historie vydání, známých zranitelností a
  oznámených incidentů; stáří verze je rizikový signál, ne pevný zákaz,
- po změně lockfile se spouští `npm audit` a `npm audit signatures`,
- Quality CI fail-closed ověřuje high/critical advisory a registry podpisy pro
  root i samostatný desktop dependency strom,
- release build vychází z ověřeného zdroje a lokálních artefaktů.

## Povinné kontroly před merge

```bash
npm run test:run
npm run typecheck
npm run build
npm run desktop:compile
npm run check:boundaries
npm run check:legacy-structure
npm run check:docs
npm audit --audit-level=high
npm audit signatures
```

Podle rozsahu se přidávají cílené security testy, kontrola migrací, Electron IPC
testy nebo manuální ověření OAuth/release toku.
