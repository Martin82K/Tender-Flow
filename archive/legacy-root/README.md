# Legacy Root Karanténa

Tato složka obsahuje historické soubory přesunuté z kořene repozitáře během refaktoru struktury.

## Proč existuje
- Umožňuje snížit šum v kořenové složce bez nevratného mazání.
- Udržuje auditovatelnou stopu přesunů a důvodů.

## Aktuálně přesunuté soubory
- `dashboard.tsx` (nepoužívaný prototyp UI)
- `20260204145000_org_join_requests.sql` (prázdný SQL soubor)
- `20260204150000_notifications.sql` (prázdný SQL soubor)
- `20260204161000_projects_owner_only_visibility.sql` (prázdný SQL soubor)

## Jak vrátit soubor zpět
1. Ověřit, že je soubor opravdu potřeba v runtime nebo release flow.
2. Vrátit jej zpět explicitním `git mv` do cílové cesty.
3. Aktualizovat dokumentaci v `docs/refactor-baseline.md`.
