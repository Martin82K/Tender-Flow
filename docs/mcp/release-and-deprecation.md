# Release a deprecation policy MCP

Stav: lokální politika Tender Flow MCP od 2026-08-09
Vztah ke standardu: respektuje minimálně dvanáctiměsíční deprecation okno MCP

## Verzování

Sledujeme tři nezávislé verze: MCP protokolovou revizi (aktuálně
`2026-07-28`), serverovou implementaci (`McpServer` nyní `0.6.0`) a jednotlivé
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

MCP runtime se vydává samostatným Vercel projektem z `mcp-service/`. Změna jen
v `server/mcp/`, `shared/mcp/` nebo `mcp-service/` nesmí vyžadovat nový webový
ani desktopový release. Aplikační build je nutný pouze při změně UI nebo
aplikačního kontraktu; rozhodnutí je fail-safe v `scripts/vercel-build-scope.mjs`.
Nový tool lze přidat do existující skupiny oprávnění bez buildu aplikace jen
tehdy, když jeho data a dopad odpovídají již zobrazenému souhlasu. Materiálně
širší data, nový typ rizikové akce nebo slabší potvrzovací režim vyžadují novou
interní permission, aktualizovaný UI souhlas a aplikační release; nesmí se
tiše schovat pod existující trvalý grant.

Změna názvu, popisu, schématu, anotací nebo autentizace toolu vyžaduje po
nasazení také obnovu metadata snapshotu v ChatGPT. U developer-mode připojení
se použije **Refresh**. U publikovaného pluginu je nutné znovu spustit
**Scan Tools**, ověřit nalezený kontrakt, odeslat a publikovat novou verzi.
Samotné nasazení MCP endpointu snapshot publikovaného pluginu nezmění.

## Deprecation

Breaking capability se nejprve označí jako deprecated v katalogu, dokumentaci
a changelogu, dostane náhradu a migrační příklad. Běžná lhůta je nejméně
12 měsíců, pokud aktivní zranitelnost nevyžaduje rychlejší revokaci. Bezpečnostní
revokace musí mít incidentní záznam, dopad a bezpečnou alternativu.

Legacy stateless kompatibilita není bezčasá garance. Její ukončení vyžaduje
inventuru klientů, telemetrii bez PII, migrační plán a explicitní release note.
Starý lokální desktop server byl odstraněn 2026-08-11; nebyl součástí veřejného
MCP 2.0 kontraktu.
