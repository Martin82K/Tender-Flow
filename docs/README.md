# Technická dokumentace Tender Flow

Tento adresář obsahuje provozní, architektonické a integrační dokumenty, které
doplňují pravidla repozitáře v `AGENTS.md`.

## Architektura

- [Načítání a viditelnost projektů](architecture/project-query-boundary.md) –
  vlastnictví query hooku, bezpečnostní hranice, výkonové invarianty, testovací
  plán a postup migrace z legacy vrstvy.

## Provoz a integrace

- [Lokální statický deploy](local-static-deploy.md)
- [Audit analytiky a telemetrie](analytics-telemetry-audit.md)
- [Agent skills](agent-skills.md)
- [Release dokumentace](releases/README.md)

Dokumentace chování se aktualizuje ve stejném PR jako změna kódu. Testovací
důkazy v PR popisují konkrétní spuštěné příkazy a výsledky; tento adresář drží
dlouhodobě platné kontrakty a provozní rozhodnutí.
