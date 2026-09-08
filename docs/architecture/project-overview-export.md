# Export přehledu stavby do Excelu

V záložce stavby **Přehled** je před lištou filtrů samostatná nenápadná ikona stahování, mimo rámeček lišty. Její nápověda a přístupný název jsou **Export do Excelu**.
Stáhne soubor `prehled_<stavba>_<cas-UTC>.xlsx` se dvěma listy:

- **Přehled stavby**: údaje o stavbě, finance investora, interní rozpočet a parametry smlouvy. Finanční souhrn vždy zahrnuje celou stavbu.
- **Poptávky**: aktuální filtr, hledání, zvolené sloupce a české abecední řazení. Export obsahuje i řádky pod „Zobrazit více“. Součet exportovaných řádků a při omezeném výběru také celková bilance stavby mají samostatně označené řádky. Dodatečné filtrování přímo v Excelu tyto uložené součty nepřepočítává.

Oba listy obsahují vložené logo Tender Flow, název stavby, zdroj `Tender Flow → stavba → Přehled` a datum i čas exportu v pásmu `Europe/Prague`. Částky jsou číselné buňky s formátem Kč, nikoliv text. Nulová vítězná nabídka zůstává nulou; chybějící vítěz má prázdnou cenu a rozdíly. Záhlaví poptávek je ukotvené a opakuje se při tisku na šířku.

Tlačítko je dostupné také u stavby bez poptávek. Po dobu exportu blokuje další kliknutí; chyba nabídne opakování bez zobrazení interních detailů.

## Implementace a bezpečnost

`features/projects/api/projectOverviewExportApi.ts` používá existující model přehledu pro výběr kategorií, vítězné nabídky a finance. Vychází pouze z dat předaných aktuální obrazovkou; nenačítá další projekty, nevolá server a nemění oprávnění ani databázi. Zdroj je čitelná cesta v aplikaci, ne aktuální URL s případnými citlivými parametry.

ExcelJS se načítá až po kliknutí. Používá se stávající závislost a lokální logo. Uživatelské řetězce zůstávají textem; počátky `=`, `+`, `-`, `@` po bílých znacích dostanou ochranný apostrof. Export nevytváří makra, vzorce ani externí odkazy. Název souboru je omezený na bezpečné znaky a délku. Dočasný odkaz se odstraní a blob URL se uvolní po krátké prodlevě pro dokončení stahování.

Regrese: `tests/projectOverviewExport.test.ts` a `tests/ProjectOverviewNew.export.test.tsx`. Ověřují serializaci a opětovné otevření XLSX, logo, metadata, finance, filtry, sloupce, více vítězů, nuly, prázdný výběr, více než deset kategorií, text místo vzorců, stahování, opakované kliknutí a zotavení z chyby.

Při úvodní kontrole 8. 9. 2026 GitHub Code Scanning hlásil chybějící analýzu a Dependabot alerts byly vypnuté. Tyto signály nenahrazují lokální kontrolu a nelze je vykázat jako úspěšné bezpečnostní skeny. Změna neinstaluje ani neaktualizuje balíčky.
