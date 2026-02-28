# Viki skills katalog

## Naming conventions
- TS symbol: `camelCase` + sufix `Skill` (např. `projectBriefingSkill`).
- `manifest.id`: `kebab-case` (např. `project-briefing`).
- Uživatelský label: český název akce ve Viki UI (např. `Shrnutí projektu`).
- Dokumentace skillu: `docs/viki/skills/<manifest-id>.md`.

## Skill kontrakt
Zdroj: `features/agent/skills/types.ts`
- `manifest`: identita, popis, klíčová slova, risk, požadavek na aktivní projekt.
- `match(input)`: skórování relevance 0..1.
- `run(input)`: vlastní odpověď skillu.
- `pendingAction`: volitelné potvrzované akce (aktuální registry je read-only).

## Registry (aktuální)
Pořadí je definováno v `features/agent/skills/index.ts`:
1. `deepProjectBriefingSkill`
2. `projectBriefingSkill`
3. `tenderSummarySkill`
4. `budgetAnomalySkill`
5. `emailDraftSkill`

## Aktivní skilly (detailní dokumentace)
- [`deep-project-briefing`](./skills/deep-project-briefing.md)
- [`project-briefing`](./skills/project-briefing.md)
- [`tender-summary`](./skills/tender-summary.md)
- [`budget-anomaly-check`](./skills/budget-anomaly-check.md)
- [`email-draft`](./skills/email-draft.md)

## Doc drift checklist
- Každý nový skill soubor ve `features/agent/skills/` musí mít vlastní soubor v `docs/viki/skills/` podle `manifest.id`.
- Při změně triggerů, risk levelu nebo výstupu skillu je nutná synchronní aktualizace příslušného skill `.md` souboru.
