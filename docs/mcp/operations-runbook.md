# Provozní runbook MCP

Stav: základní provozní postup; produkční canary bude doplněn v Loopu 1
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

Supabase URL a anon key jsou potřeba pro ověření identity a user-scoped Data
API. Service-role credential nepatří do MCP request cesty. Hodnoty se v
incidentních výstupech nevypisují; ověřuje se pouze přítomnost a fingerprint.

## Nasazení

1. Ověřit čistou větev, testy, typecheck, build, boundaries a docs links.
2. U DB změny provést migration audit, linked dry-run, RLS/grants/indexy a až
   po explicitním schválení verzovanou migraci.
3. Nasadit aplikaci a ověřit `/api/mcp-resource` a 401 challenge `/api/mcp`.
4. Provést OAuth canary s nejmenšími scopes a read dotazem.
5. Ověřit auditní řádek, tenantovou izolaci a chování expirovaného tokenu.
6. Write canary provádět jen na určeném testovacím projektu a po prepare/confirm.
7. Po deployi znovu ověřit health, chyby, latenci a databázové advisories.

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
- **Nechtěný zápis:** zablokovat write scope/klienta, dohledat proposal,
  idempotency key a doménový audit; opravu provést standardní business cestou.
- **Audit outage:** nepovažovat chybějící řádky za důkaz nulové aktivity;
  obnovit DB cestu a korelovat hostingové access logy.
- **Přetížení:** dočasně omezit klienta/WAF, protože současný `in-memory` limiter
  není dostatečný napříč instancemi.

Rollback aplikace nesmí vracet databázové migrace destruktivním příkazem.
Kompatibilní forward-fix je preferovaný; revokace OAuth klienta je bezpečný
okamžitý kill switch.
