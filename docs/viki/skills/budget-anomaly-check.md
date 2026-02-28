# budget-anomaly-check

## Identita
- TS symbol: `budgetAnomalySkill`
- `manifest.id`: `budget-anomaly-check`
- `manifest.name`: `Analýza rozpočtu`
- Risk: `read`
- Requires project: ano

## Účel
Najít a prioritizovat největší odchylky mezi interním plánem a SOD položkami.

## Trigger / matching
- Typické dotazy: `rozpočet`, `odchylka`, `překročení`, `bilance`, `náklady`.

## Vstupní data
- Aktivní projekt + kategorie (`planBudget`, `sodBudget`).

## Výstup
- Počet pozitivních/negativních odchylek
- TOP odchylky podle absolutní hodnoty
- Doporučení k ověření příčin

## Bezpečnost a limity
- Bez aktivního projektu vrací bezpečnou hlášku.
- Při prázdných kategoriích vrací informaci, že není co analyzovat.
- Skill je read-only.

## Zdrojové soubory
- Implementace: `features/agent/skills/budgetAnomalySkill.ts`
- Testy: `tests/agentOrchestrator.test.ts`
