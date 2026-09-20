# Ovládání rozpočtu a osobní VŘ

Migrace `20260920182433_budget_lock_and_personal_tenders.sql` přidává privátní
stav zámku projektu a osobní číselník VŘ. Tabulky mají RLS a odebrané přímé granty.
Veřejné RPC jsou security invoker; privátní implementace kontrolují identitu,
oprávnění a optimistickou verzi. Společný základ má 14 definic a je poskytován
pouze při absenci osobního záznamu. Nevzniká plošný backfill existujících projektů.

Zámek se serializuje na řádku projektu a triggery chrání zdroje, revize a volbu
hlavní verze. Import samotných definic kontroluje zámek také. Oprávněný trvalý
výmaz projektu je zvláštní životní cyklus; aktivní projektový purge job dovolí
jeho dokončení. Změny autorství na NULL jsou povolené pouze beze změny obsahu.
Projektový číselník a import sdílí advisory lock; pořadí zámků zůstává stejné.

Osobní definice se kopírují pouze uvnitř `create_project_with_team`; nikoliv při
klonování ani při obnově. Neukládají ceny, alokace ani odkazy na původní VŘ.
Osobní data zanikají kaskádově s účtem, projektové kopie zůstávají nezávislé.
Podepsané rozšíření zálohy `budget_editor_settings` uchovává zámky a osobní
základ exportujícího uživatele. Osobní část obnovuje pouze tentýž účet v uživatelské
obnově; tenant restore ji nepřevádí na správce. Obnova doplňuje chybějící nastavení,
nepřepisuje aktuální. Starší zálohy bez rozšíření zůstávají kompatibilní.

## Regresní ověření

Základna implementace: `b63ef1ea5e31ba47412906b5f85c6a2d068f213f`.
Kontroly jsou vázané na pracovní diff této změny; finální commit a integrační
základnu eviduje PR a jeho CI. Před změnou zachyceny RED výsledky pro výběr/buňku,
SQL bez nové migrace, tlačítko výchozího číselníku a společný základ.

- `npm run test:run -- tests/constructionBudgetTable.test.tsx tests/constructionBudgetSettings.test.tsx tests/constructionBudgetTenderCatalog.test.tsx tests/constructionBudgetTenderTemplates.test.tsx tests/constructionBudgetRevisions.test.ts tests/constructionBudgetVersions.test.tsx`: cílené interakce, hromadné přiřazení a zachování vazeb.
- `PGLITE_MODULE=<audited PGlite entry> node --test tests/postgres/*.test.mjs`:
  skutečné SQL v izolovaném PostgreSQL/WASM, vlastní a cizí účet, anonym,
  privátní granty, konflikty verzí, kopie, společný základ, zámek, backup a mazání.
  Fixture stubuje stávající autorizační pomocníky; nejde o důkaz celé cloudové RLS.
- `npm run typecheck`, `npm run build`, `npm run check:boundaries`,
  `npm run check:legacy-structure`, `npm run check:docs`.
- Playwright v Chromu, 1440×1000 a 390×844, izolovaný fixture nad skutečnými
  komponentami: klik, dvojklik, přiřazení, zámek/import, výchozí číselník.
  Fixována změna pozice řádku po prvním kliknutí a přetečení navigace na mobilu.
  Produkční přihlášení ani skutečná zákaznická data nejsou součástí tohoto průchodu.

Build hlásí existující upozornění na velikost chunků. GitHub code-scanning při
preflight vrací `no analysis found` (404); nejde o úspěšnou bezpečnostní kontrolu.
Supabase advisor před změnou hlásí existující upozornění (search_path, veřejně
spustitelné definer funkce, ochrana uniklých hesel). Posuzovat pouze nové signály
oproti této základně; nezaměňovat dostupnost RPC za prokázanou zranitelnost.
