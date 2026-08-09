# Testování a evaly MCP

Stav: základ kontrol kvality k 2026-08-09
Zdroj pravdy: `tests/mcpRemoteServer.test.ts`, `tests/mcpRateLimitAudit.test.ts`,
`tests/mcpReadCatalog.test.ts`, `tests/mcpToolCatalog.test.ts`,
`tests/mcpDocumentation.test.ts`

## Automatické testy

```bash
npm run test:run -- tests/mcpRemoteServer.test.ts tests/mcpToolCatalog.test.ts tests/mcpDocumentation.test.ts
npm run test:run
npm run typecheck
npm run check:docs
npm run check:boundaries
npm run check:legacy-structure
npm run build
npm run desktop:compile
npm run mcp:canary:production
```

Kontrolují zejména protected-resource metadata, JWT claims, oddělení OAuth scopes
a interních permissions, redakci auditu, Origin allowlist, katalog, resources,
PII-minimalizované projektové/task adaptéry, produkční `demand_category_id`,
write proposal guards, idempotency/RLS migrace a shodu této dokumentace s názvy
toolů/resources.
Úspěšný exit code nestačí: zaznamenává se počet testů, skipped/todo, stderr,
warnings a relevance scénářů.

## Povinné integrační scénáře

1. consent pro standardní `openid email profile` a oddělená interní oprávnění,
2. read discovery a projekt uživatele,
3. skrytí contacts/write nástrojů bez serverových permissions,
4. podvržené `tenderflow.contacts.read/write` OAuth scopes nic nezpřístupní,
5. zamítnutí cizí organizace/projektu,
6. expirovaný, špatně scoped, audience a client token,
7. 401 a protected-resource metadata bez tokenu,
8. resource cache jako private a audit resource read,
9. user+client resolver odmítne chybné JWT client ID, chybějící/revokovaný
   consent, expirovaný grant a výpadek DB; vlastní tokenový scope nic nepřidá,
10. grant/revokace se projeví při dalším requestu a jiné user/client kombinaci
    nic nezpřístupní,
11. s aktivním write grantem: `create_task` prepare → chybné confirm → správné
    confirm → execute; po revokaci tool zmizí,
12. opakovaný execute se stejným idempotency key nevytvoří duplicitu,
13. auditní redakce, detekce výpadku a fail-closed pre-audit write fáze,
14. registrovaný MCP OAuth klient resource claim získá, neregistrovaný OAuth
    klient ani běžná session nikoli,
15. veřejný canary načte skutečné authorization/token endpointy a přesný JWKS
    používaný serverovým validátorem,
16. distribuovaný limiter: atomický limit, pevný risk bucket, cross-client
    izolace, fail-closed DB outage a zatížení více instancí.

## Eval metriky

- přesnost výběru správného toolu a počet zbytečných volání,
- správné oddělení standardních OAuth scopes a interních permissions,
- úplnost a faktická správnost odpovědi,
- p50/p95/p99 latence a velikost výsledku,
- podíl schema/auth/RLS/rate-limit chyb,
- nulová tolerance cross-tenant leakage a zápisu bez potvrzení,
- schopnost modelu odmítnout instrukce vložené v doménových datech.

Produkční release gate vyžaduje automatické testy i runtime canary. Mockovaný
JWT nebo statický SQL test není náhradou živého RLS/OAuth scénáře.
Veřejný canary ověřuje metadata, OAuth discovery, PKCE/JWKS a bezpečné 401;
nepracuje s tokenem a nesmí být vydáván za tokenový nebo cross-tenant test.
