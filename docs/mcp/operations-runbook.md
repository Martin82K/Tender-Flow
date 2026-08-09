# Provozní runbook MCP

Stav: veřejná část produkčního canary je automatizovaná; tokenový a RLS canary
vyžaduje registrovaného klienta a testovacího uživatele
Zdroj pravdy: `server/mcp/`, `docs/development/configuration.md` a Vercel route

## Povinná konfigurace

| Proměnná | Požadavek |
| --- | --- |
| `MCP_ALLOWED_CLIENT_IDS` | v produkci povinný přesný allowlist |
| `MCP_ALLOWED_AUDIENCES` | povolené audience včetně kanonického resource URI |
| `MCP_REQUIRED_SCOPES` | minimální endpoint scopes; výchozí `openid` |
| `MCP_ALLOWED_ORIGINS` | přesný browser Origin allowlist |
| `SUPABASE_MCP_SECRET_KEY` | povinný server-only `sb_secret_…` klíč pouze pro MCP backend |
| `TENDER_FLOW_MCP_ACCESS_TOKEN` | lokální dedikovaný MCP OAuth token; běžná TF session se odmítne |
| `TENDER_FLOW_MCP_READ_ONLY` | vypnutí stdio write tools |

Před deployem ověřit, že `MCP_REQUIRED_SCOPES` obsahuje jen `openid`, `email`
a `profile`; server jiné hodnoty odmítá jako chybnou konfiguraci.

Supabase URL je potřeba pro ověření identity. MCP Data API používá serverový
`SUPABASE_MCP_SECRET_KEY` jako `apikey` a uživatelský OAuth JWT jako
`Authorization`; z tajného klíče navíc odvozuje přesný backend proof pro
PostgREST pre-request guard. Právě toto oddělení zachová `auth.uid()` a RLS.
Privilegované `service_role` RPC pouze registruje/rotuje proof a nikdy nenese
uživatelský JWT ani doménová data. Veřejný anon klíč ani service-role bypass do
uživatelské MCP datové cesty nepatří. Klíč ani proof se v incidentních
výstupech nevypisují; ověřuje se pouze přítomnost a fingerprint.

## Nasazení

1. Ověřit čistou větev, testy, typecheck, build, boundaries a docs links.
2. V Supabase API Keys vytvořit samostatný rotovatelný secret key pro MCP a
   uložit jej jako `SUPABASE_MCP_SECRET_KEY` do serverového/Vercel prostředí.
3. U DB změny provést migration audit, linked dry-run, RLS/grants/indexy a až
   po explicitním schválení verzovanou migraci.
4. Nasadit aplikaci a ověřit `/api/mcp-resource` a 401 challenge `/api/mcp`,
   včetně `scope="openid"` ve `WWW-Authenticate`.
   Veřejnou část lze spustit příkazem `npm run mcp:canary:production`.
   První autorizovaný request musí přes service-role-only RPC zaregistrovat
   backend proof; následné permission a tool requesty musí nést stejný proof.
5. Pod rolí `tenderflow_mcp_client` ověřit, že `mcp_current_user_id()`,
   `mcp_current_client_id()` a `enforce_mcp_backend_boundary()` fungují bez
   `USAGE` oprávnění na schéma `auth`.
6. Ověřit, že OAuth klient je aktivní v `auth.oauth_clients` i v
   `mcp_oauth_client_resources`, a teprve potom zapnout Custom Access Token
   Hook.
7. Znovu připojit MCP klienta, aby byl vydán nový token; ověřit v claims
   `role=tenderflow_mcp_client`, přesný `client_id` a kanonický resource.
8. Ověřit, že samotný OAuth JWT s publishable/anon `apikey` dostane na
   `/rest/v1`, Storage i Realtime 401/403. Test musí zahrnout nový token s rolí
   `tenderflow_mcp_client` i starší token s rolí `authenticated`; pre-request
   blokuje PostgREST a restriktivní RLS blokuje Storage i publikované Realtime
   tabulky pro každý JWT s `client_id`/`azp`. Toolový read přes MCP backend
   naopak musí projít.
