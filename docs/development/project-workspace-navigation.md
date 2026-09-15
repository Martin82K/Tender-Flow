# Navigace portfolia a stavby

První etapa návrhů C1/C2 používá vzhled připravený pro C3. C3 ve Figmě zůstává budoucí referencí; rozpočet, změnové listy ani samostatná fakturace nejsou nové položky produkčního menu.

- **Stavby** otevřou `/app/projects`, tedy seznam a Správu staveb. Název stavby otevře její přehled. Nová stavba rozbalí existující formulář; archivace, sdílení, předání vlastníka, editace a vytvoření realizační kopie zůstávají dostupné podle dosavadních oprávnění.
- **Správa staveb** zůstává explicitní vstup pod přepínači. Hledání, stav, filtr vlastních staveb a pozice seznamu se uchovávají pro aktuální relaci prohlížeče, odděleně podle uživatele a organizace. Při nedostupném úložišti funguje navigace dál.
- V detailu je přepínač stavby s hledáním podle názvu a lokace. U dostupné sekce zachová při změně stavby její typ; nedostupná sekce spadne na Přehled. Identifikátory konkrétní smlouvy nebo poptávky se nepřenášejí do jiné stavby.
- Projektové menu obsahuje osm dnešních sekcí; dostupnost vychází ze stejné konfigurace jako obsah. Archivovaná stavba otevřená přímým odkazem si zachová navigaci a dosavadní režim pouze pro čtení.
- **Přehledy** a **Nástroje** přepínají nabídku sidebaru. Otevřený obsah se změní až výběrem položky; u otevřené stavby zůstává návrat k jejímu menu.
- Subdodavatelé zůstávají nahoře, osobní TODO dole. Uživatelské menu, notifikace a horní lišta se nemění. Desktop nemá duplicitní řadu projektových záložek; mobil zachovává kompaktní výběr sekce.

## Ověření

Regresní testy pokrývají přímý vstup, dostupnost modulů, přepínání staveb, archiv, hledání, návrat fokusu a oddělení uložených filtrů. Kontroly funkcí v menu nenahrazují autorizaci: stávající route guardy, projektová oprávnění a databázová pravidla se nemění. Nové závislosti ani migrace nejsou potřeba.

Přechody používají existující router a stávající ukládání formulářů. Tato etapa nezavádí nový globální mechanismus ochrany rozpracovaných formulářů; při ručním ověření je třeba zkontrolovat existující ukládání v používaných modulech.

C1 obsahuje tabulku staveb se stavem, počtem otevřených VŘ a nejbližší uzávěrkou nabídky. Dva grafy pod tabulkou používají stejný filtrovaný výběr. Souhrny čtou pouze identifikátory dostupných staveb, stavy a termíny poptávek a příznak podepsané nabídky; dokumenty a finanční údaje se nenačítají. Počet odpovídá stavu `open` bez podepsaného vítěze, stejně jako přehled stavby. Nejbližší termín preferuje budoucí uzávěrku, jinak označí nejstarší neuzavřenou uzávěrku jako po termínu. Termíny jiných typů (úkoly, harmonogram) zde zatím nejsou agregované.

Nenačtené nebo nepřístupné souhrny nejsou nuly. Chyba má možnost opakování; chybějící souhrn je explicitně označený. Správní akce jsou pod nabídkou se třemi tečkami u každé stavby. Archiv a jeho stávající oprávnění zůstávají zachované. Demo stavby bez serverového souhrnu zobrazí nedostupnost VŘ místo smyšlených čísel.
