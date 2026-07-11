# Autorizační hranice kategorií poptávek

## Účel

`public.demand_categories` obsahuje rozpočtová a termínová data projektu včetně
metadat `budget_attachment`. Tabulka je dostupná webovému klientovi přes
Supabase Data API, a proto je její primární autorizační hranicí databázové RLS.

Post-deploy kontrola migrace `20260701230000` odhalila tři současně aktivní
legacy politiky. Politika `Enable all access for authenticated users` měla
nepodmíněné `USING` i `WITH CHECK` a jako permisivní politika přebíjela
projektová omezení. Hotfix `20260711201151_harden_demand_categories_rls.sql`
tento stav odstraňuje.

## Autorizační kontrakt

| Operace | Povolení |
| --- | --- |
| SELECT | vlastník projektu, libovolný aktuálně sdílený uživatel nebo viditelný demo projekt |
| INSERT | vlastník projektu nebo explicitní editor |
| UPDATE | vlastník projektu nebo explicitní editor; kontroluje se původní i výsledný řádek |
| DELETE | vlastník projektu nebo explicitní editor |
| `anon` | žádná tabulková oprávnění |

Skrytý demo projekt nesmí vracet své kategorie. Samotná příslušnost k organizaci
ani znalost `project_id` nezakládá přístup. UI filtry jsou pouze defense-in-depth
a nesmějí nahrazovat RLS.

## Tabulková oprávnění

Role `authenticated` má pouze `SELECT`, `INSERT`, `UPDATE` a `DELETE`. Nemá
`TRUNCATE`, `REFERENCES` ani `TRIGGER`, protože tyto operace RLS nechrání a
klientská aplikace je nepotřebuje. `service_role` zůstává beze změny pro
důvěryhodné serverové workflow.

## Výkon

Hotfix vytváří index `idx_demand_categories_project_id`. Sloupec je foreign key
do `projects(id)` a používají ho všechny projektové RLS kontroly i běžné
aplikační dotazy.

## Ověření

Automatický migrační kontrakt kontroluje:

- odstranění všech tří známých legacy politik,
- absenci nepodmíněného zápisového pravidla,
- čtyři oddělené CRUD politiky pouze pro `authenticated`,
- owner/share/demo pravidlo pro SELECT,
- owner/editor pravidlo a `WITH CHECK` pro zápisy,
- least-privilege grants a index `project_id`.

Po deployi je nutné ověřit katalog `pg_policies`, `information_schema` grants,
existenci indexu a znovu spustit Supabase security a performance advisors.
Statický test nenahrazuje živý RLS test s role impersonation.

## Rollback

Preferuje se dopředná opravná migrace. Návrat permisivní politiky je zakázaný.
Pokud hotfix odhalí chybějící legitimní scénář, rozšíří se konkrétní
projektová podmínka a zachová se oddělení read/write politik i omezené grants.
