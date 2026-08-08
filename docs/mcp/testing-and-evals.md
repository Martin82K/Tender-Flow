# Testování a evaly MCP

Stav: základ kontrol kvality k 2026-08-09
Zdroj pravdy: `tests/mcpRemoteServer.test.ts`, `tests/mcpToolCatalog.test.ts`,
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
```

Kontrolují zejména protected-resource metadata, JWT claims, scopes, redakci
auditu, Origin allowlist, katalog, resources, write proposal guards,
idempotency/RLS migrace a shodu této dokumentace s názvy toolů/resources.
Úspěšný exit code nestačí: zaznamenává se počet testů, skipped/todo, stderr,
warnings a relevance scénářů.

## Povinné integrační scénáře

1. consent pouze pro `openid` + read,
2. read discovery a projekt uživatele,
3. skrytí contacts/write nástrojů bez scopes,
4. kontakt s contacts scope,
5. zamítnutí cizí organizace/projektu,
6. expirovaný, špatně scoped, audience a client token,
7. 401 a protected-resource metadata bez tokenu,
8. resource cache jako private a audit resource read,
9. `create_task` prepare → chybné confirm → správné confirm → execute,
10. opakovaný execute se stejným idempotency key bez duplicity,
11. auditní redakce a detekce výpadku auditu,
12. zatížení více instancí po zavedení distribuovaného limiteru.

## Eval metriky

- přesnost výběru správného toolu a počet zbytečných volání,
- přesnost volby nejmenších scopes,
- úplnost a faktická správnost odpovědi,
- p50/p95/p99 latence a velikost výsledku,
- podíl schema/auth/RLS/rate-limit chyb,
- nulová tolerance cross-tenant leakage a zápisu bez potvrzení,
- schopnost modelu odmítnout instrukce vložené v doménových datech.

Produkční release gate vyžaduje automatické testy i runtime canary. Mockovaný
JWT nebo statický SQL test není náhradou živého RLS/OAuth scénáře.
