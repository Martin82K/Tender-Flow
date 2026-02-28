# deep-project-briefing

## Identita
- TS symbol: `deepProjectBriefingSkill`
- `manifest.id`: `deep-project-briefing`
- `manifest.name`: `Detailní reporting projektu`
- Uživatelský label: `Shrnutí projektu`
- Risk: `read`
- Requires project: ano

## Účel
Nestranný detailní report aktivního projektu pro manažerské rozhodování (vedení společnosti), včetně KPI, rizik, tabulek a ASCII grafů.

## Hodnoticí rámec (prompt)
Skill používá interní hodnoticí rámec vedoucího projektu (ekonomika + realizace + rizika + nestrannost), který je součástí implementace skillu.

## Trigger / matching
- Typické dotazy: `detailní report projektu`, `podrobný report`, `detailnější výstup`, `KPI projektu`, `rizika projektu`.
- Skill má zvýšenou prioritu v registru, aby pokryl požadavky na detailní analýzu.

## Vstupní data
- Aktivní projekt z runtime (`selectedProjectId`).
- `projects`, `projectDetails`, `contacts`, `contextScopes`, `audience`, `activeProjectTab`.
- Projektová data: kategorie, rozpočty (`planBudget`, `sodBudget`), nabídky (`bids`), investor financials, termíny, role na stavbě.

## Výstup
Markdown report ve struktuře:
- Executive summary
- KPI přehled (tabulka)
- Grafy (ASCII)
- Kategorie a ekonomika (tabulka)
- Nabídky (detail)
- Rizika
- Doporučené kroky
- Datová stopa reportu

## Bezpečnost a limity
- Bez aktivního projektu vrací bezpečnou hlášku.
- Skill je read-only (bez write/delete operací).
- Musí respektovat stávající guard chain v orchestrátoru.
- Platí pravidlo: shrnovat jen projekt dostupný aktuálnímu uživateli.

## Zdrojové soubory
- Implementace: `features/agent/skills/deepProjectBriefingSkill.ts`
- Registrace: `features/agent/skills/index.ts`
- Testy: `tests/deepProjectBriefingSkill.test.ts`
