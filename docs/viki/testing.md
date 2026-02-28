# Viki testování

## Test matrix

### Unit
- `tests/agentOrchestrator.test.ts`
  - výběr skillu
  - fallback logika
  - guard chain chování
- `tests/vikiContextPolicy.test.ts`
  - internal/client context
  - blokace interních/role/citlivých výstupů
- `tests/vikiModelCatalog.test.ts`
  - model catalog a fallbacky
- `tests/manualKnowledge.test.ts`
  - retrieval z příručky, admin filtering, citace
- `tests/useAgentController.voiceInteractionMode.test.ts`
  - persist/fallback voice režimů

### UI integrační
- `tests/AgentFloatingPanel.test.tsx`
  - rendering panelu
  - nastavení
  - voice ovládání

### Security integrační (povinné scénáře)
- Nepovolený přístup ke cizímu projektu musí skončit odmítnutím.
- Client režim nesmí vracet interní fráze.
- Ne-admin uživatel nesmí získat admin obsah.
- Citlivé technické výrazy musí být guardované.

### Budoucí testy pro `deep-project-briefing`
- quick návrh `Shrnutí projektu` v UI
- disabled stav bez aktivního projektu
- autorizace pouze nad dostupným projektem
- konzistence label vs `manifest.id` vs TS symbol

## Acceptance checklist
- [ ] Každý skill v kódu má kartu v `docs/viki/skills-catalog.md`.
- [ ] Každý guard v `app/agent/contextPolicy.ts` je popsaný v `docs/viki/security-model.md`.
- [ ] `docs/viki/README.md` obsahuje validní odkazy na všechny poddokumenty.
- [ ] `docs/viki/changelog.md` má záznam změny.
- [ ] U změn behavior Viki je v PR checklistu položka `Viki docs updated`.

## Lokální běh testů
- Vše: `npm run test:run`
- Selektivně: `npm run test:run -- tests/agentOrchestrator.test.ts tests/vikiContextPolicy.test.ts`
