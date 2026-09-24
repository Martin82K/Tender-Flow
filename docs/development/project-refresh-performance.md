# Obnovování projektu a výkon nabídek

## Databáze

Migrace `20260924221934_optimize_bid_select_policy_sets.sql` převádí dvě SELECT
politiky nabídek na množiny dostupných kategorií vyhodnocené v rámci dotazu.
Původní výraz pro přístup vlastníka, organizace, sdílení a viditelného dema
zůstává zachován, stejně jako volání `can_project_module_action`.
Kategorie i projekty se stále čtou pod RLS volajícího. Nepřibývá oprávnění,
`SECURITY DEFINER`, persistentní cache oprávnění ani nová data.

Write politiky, tenantové předplatné, blokace přímého OAuth přístupu a MCP
politika se nemění. Podporován je aktuální `demand_category_id` i historický
`category_id`; ALTER POLICY zachovává role, permissive/restrictive a komentáře.
Schéma, FK, indexy a obchodní data se nemění, takže formát zálohy, obnova,
mazání vlastníka a kaskády zůstávají beze změny.

Regrese běží v izolovaném PostgreSQL/PGlite:

```sh
PGLITE_MODULE="$PWD/tests/postgres/node_modules/@electric-sql/pglite/dist/index.js" node --test tests/postgres/bidSelectPolicies.test.mjs
```

Test porovnává původní a nové výsledky pro vlastníka, členství, sdílení, skryté
demo, odebraný projekt/kategorii, zakázaný modul, neplatné předplatné, OAuth,
MCP a anonymní roli. Kontroluje data, grants, FK, indexy, ostatní politiky,
idempotenci a plán bez opakování obou SELECT lookupů pro každou nabídku.

Před deployem použít `supabase db push --linked --dry-run`; po deployi ověřit
katalog, počty, security/performance advisors a znovu dry-run bez čekajících
migrací. Měření EXPLAIN ANALYZE musí běžet pod rolí authenticated s odpovídajícími
JWT claims; administrátorský dotaz neodpovídá běžnému API. Produkční RLS se při
měření nevypíná. Do evidence patří pouze agregované metriky, žádná obchodní data.
