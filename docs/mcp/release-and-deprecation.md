# Release a deprecation policy MCP

Stav: lokální politika Tender Flow MCP od 2026-08-09
Vztah ke standardu: respektuje minimálně dvanáctiměsíční deprecation okno MCP

## Verzování

Sledujeme tři nezávislé verze: MCP protokolovou revizi (aktuálně
`2026-07-28`), serverovou implementaci (`McpServer` nyní `0.3.0`) a jednotlivé
skill/kontrakt verze. Změna interní implementace bez změny schématu není
automaticky nový protokol. Přidání nepovinného pole je additive; odstranění
nebo přejmenování toolu, resource, scope či významu pole je breaking změna.

## Release gate

- shoda tool/resource/scope dokumentace s kódem,
- focused a full test suite, typecheck, build a boundary checks,
- bezpečnostní review diffu a vyřešené review thready,
- OAuth/RLS runtime canary pro změněnou cestu,
- audit a observabilita bez secretů,
- migration dry-run a catalog/advisor kontrola u DB změn,
- green GitHub Actions a hosting preview/production checks.

## Deprecation

Breaking capability se nejprve označí jako deprecated v katalogu, dokumentaci
a changelogu, dostane náhradu a migrační příklad. Běžná lhůta je nejméně
12 měsíců, pokud aktivní zranitelnost nevyžaduje rychlejší revokaci. Bezpečnostní
revokace musí mít incidentní záznam, dopad a bezpečnou alternativu.

Legacy stateless compatibility a samostatný `desktop MCP` nejsou bezčasá
garance. Jejich sjednocení nebo ukončení vyžaduje inventuru klientů, telemetrii
bez PII, migrační plán a explicitní release note.
