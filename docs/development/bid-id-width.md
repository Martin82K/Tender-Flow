# Dlouhá ID nabídek při importu a obnově

Migrace `20260912190251_widen_bid_and_tag_ids.sql` rozšiřuje `public.bids.id` a `public.bid_tags.bid_id` na `text`. Zachovává celé ID, primární klíče a cizí klíče včetně `ON DELETE CASCADE`. Neprovádí backfill, změnu zákaznických vazeb ani změnu UI. Historické migrace zůstávají nezměněné. Pole `contracts.source_bid_id` již rozšířila samostatně nasazená migrace `20260912172814_widen_contract_source_bid_id.sql`.

## Příčina a rozsah auditu

Počáteční schéma vytváří obě pole jako `varchar(36)`. Propojená DB má `bids.id` již `text`, ale `bid_tags.bid_id` stále `varchar(36)`. Přiřazení syntetického 54znakového řetězce do `bid_tags.bid_id%TYPE` vrací PostgreSQL `22001`; zákaznická data tento test nemění.

Audit všech tabulkových sloupců souvisejících s ID nabídky a příchozích FK našel čtyři cesty:

| Sloupec | Před migrací v propojené DB | Výsledek |
| --- | --- | --- |
| `public.bids.id` | text; initial migration varchar(36) | text v obou variantách |
| `public.bid_tags.bid_id` | varchar(36), FK na bids | text, stejný FK |
| `public.contracts.source_bid_id` | text, bez FK | beze změny |
| `mcp_private.outlook_message_links.bid_id` | text, FK na bids | beze změny |

Obě restore funkce předávají ID z JSON přes `->>` přímo do tabulek; nekrátí je a nekonvertují na UUID. Export používá textová pole a `TEXT[]`. Ochranné wrappery zachovávají členství/admin roli organizace, verzi zálohy a limit 50 MB. `insert_pipeline_bids` používá `bids%ROWTYPE` a `jsonb_populate_record`, tedy přebírá limit tabulky. Klientské repository předává ID jako `string`. Proměnná `v_new_bid_id varchar(36)` při klonování dostává nové UUID; původní ID čte funkce do `RECORD`, takže nejde o další omezení importovaných ID. MCP kontrola délky 100 znaků stávající 54znakové ID přijímá.

Čtyři `team_module_bid_tags_*` policies závisí přímo na měněných sloupcích. Migrace je po uzamčení tabulek načte z katalogu, v témže atomickém `DO` odstraní, změní typy a obnoví. Zachovává příkaz, role, `PERMISSIVE`/`RESTRICTIVE`, `USING`, `WITH CHECK` i komentáře. RLS nevypíná a nepřidává granty. Neočekávaná policy na jiné tabulce nebo jiná blokující závislost způsobí chybu a rollback celé operace. `lock_timeout=5s` a `statement_timeout=60s` omezují čekání; zámek může krátce blokovat čtení i zápis. Nasazovat při nízkém provozu.

Široká permissive policy štítků se kombinuje s restrictive pravidly projektu a předplatného. Samotné `USING(true)` proto nedokazuje obejití izolace. Při obnově policies je zásadní nezaměnit restrictive pravidla za permissive. Změna typu může v katalogovém zápisu odstranit nadbytečné `::text` a závorky; porovnávat i význam, nikoli jen textový hash policies.

## Reprodukce a lokální ověření

`tests/postgres/bidIdWidth.test.mjs` používá izolovaný PostgreSQL v paměti. Nemá parametr pro produkční spojení. Používá nezměněný initial SQL, skutečný blok RLS migrace, skutečné smyčky obnovy nabídek/štítků a skutečné RPC `insert_pipeline_bids`. Identita projektu v pomocné autorizační funkci je syntetická. Nejde o úplný replay všech Supabase migrací ani end-to-end obnovu zákaznické zálohy; související typy, vazby a SQL cesty se ověřují cíleně.

Pro tento běh byl mimo projekt v `/tmp` použit přesně `@electric-sql/pglite@0.5.8`. Před instalací byl ověřen registr, repozitář ElectricSQL, správci, release/commit historie a veřejná bezpečnostní oznámení. Následný audit našel 0 známých zranitelností a ověřil 1 podpis registru a 1 provenance attestation. Runtime byl instalován s `--ignore-scripts`; závislosti ani lockfile aplikace se nemění. Při opakování je nutné znovu prověřit použitý runtime podle AGENTS.md.

