# Implementační plán: Asynchronní porovnání nabídek (Tender Flow)

## Cíl
Implementovat porovnání cenových nabídek ve výběrovém řízení tak, aby:
- běželo asynchronně na pozadí,
- uživatel nemusel čekat na dokončení,
- fungovalo nad soubory ve složce konkrétního VŘ,
- podporovalo další nabídky i další kola jako nové varianty porovnání.

## Umístění ve UI
- Funkce bude v detailu konkrétního VŘ (`Pipeline` detail category), ne jako samostatný project tab.
- Přidá se akce `Porovnání nabídek` do headeru detailu VŘ.

## Režim běhu
- Primárně `Desktop lokálně` (Electron main process), asynchronně mimo renderer UI.
- Job běží při otevřené aplikaci (bez persistence po restartu v1).

## Vstupy a mapování souborů
- Systém načte složku VŘ (DocHub cesta projektu + tenders + název kategorie).
- Rekurzivně vyhledá `.xlsx` soubory.
- Pro každý soubor proběhne analýza:
  - detekce hlavičky,
  - detekce sloupců,
  - počet `Typ=K` řádků,
  - počet oceněných položek (`J.cena` číselná),
  - kandidát na `zadání` vs `nabídka`.
- UI nabídne auto-mapování + ruční korekci rolí (Ignorovat / Zadání / Nabídka konkrétního dodavatele).

## Kola a varianty
- Každá nabídka bude mít metadata:
  - `supplierName`,
  - `round` (výchozí 0; heuristika z názvu souboru),
  - `variant` (index v rámci stejného dodavatele a kola, podle času).
- Nová nabídka ve stejném kole = nová varianta (`v2`, `v3`, ...).
- Další kolo = nový blok (`K1`, `K2`, ...).
- Výstup přidá sloupce po dvojicích (`J.cena`, `Celkem`) pro každou kombinaci `kolo+varianta+dodavatel`.

## Výstup
- Generuje se vždy nově ze zadání (deterministicky), ne inkrementálním přepisem starého XLSX.
- Uložení do kořene složky VŘ:
  - archiv: `porovnani_nabidek_YYYYMMDD_HHmmss.xlsx`
  - latest: `porovnani_nabidek_latest.xlsx`

## Technická architektura
### Desktop main process
- `bidComparisonEngine.ts`
  - čtení + párování + generování XLSX podle pravidel,
  - párování primárně `Kód`, fallback `PČ`,
  - vzorce `Celkem = J.cena * Množství`,
  - rekapitulace a formátování.
- `bidComparisonRunner.ts`
  - in-memory job queue,
  - stavy jobu (`queued/running/success/error/cancelled`),
  - progress/logging callback.
- IPC handlers:
  - `bid-comparison:detect-inputs`
  - `bid-comparison:start`
  - `bid-comparison:get`
  - `bid-comparison:list`
  - `bid-comparison:cancel`

### Renderer
- `BidComparisonPanel.tsx`:
  - načtení kandidátů,
  - ruční korekce mapování,
  - spuštění jobu,
  - polling stavu,
  - otevření výsledku/složky.

## Testy
- Unit testy engine:
  - detekce hlavičky/sloupců,
  - párování kód/PČ,
  - ignorování vzorců při čtení cen,
  - generace sloupců pro varianty.
- Unit testy analyzátoru vstupů.
- Hook/UI test polling logiky.
- Smoke test: `npm run desktop:compile` + `npm run test:run -- tests/bidComparisonEngine.test.ts`.
