# TODO — Asynchronní porovnání nabídek

- [x] Zapsat a exportovat finální plán implementace do `.agent`.
- [x] Přidat desktop engine pro porovnání nabídek (`bidComparisonEngine.ts`).
- [x] Přidat desktop job runner (`bidComparisonRunner.ts`) s async stavy/progressem.
- [x] Přidat IPC kontrakt pro bid comparison (detect/start/get/list/cancel).
- [x] Rozšířit `ElectronAPI` typy + preload bridge o `bidComparison` API.
- [x] Implementovat detekci vstupních souborů ze složky VŘ (zadání vs nabídky).
- [x] Implementovat UI panel v detailu VŘ pro mapování souborů a spuštění jobu.
- [x] Přidat polling stavu jobu + logy + progress bar.
- [x] Ukládat výstupy do kořene VŘ (`latest` + archiv timestamp).
- [x] Přidat podporu kol a variant (nová nabídka ve stejném kole = nová varianta).
- [x] Přidat `trackFeatureUsage('bid_comparison', ...)` (pokud je feature key dostupný).
- [x] Dopsat unit testy pro engine a detekci vstupů.
- [x] Spustit `npm run test:run -- tests/bidComparisonEngine.test.ts`.
- [x] Spustit `npm run desktop:compile` a opravit případné TS chyby.
