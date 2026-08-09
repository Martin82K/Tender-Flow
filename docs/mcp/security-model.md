# Bezpečnostní model MCP

Stav: obrany implementované k 2026-08-09; provozní mezery jsou uvedeny níže
Zdroj pravdy: `server/mcp/`, MCP migrace a `docs/security/security-model.md`

## Chráněná aktiva

- tenantová projektová a smluvní data,
- kontaktní e-maily a telefony,
- uživatelská identita a OAuth tokeny,
- write proposals, execute tokeny a idempotency výsledky,
- auditní stopa.

## Trust boundaries a kontroly

| Hranice | Nedůvěryhodný vstup | Kontroly |
| --- | --- | --- |
| klient → HTTP | Origin, headers, JSON, token | Origin allowlist, JWT/issuer/audience/resource/client/identity scopes, schema |
| MCP → tool/resource | názvy a argumenty | per-request user+client permission resolver, podmíněná registrace, opakovaná kontrola, Zod, distribuovaný DB rate limit |
| MCP → data | ID, filtry, search | oddělený backend `sb_secret_` apikey, izolovaná NOINHERIT role, omezené grants/selecty/RPC, user Bearer token, RLS a tenant role |
| write workflow | proposal, potvrzení, token | user+client vazba, expirace, hash tokenu, idempotence |
| audit | vstupy a výsledky | redakce secret/PII klíčů, omezené souhrny, RLS, povinný pre-audit write fází |

## Hrozby a mitigace

- **Cross-tenant access:** autoritativně blokuje RLS/RPC; scope sám nestačí.
- **Přímý Data API bypass:** MCP OAuth JWT má vyhrazenou NOINHERIT roli a
  PostgREST jej přijme jen spolu se serverovým `SUPABASE_MCP_SECRET_KEY`.
  Role záměrně nemá přístup ke spravovanému schématu `auth`; podepsanou
  identitu uživatele a klienta poskytují jen úzké `SECURITY DEFINER` helpery
  `mcp_current_user_id()` a `mcp_current_client_id()` v `public`.
  Stejný pre-request požadavek platí i pro starší OAuth JWT s `client_id`/`azp`
  a původní rolí `authenticated`, takže při nasazení nevzniká přechodové okno.
  Storage a publikované Realtime tabulky navíc odmítají staré OAuth tokeny
  restriktivní RLS; nové MCP roli jsou jejich grants odebrané. Klient zná pouze JWT, takže
  nemůže přeskočit tool registraci, rate limit, audit ani write potvrzení.
- **Ukradený nebo zaměněný token:** issuer, resource/audience a OAuth client
  allowlist; krátká expirace má být řízena Auth serverem.
- **Permission escalation:** vlastní `tenderflow.*` token scope se nikdy
  nepřekládá na permission; tool se skryje a při volání se permission znovu
  ověří. Zvýšené granty jsou vázané na `auth.uid()` a consentovaný OAuth
  `client_id`, mají pevnou expiraci a lze je okamžitě revokovat.
- **Grant/client confusion:** RPC nepřijímá cílové `user_id`; resolver navíc
  porovnává vstupní klient ID s `client_id`/`azp` z ověřeného JWT a vyžaduje
  nezrušený OAuth consent. Správcovská grantová RPC naopak každý JWT s
  `client_id` nebo `azp` odmítnou a dovolí změnu jen z first-party Tender Flow
  session. Grant ani vlastní tokenový scope tuto vazbu neobejde.
- **Obnovení odvolaného consentu:** zvýšený grant ukládá `consent_id` i
  `granted_at` konkrétní generace souhlasu. Nová autorizace stejného klienta
  proto obnoví pouze základní read; contacts/write musí uživatel znovu povolit.
- **Forenzní audit:** audit ukládá `client_id` jako neměnný snapshot bez
  cascade FK, takže odstranění kompromitovaného OAuth klienta nesmaže historii.
- **Resource confusion:** Auth Hook vydá syntetický MCP resource claim jen
  aktivnímu klientovi v `mcp_oauth_client_resources`; samotná přítomnost
  libovolného `client_id` nestačí.
- **Prompt injection:** data z Tender Flow jsou nedůvěryhodný obsah, nikoli
  instrukce; zápis vyžaduje explicitní třífázový tok.
- **Citlivá dokumentová metadata:** MCP mapování odstraňuje raw URL a storage
  path; vrací jen příznak/název.
- **Kontaktní PII v obecném read:** `search`, `fetch` a projektový resource
  používají PII-minimalizované adaptéry; tabulka kontaktů se bez contacts
  permission vůbec nedotazuje. Databázová policy navíc vyžaduje aktuální
  `tenderflow.contacts.read` grant. Nabídky jsou v summary pouze agregované.
- **Historické kontaktní RLS:** staré `USING true`/`WITH CHECK true` politiky
  jsou forward migrací odstraněné; běžné Tender Flow session zůstávají omezené
  na vlastní nebo organizační kontakty.
- **Task provider metadata:** obecný task adaptér vrací pouze pracovní obsah a
  vazby vlastního tasku; externí URL, sync stav/chyby a `created_by` vynechává.
- **Replay/dvojitý zápis:** execute token, expirace a user/client-scoped
  idempotency key.
- **Obcházení limitu přes více instancí:** atomický PostgreSQL bucket podle
  user/client/risk; pevné limity a klientská vazba jsou uvnitř RPC.
- **Tichý výpadek auditu:** Supabase návratové chyby i výjimky se signalizují
  bezpečným hosting logem; každá write fáze vyžaduje úspěšný audit pokusu ještě
  před doménovým handlerem.
- **DNS rebinding/browser abuse:** přesný Origin allowlist; non-browser klient
  stále potřebuje validní token.

## Známá reziduální rizika

- Veřejná část produkčního OAuth canary je automatizovaná; vydání tokenu,
  expirace a cross-tenant negativní scénář s reálným klientem ještě nebyly
  vykonány.
- Po deployi musí živý OAuth canary potvrdit resource claim i roli
  `tenderflow_mcp_client`; server starší JWT fail-closed odmítne.
- Serverový `SUPABASE_MCP_SECRET_KEY` musí být před deployem vytvořen jako
  samostatný rotovatelný Supabase secret API key a uložen ve Vercel secrets.
- `desktop MCP` nepoužívá stejný katalog/protokol jako remote/stdio.
- Živý produkční canary musí ještě ověřit expiraci a revokaci elevated grantu;
  statický migrační test ani rollback dry-run tuto provozní kontrolu nenahrazuje.

Tyto body nejsou skryté akceptované garance. Jsou vstupem pro následující
security-hardening loopy a release gate.
