# tender-summary

## Identita
- TS symbol: `tenderSummarySkill`
- `manifest.id`: `tender-summary`
- `manifest.name`: `Sumarizace výběrka`
- Risk: `read`
- Requires project: ano

## Účel
Stručná sumarizace stavu výběrových řízení v aktivním projektu.

## Trigger / matching
- Typické dotazy: `výběrko`, `výběrové řízení`, `tender`, `poptávka`, `pipeline`.

## Vstupní data
- Aktivní projekt + `categories` + `bids`.
- Statusy kategorií (open/negotiating/closed/sod).

## Výstup
- Počty kategorií podle stavu
- Celkový počet nabídek
- TOP kategorie dle počtu nabídek
- Doporučení prioritizace

## Bezpečnost a limity
- Bez aktivního projektu vrací bezpečnou hlášku.
- Skill je read-only.
- Výstup je guardovaný orchestrátorem.

## Zdrojové soubory
- Implementace: `features/agent/skills/tenderSummarySkill.ts`
- Testy: `tests/agentOrchestrator.test.ts`