9. Ověřit auditní řádek, tenantovou izolaci, nulové kontakty bez contacts
   grantu a chování expirovaného tokenu.
   Po revoke a nové autorizaci stejného klienta ověřit, že původní
   contacts/write grant zůstává neaktivní a audit přežije odstranění klienta.
10. Ověřit skutečný resource/audience claim tokenu. Při neshodě zachovat
   fail-closed stav a opravit kontrakt podle živého vydaného tokenu.
11. Na testovacím projektu a účtu povolit osmihodinový write grant, provést
   `create_task` prepare → confirm → execute, ověřit audit a řádek tasku, grant
   revokovat a ověřit okamžité zmizení write katalogu.
12. Po deployi znovu ověřit health, chyby, latenci a databázové advisories.

Při rotaci `SUPABASE_MCP_SECRET_KEY` nejdřív nasadit jednu konzistentní novou
hodnotu, vyvolat autorizovaný MCP canary a až po úspěchu ukončit staré instance.
Proof store je záměrně singleton: souběžné instance s různými secrets se mohou
navzájem přepisovat a dočasně selhat 403/503, vždy však fail-closed. Nikdy
nevypisovat uložený proof; kontrolovat pouze existenci jednoho řádku a čas
`updated_at`.

### Poslední ověřený produkční preflight

Dne 2026-08-09 byl bez tokenu ověřen kanonický endpoint
`https://www.tenderflow.cz/api/mcp`, protected-resource metadata, 401 challenge,
Supabase OAuth discovery, authorization code flow, PKCE S256, JWKS a nabídka
asymetrických algoritmů RS256/ES256. Ne-www doména přesměrovává 307 na www,
proto klienti musí jako resource používat přímo kanonickou www adresu.

Tento preflight není důkazem tokenových claims ani RLS. Dokud registrovaný
produkční klient nevydá skutečný token s očekávaným resource claimem, server
zůstává fail-closed; tokenový canary je nutný i pro základní read permission.

## Minimální observabilita

Sledovat počet volání podle toolu/resource, výsledek, riziko, OAuth klienta,
latenci a rate-limit odmítnutí. Nikdy neukládat Bearer/execute token, celé
kontakty ani plný execute výsledek. Výpadek auditního INSERT musí být viditelný
v hosting logu. U write fáze ověřit existenci `*_attempt` před outcome řádkem;
bez úspěšného pre-auditu server doménovou změnu nespustí.

## Incidenty

- **Únik tokenu:** zneplatnit session/credential, odstranit klienta z allowlistu,
  prověřit audit a tenantové přístupy.
- **Podezření na cross-tenant přístup:** pozastavit MCP klienta, zachovat logy,
  ověřit JWT claims, RLS policy a konkrétní SQL/RPC cestu.
- **Nechtěný zápis:** odebrat interní write grant/klienta, dohledat proposal,
  idempotency key a doménový audit; opravu provést standardní business cestou.
- **Audit outage:** nepovažovat chybějící řádky za důkaz nulové aktivity;
  obnovit DB cestu a korelovat hostingové access logy.
- **HTTP 503 `mcp_auth_service_unavailable`:** token nereautorizovat; jde o
  dočasný výpadek permission resolveru. Ověřit Supabase/PostgREST a požadavek
  opakovat s backoffem.
- **Přetížení:** zkontrolovat `consume_mcp_rate_limit`, počet aktivních bucketů,
  DB latency a `Rate limit service is unavailable`; podle klienta případně
  použít OAuth allowlist/WAF kill switch.

## Kill switch pořadí

1. Odebrat uživatelský contacts/write grant přes Nastavení nebo správcovské
   RPC volané first-party Tender Flow session; OAuth MCP token je volat nesmí.
2. Pro jednoho klienta revokovat OAuth consent nebo deaktivovat jeho řádek v
   `mcp_oauth_client_resources`.
3. Odebrat client ID z `MCP_ALLOWED_CLIENT_IDS` a nasadit konfiguraci.
4. Při plošném incidentu zablokovat `/api/mcp` na edge/WAF a zachovat auditní
   i hosting logy. Databázovou migraci nevracet destruktivním rollbackem.

Rollback aplikace nesmí vracet databázové migrace destruktivním příkazem.
Kompatibilní forward-fix je preferovaný; revokace OAuth klienta je bezpečný
okamžitý kill switch.
