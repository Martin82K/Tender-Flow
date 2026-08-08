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
| `TENDER_FLOW_MCP_ACCESS_TOKEN` | jen lokální stdio secret |
| `TENDER_FLOW_MCP_READ_ONLY` | vypnutí stdio write tools |

Před deployem ověřit, že `MCP_REQUIRED_SCOPES` obsahuje jen `openid`, `email`
a `profile`; server jiné hodnoty odmítá jako chybnou konfiguraci.

Supabase URL a anon key jsou potřeba pro ověření identity a user-scoped Data
API. Service-role credential nepatří do MCP request cesty. Hodnoty se v
incidentních výstupech nevypisují; ověřuje se pouze přítomnost a fingerprint.

## Nasazení

1. Ověřit čistou větev, testy, typecheck, build, boundaries a docs links.
2. U DB změny provést migration audit, linked dry-run, RLS/grants/indexy a až
   po explicitním schválení verzovanou migraci.
3. Nasadit aplikaci a ověřit `/api/mcp-resource` a 401 challenge `/api/mcp`.
   Veřejnou část lze spustit příkazem `npm run mcp:canary:production`.
4. Ověřit, že OAuth klient je aktivní v `auth.oauth_clients` i v
   `mcp_oauth_client_resources`, a teprve potom zapnout Custom Access Token
   Hook.
5. Provést OAuth canary se standardními `openid email profile` a read dotazem.
6. Ověřit auditní řádek, tenantovou izolaci a chování expirovaného tokenu.
7. Ověřit skutečný resource/audience claim tokenu. Při neshodě zachovat
   fail-closed stav a opravit kontrakt podle živého vydaného tokenu.
8. Write canary neprovádět, dokud nebude samostatně schválen a nasazen
   autoritativní user+client grant model; potom jen na testovacím projektu.
9. Po deployi znovu ověřit health, chyby, latenci a databázové advisories.

### Poslední ověřený produkční preflight

Dne 2026-08-09 byl bez tokenu ověřen kanonický endpoint
`https://www.tenderflow.cz/api/mcp`, protected-resource metadata, 401 challenge,
Supabase OAuth discovery, authorization code flow, PKCE S256, JWKS a nabídka
asymetrických algoritmů RS256/ES256. Ne-www doména přesměrovává 307 na www,
proto klienti musí jako resource používat přímo kanonickou www adresu.

Tento preflight není důkazem tokenových claims ani RLS. Dokud registrovaný
produkční klient nevydá skutečný token s očekávaným resource claimem, server
zůstává fail-closed a kontaktní i write permissions zůstávají vypnuté.

## Minimální observabilita

Sledovat počet volání podle toolu/resource, výsledek, riziko, OAuth klienta,
latenci a rate-limit odmítnutí. Nikdy neukládat Bearer/execute token, celé
kontakty ani plný execute výsledek. Výpadek auditního INSERT musí být viditelný
v aplikačních metrikách; tato detekce je plánované hardening opatření.

## Incidenty

- **Únik tokenu:** zneplatnit session/credential, odstranit klienta z allowlistu,
  prověřit audit a tenantové přístupy.
- **Podezření na cross-tenant přístup:** pozastavit MCP klienta, zachovat logy,
  ověřit JWT claims, RLS policy a konkrétní SQL/RPC cestu.
- **Nechtěný zápis:** odebrat interní write grant/klienta, dohledat proposal,
  idempotency key a doménový audit; opravu provést standardní business cestou.
- **Audit outage:** nepovažovat chybějící řádky za důkaz nulové aktivity;
  obnovit DB cestu a korelovat hostingové access logy.
- **Přetížení:** dočasně omezit klienta/WAF, protože současný `in-memory` limiter
  není dostatečný napříč instancemi.

Rollback aplikace nesmí vracet databázové migrace destruktivním příkazem.
Kompatibilní forward-fix je preferovaný; revokace OAuth klienta je bezpečný
okamžitý kill switch.
