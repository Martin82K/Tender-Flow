# Tender Flow MCP

Stav: implementováno, dokumentační základ 2026-08-09
Zdroj pravdy: `server/mcp/`, `api/mcp.js`, `scripts/mcp-stdio.js` a MCP migrace v `supabase/migrations/`

Tender Flow MCP zpřístupňuje autorizovaná data a omezené operace Tender Flow
externím AI klientům. Označení „MCP 2.0“ v tomto repozitáři znamená SDK v2 a
protokolovou revizi `2026-07-28`. Remote server je stateless: každý požadavek
nese vlastní protokolová a klientská metadata a nevyžaduje MCP session.

## Mapa dokumentace

- [Architektura](architecture.md)
- [Autentizace a OAuth](authentication.md)
- [Scopes a oprávnění](scopes-and-permissions.md)
- [Reference tools](tools-reference.md)
- [Reference resources](resources-reference.md)
- [Transporty](transports.md)
- [Bezpečný zápis](write-safety.md)
- [Chyby a limity](errors-and-limits.md)
- [Bezpečnostní model](security-model.md)
- [Provozní runbook](operations-runbook.md)
- [Testování a evaly](testing-and-evals.md)
- [Tender Flow skilly](skills.md)
- [Připojení klienta](client-onboarding.md)
- [Řešení problémů](troubleshooting.md)
- [Release a deprecation policy](release-and-deprecation.md)
- [Changelog](changelog.md)
- [ADR-0001: MCP 2026-07-28](adr/0001-mcp-2026-07-28.md)

## Aktuální hranice

- Policy katalog implementuje 14 read nástrojů a 3 nástroje zápisového
  protokolu. Aktivně consentovaný OAuth klient získá základní read katalog;
  kontaktní data vyžadují 30denní user+client grant a write katalog osmihodinový
  grant. Oba lze okamžitě odebrat v Nastavení → Nástroje → MCP přístupy.
- Třífázový zápisový protokol dovoluje vykonat jen `create_task`; ostatní typy
  server odmítá provést i s aktivním write grantem.
- Dostupný je katalog, PII-minimalizovaný projektový souhrn, smluvní přehled a
  vlastní otevřené tasky. Plný detail nabídek a kontaktů zůstává skrytý.
- Remote a lokální stdio používají společnou Node implementaci. `desktop MCP`
  je zatím samostatná starší implementace; její sjednocení je plánovaná práce.
- Rate limit je distribuovaný PostgreSQL user/client/risk bucket s pevnými
  60sekundovými limity a fail-closed chováním při DB výpadku.
- Produkční OAuth canary s reálným klientem je samostatný následující loop.

Oficiální podklady: [MCP 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/),
[MCP autorizace](https://modelcontextprotocol.io/docs/tutorials/security/authorization)
a [SDK v2](https://ts.sdk.modelcontextprotocol.io/v2/api/%40modelcontextprotocol/client/).
