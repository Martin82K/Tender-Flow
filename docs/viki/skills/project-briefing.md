# project-briefing

## Identita
- TS symbol: `projectBriefingSkill`
- `manifest.id`: `project-briefing`
- `manifest.name`: `Projektový briefing`
- Risk: `read`
- Requires project: ano

## Účel
Rychlé stručné shrnutí aktivního projektu (stav, finance, základní doporučení).

## Trigger / matching
- Typické dotazy: `briefing projektu`, `shrnutí projektu`, `stav projektu`, `přehled projektu`.

## Vstupní data
- Aktivní projekt (`selectedProjectId`) + `projectDetails`.
- Kategorie projektu (`categories`) a jejich rozpočtová pole.

## Výstup
Kompaktní textové shrnutí:
- lokalita
- fáze
- počet kategorií
- součty plán/SOD
- rozdíl
- doporučení

## Bezpečnost a limity
- Bez aktivního projektu vrací bezpečnou hlášku.
- Skill je read-only.
- Výstup je dále guardovaný orchestrátorem.

## Zdrojové soubory
- Implementace: `features/agent/skills/projectBriefingSkill.ts`
- Testy: `tests/agentOrchestrator.test.ts`
