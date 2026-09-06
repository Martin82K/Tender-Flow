# Uložení kategorie a obnova plánu VŘ

Vytvoření kategorie a návazná synchronizace plánu VŘ jsou dva samostatné kroky. Po potvrzeném uložení kategorie aplikace zobrazí průběh synchronizace. Při její chybě zůstává kategorie uložená a upozornění nabízí **Opakovat synchronizaci plánu VŘ**. Toto tlačítko neopakuje vytvoření kategorie. Upozornění zůstává dostupné i při navigaci uvnitř aplikace; po úspěchu lze potvrzení zavřít.

Formulář blokuje opakovaný submit synchronním příznakem ještě před prvním asynchronním krokem. Hook `useCategoryPlanRecovery` sdružuje opakované kliknutí do stejné probíhající operace podle projektu a ID kategorie, eviduje souběžné kategorie odděleně a při změně uživatele zahodí jejich stav. Již odeslaný zápis nelze zpětně zrušit, ale po změně identity nesmí následovat další krok ani zobrazení starého výsledku.

Synchronizace načte všechny stránky plánu s deterministickým řazením a nejprve hledá existující vazbu na kategorii. Propojuje pouze dosud nepřiřazenou stejně pojmenovanou položku, s filtrem projektu a podmínkou `category_id IS NULL`. Nulový počet změněných řádků znamená chybu, nikoli úspěch. Nové položky používají stabilní 35znakové ID odvozené z prvních 128 bitů SHA-256 otisku ID kategorie, aby opakování po ztracené odpovědi nevytvářelo další záznam. Existující vazby jiných kategorií se nepřepisují.

Stav obnovy je pouze v paměti aktuální relace. Obnovení celé stránky odstraní upozornění; standardní synchronizace na obrazovce plánu VŘ zůstává k dispozici. Řešení negarantuje transakci napříč kategorií a plánem ani koordinaci všech starších zapisujících klientů. Pro tento omezený opravný krok nebyla přidána databázová migrace, RPC ani změna oprávnění. Atomické uložení by vyžadovalo samostatnou verzovanou databázovou změnu a ověření všech existujících zapisovacích cest.

Regrese pokrývají selhání primárního zápisu, částečný úspěch, čekání, opakované kliknutí, nezávislé operace, změnu identity, ztracenou odpověď, již existující vazbu, shodná jména kategorií, stránkování a souběžnou změnu při propojování.
