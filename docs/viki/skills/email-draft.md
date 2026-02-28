# email-draft

## Identita
- TS symbol: `emailDraftSkill`
- `manifest.id`: `email-draft`
- `manifest.name`: `Návrh emailu`
- Risk: `read`
- Requires project: ne

## Účel
Vygenerovat draft emailu pro dodavatele nebo interní tým.

## Trigger / matching
- Typické dotazy: `napiš email`, `připrav email`, `draft email`.

## Vstupní data
- Volitelně aktivní projekt (pro doplnění názvu projektu do předmětu/textu).

## Výstup
- Předmět + text emailu připravený k odeslání/upravě.

## Bezpečnost a limity
- Skill je read-only.
- Výstup je guardovaný orchestrátorem.

## Zdrojové soubory
- Implementace: `features/agent/skills/emailDraftSkill.ts`
- Testy: `tests/agentOrchestrator.test.ts`
