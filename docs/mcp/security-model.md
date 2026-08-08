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
| klient → HTTP | Origin, headers, JSON, token | Origin allowlist, JWT/issuer/audience/resource/client/scopes, schema |
| MCP → tool/resource | názvy a argumenty | podmíněná registrace, opakovaná scope kontrola, Zod, rate limit |
| MCP → data | ID, filtry, search | omezené selecty/RPC, user Bearer token, RLS a tenant role |
| write workflow | proposal, potvrzení, token | user+client vazba, expirace, hash tokenu, idempotence |
| audit | vstupy a výsledky | redakce secret/PII klíčů, omezené souhrny, RLS |

## Hrozby a mitigace

- **Cross-tenant access:** autoritativně blokuje RLS/RPC; scope sám nestačí.
- **Ukradený nebo zaměněný token:** issuer, resource/audience a OAuth client
  allowlist; krátká expirace má být řízena Auth serverem.
- **Scope escalation:** tool se skryje a při volání znovu ověří; stdio běžnému
  session tokenu nepřidá contacts/write.
- **Prompt injection:** data z Tender Flow jsou nedůvěryhodný obsah, nikoli
  instrukce; zápis vyžaduje explicitní třífázový tok.
- **Citlivá dokumentová metadata:** MCP mapování odstraňuje raw URL a storage
  path; vrací jen příznak/název.
- **Replay/dvojitý zápis:** execute token, expirace a user/client-scoped
  idempotency key.
- **DNS rebinding/browser abuse:** přesný Origin allowlist; non-browser klient
  stále potřebuje validní token.

## Známá reziduální rizika

- Rate limit je `in-memory`, není distribuovaný a resetuje se restartem.
- Audit helper aktuálně nezajišťuje fail-closed zápis ani spolehlivou externí
  signalizaci každého výpadku auditu.
- Produkční OAuth canary, expirace a cross-tenant negativní scénář s reálným
  klientem ještě nejsou zdokumentovány jako vykonané.
- `desktop MCP` nepoužívá stejný katalog/protokol jako remote/stdio.
- Databázové grants mají být dále zúženy; RLS je aktuální hlavní ochrana řádků.

Tyto body nejsou skryté akceptované garance. Jsou vstupem pro následující
security-hardening loopy a release gate.