```sh
PGLITE_MODULE=/absolute/path/to/audited/pglite/dist/index.js node --test tests/postgres/bidIdWidth.test.mjs
npm run test:run -- tests/bidIdWidthMigration.test.ts tests/backupService.localAdapter.test.ts tests/contractService.bidLink.test.ts tests/bidsWriteRlsHardeningMigration.test.ts
```

Před opravou tři databázové scénáře selhaly na přetrvávajícím `varchar(36)`. Po opravě testy ověřují původní schéma, živý typový drift, variantu bez závislých policies, rollback při blokujícím view a skutečný pipeline import. Pokrývají 54znaková ID se stejným 36znakovým prefixem, opakovanou obnovu, zákaz cizího projektu, CRUD vlastních štítků, nepřihlášený přístup, FK, unikátnost, kaskádu, původní data, ACL, RLS, indexy a policies. Dva statické guard testy migrace běží v běžné Vitest sadě; PostgreSQL scénáře mají samostatný příkaz výše.

Lokální validace: 514 Vitest souborů / 2 746 testů a 5 PostgreSQL scénářů prošlo bez skipped/todo. Prošly typecheck, web build, desktop TypeScript `--noEmit`, docs, boundaries a legacy structure. Browser fixture ověřila 12 skin/mode kombinací, interakce, navigaci a nulové console/network chyby. Sestavená aplikace načetla úvod a navigaci na přihlášení; konzole obsahovala pouze očekávané upozornění na chybějící uživatelskou relaci. Nový worktree používá pro testy neprodukční CI konfiguraci. Build hlásí existující velké chunky a neúčinný dynamic import; tyto změna migrace neřeší. Desktop runtime ani zákaznická obnova nebyly spuštěny.

## Produkční preflight a nasazení

Stav přípravy 12. 9. 2026: **nenasazeno; vyžaduje samostatný konkrétní souhlas uživatele**. CLI 2.70.5 `db push --dry-run` nabízí pouze `20260912190251_widen_bid_and_tag_ids.sql`. Dry-run porovnává historii migrací; sám SQL nevykonává ani neověřuje jeho úspěch.

Read-only dotaz [bid-id-width-preflight.sql](../../supabase/tests/bid-id-width-preflight.sql) vrací počty, kontrolní součty, typy, ACL, RLS, policies, FK, indexy, triggery a otisky restore funkcí bez obsahu zákaznických řádků. Při přípravě:

| Cesta | Počet | Další kontrola |
| --- | ---: | --- |
| Nabídky | 2 887 | 2 764 ID nad 36 znaků, maximum 54 |
| Štítky v bid_tags | 0 | 0 osiřelých vazeb |
| Smlouvy | 73 | 1 neprázdná vazba source_bid_id |
| Outlook vazby | 14 | 0 osiřelých vazeb |

Ve vybrané stavbě zůstává 30 nabídek, 29 s dlouhým ID, maximum 54. Čísla jsou okamžitý snímek, před nasazením je znovu ověřit.

Po schválení:

1. Zopakovat preflight a uložit výsledek; ověřit, že se nezměnily závislosti ani cílový projekt `vpvowigatikngnaflkyk`.
2. Zopakovat `db push --dry-run`; nasazení smí obsahovat jen tuto migraci. Předchozí migraci smluv neopakovat ani neopravovat její historii.
3. Nasadit verzovanou migraci. Při timeoutu ověřit rollback; neprodlužovat automaticky blokování aplikace.
4. Zopakovat preflight a porovnat data, vazby, ACL, RLS, policies, constraints, indexy, triggery a funkce. Očekávaná změna v živé DB je pouze typ `bid_tags.bid_id` a ekvivalentní katalogový zápis čtyř policies.
5. Ověřit 54znakovou syntetickou hodnotu přes `%TYPE` bez změny zákaznických vazeb. Spustit security/performance advisors a finální `db push --dry-run`, který musí hlásit aktuální DB.

Bezpečnostní signály při přípravě: GitHub Code Scanning vrací 404 (bez analýzy), Dependabot alerts 403 (disabled). Advisors mají existující nálezy: security 8 bez-policy RLS objektů, 38 mutable search paths, 132 anon a 159 authenticated executable security-definer funkcí, 1 vypnutá ochrana proti uniklým heslům; performance 66 neindexovaných FK, 119 RLS initplan, 39 unused indexes, 160 multiple permissive policies a 1 nastavení připojení. Na bids je například [opakované vyhodnocování auth funkcí](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan). Migrace tyto nesouvisející nálezy neopravuje; nejde o potvrzení bezpečnosti celé DB.
