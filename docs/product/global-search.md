# Globální vyhledávání

Vyhledávání v hlavičce nebo přes Ctrl/Cmd+K najde projekty, kontakty, poptávky a při dostupném modulu také úkoly a smlouvy. Stačí nejméně dva znaky; hledání nerozlišuje diakritiku ani velikost písmen. Více slov musí odpovídat témuž výsledku. U úkolů hledá název a poznámku, u smluv název, číslo, dodavatele a název projektu.

Výběr úkolu otevře jeho detail v TODO. Vyhledatelné jsou také dokončené a archivované úkoly. Výběr smlouvy otevře její detail ve smlouvách daného projektu. Šipky a Enter vybírají výsledek; Esc vymaže dotaz a následně zavře hledání. Každá skupina nejprve ukazuje pět shod. Tlačítko „Zobrazit další výsledky“ postupně zpřístupní všechny nalezené shody.

Podklady úkolů a smluv se načítají až při otevření hledání. Dokud načítání neskončí, panel zobrazuje průběh. Při novém ověřování nebo chybě se předchozí index úkolů či smluv skryje, aby se nezobrazovala neověřená oprávnění. Ostatní dostupné skupiny výsledků zůstanou zobrazené. Chyba upozorní na neúplnost a nabídne zopakování pouze selhaného indexu.

## Technický kontrakt a ověření

Sdílený kontrakt výsledků je `shared/ui/GlobalSearch/types.ts`. Úkol používá `buildAppUrl('todo', { taskId })`, smlouva `buildAppUrl('project', { projectId, tab: 'contracts', contractId })`. Napojení zdrojů zůstává v aplikační vrstvě; sdílené vyhledávací UI neimportuje API jednotlivých funkcí.

Index úkolů i smluv čte minimální metadata po stránkách 500 záznamů, v deterministickém pořadí podle ID. Portfolio smluv se zpracovává po 100 projektech. Před dotazem na smlouvy se znovu ověří viditelnost projektů, dotaz se omezí na ověřená ID a odpověď se proti nim také filtruje. Úkoly se omezují na aktuálního vlastníka v dotazu i v odpovědi. Bez dostupného modulu se index nenačítá ani nezobrazuje; demo neprovádí tyto databázové dotazy.

Cache odděluje uživatele a u smluv také sadu projektů. Změna identity okamžitě skryje předchozí výsledky a zastaví pokračování starého stránkování. Indexy sdílejí jmenné prostory invalidací `tasks` a `contracts`; při každém opětovném otevření se také obnoví, aby se projevily úpravy smluv spravované lokálním stavem formuláře. Aplikační filtry doplňují serverovou autorizaci; nenahrazují ji. Změna neobsahuje migrace, oprávnění, tajné klíče ani nové závislosti.

Regrese pokrývají více než 1 000 úkolů/smluv, portfolio 205 projektů, zakázané moduly, neočekávané cizí řádky, změnu identity a projektových oprávnění, chybu stránky a opakování, přímé otevření smlouvy a zpřístupnění dalších výsledků. TODO seznam používá rovněž stránkování, aby detail úkolu nalezeného za první serverovou stránkou zůstal dostupný.

Cílový seznam smluv načítá celý projekt po stránkách 500 záznamů; související dodatky, faktury a čerpání také stránkuje a dávkuje po 100 ID smluv. Chyba libovolné stránky ukončí načítání místo zobrazení neúplných detailů. Nenalezený odkaz nikdy neotevře první jinou smlouvu. Nový odkaz přepne Investor či Dashboard do seznamu s detailem smlouvy. Po ruční změně záložky, zobrazení nebo vybrané smlouvy se spotřebované ID odstraní z adresy; další hledání stejné smlouvy ji tak znovu otevře.
