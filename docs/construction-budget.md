# Rozpočet stavby

Rozpočet otevřete v navigaci stavby. V části **Importy a verze** najdete revize
rozpočtu a původní přílohy XLSX.

Přepínač **Výkaz výměr** zobrazí pod položkami jejich výpočty a poznámky.
Mají drobnější písmo, nižší řádky a odsazený popis. Sdílejí pozadí položky,
bez dělících čar mezi jednotlivými výpočty; množství zůstává ve svém sloupci.
V ozubeném kolečku **Nastavení zobrazení** úplně vpravo najdete **Zalamovat**,
**Hustotu** (Kompaktní / Pohodlná) a **Sloupce**. Nastavení se pamatuje pro daný
projekt a uživatele. Nabídku zavřete kliknutím mimo ni nebo klávesou Escape.
Zalamování a hustota fungují i pro pomocné řádky. Upozornění **Chybí cena**
se zobrazuje pouze u neoceněných rozpočtových položek, nikoli u VV a poznámek.

Tlačítka **+ / −** úplně vlevo před zaškrtávátkem rozbalují a sbalují objekty,
soupisy a oddíly. Při zapnutém **Výkazu výměr** ovládají také výpočty a poznámky
jednotlivých položek. U řádků bez podřízeného obsahu tlačítko není.
Ovládání zůstává vlevo i při vodorovném posouvání tabulky.

Pravým tlačítkem v tabulce otevřete nabídku **Sbalit vše / Rozbalit vše** pro
objekty, soupisy, oddíly i podřízené řádky položek celého rozpočtu. Aktivní rozsah, filtry, výběr položek
i přepínač výkazu výměr zůstávají zachované. Nad buňkou je navíc volba
**Filtrovat podle této hodnoty**; samotné otevření nabídky filtr nemění.
Nabídku otevřete také klávesami Shift+F10, ovládáte šipkami a zavřete Escape.

## Odstranění a obnova

U revize nebo přílohy použijte **Odstranit**. Potvrzovací dialog ukáže název,
vazby revize na výběrová řízení a dopady akce. Teprve tlačítko **Přesunout do
koše** změnu uloží. Záznam zmizí z aktivního seznamu, není fyzicky smazán.

V nabídce **Koš** lze záznam vrátit tlačítkem **Obnovit** a potvrzením obnovení.
Původní XLSX, historie, alokace i potvrzený stav revize zůstávají zachované.
Částky v plánu VŘ, nabídky a smlouvy se odstraněním ani obnovením nemění.
Revizi v koši nelze upravovat ani z ní převzít částku do plánu VŘ.

Přílohu nelze přesunout do koše, dokud ji používá aktivní revize. Nejprve
odstraňte její revize. Při obnově postupujte opačně: příloha, potom revize.

Odstraňování a obnovování vyžaduje právo upravovat rozpočet a vidět ceny.
Potvrzená revize navíc vyžaduje právo potvrzování; revize s alokacemi právo
alokovat do VŘ. Server oprávnění ověřuje nezávisle na zobrazených tlačítkách.
Při souběžné změně verze server změnu odmítne a je potřeba obnovit seznam.

## Dokončení importu a přístupnost

Uložená příloha se převádí přímo z privátního úložiště. První import vytváří rozpočet,
navazující importy samostatné verze. Soubor zaznamenává první a poslední převod;
pracovní kopie datum převodu nemění. Výběr soupisů využívá dostupnou výšku okna.
Kontrola importu se na široké obrazovce zobrazí v dialogu až 1 200 px: vlevo
je soubor, název rozpočtu a výběr soupisů, vpravo pokročilé mapování, kontrola
dat a případné porovnání s předchozí verzí. Na úzkých obrazovkách jsou sekce
pod sebou. Tlačítko pro vytvoření rozpočtu zůstává v patičce mimo posouvaný obsah.
Nerozpoznané listy jsou výslovně označené jako neověřená úplnost. Konfliktní figury
obsahují konkrétní kódy a hodnoty ke kontrole. Jejich aritmetické použití se nepovolí
odhadem, uložené ceny a množství se však importují beze změny.

### Vyřešení konfliktů figur před importem

V pravém panelu **Konflikty figur** rozbalte kód figury. U nalezených hodnot
vidíte zdrojový list, řádek a buňku. Výběrem hodnoty konflikt vyřešíte; případně
zadejte vlastní číslo (i s desetinnou čárkou) a potvrďte **Použít hodnotu**.
Rozpracované číslo bez tohoto potvrzení se nepoužije. **Zrušit volbu** vrátí
figuru do nevyřešeného stavu. Počítadlo ukazuje, kolik konfliktů je vyřešeno.

Před volbou se automaticky zobrazí **celá související položka**: objekt, soupis,
kód, úplný popis, množství, jednotka, jednotková i celková cena a všechny její
rozpoznané řádky výkazu výměr a poznámky. Odkazy na přesný kód figury jsou
zvýrazněné. Tlačítky **Předchozí / Další** projdete všechny související položky
bez limitu 50 výskytů, včetně označených nezařazených soupisů. Opakované použití
v jedné položce ji v přehledu nezdvojuje. Prohlížení nevybírá hodnotu ani nepřepočítává ceny.

Volba platí pro kód v celém importovaném rozpočtu. Nejde o úplný rozbor všech
excelových vzorců. Před volbou ověřte kontext: stejný kód může být v původním
sešitu použit pro různé části stavby. Pokud chybí vazba na nadřazenou položku,
náhled to výslovně uvádí a ukáže samotný řádek VV. Bez nalezeného použití je
nutné související položku ověřit v původním XLSX.

Náhled se skládá pouze z rozpoznaného dokumentu, nadřazená položka se vyhledává
podle ID ve stejném soupisu, nikoli podle opakujícího se kódu. Neprovádí další
síťová volání a texty ani vzorce z XLSX nespouští jako HTML nebo JavaScript.

Rozhodnutí se ukládá s verzí rozpočtu v `figureResolutions` (hodnota a původ
`source` nebo `custom`); původní konflikty a jejich zdrojové buňky zůstávají
v dokumentu pro dohledání. Vyřešená figura je dostupná pro následný výslovný
přepočet VV. Samotná volba nemění uložená množství, ceny ani originální XLSX.
Nové rozpoznání s upraveným mapováním všechny volby zahodí a konflikty určí znovu.
Starší dokumenty bez nových metadat zůstávají kompatibilní, ale nemusí obsahovat
adresy zdrojových buněk. Nevyřešený konflikt nadále neblokuje import ani potvrzení;
přepočet výrazu s nevyřešenou figurou zůstane nedostupný.

Číselníky ověřují správcovské oprávnění přes serverovou funkci. Načítání, chyby,
prázdný stav, duplicity a archiv jsou součástí dialogu. Zápisy nadále chrání RLS.
Změna s nulovým počtem dotčených řádků se nepovažuje za úspěch. Formuláře mají
zámek proti opakovanému submitu. Sdílený Modal pojmenovává dialog, zachovává focus
uvnitř a vrací jej po zavření; křížek má čtvercovou klikací plochu a vnitřní
indikátor focusu jen pro klávesnici.

## Trvalé odstranění

Migrace `20260919152816_construction_budget_purge.sql` přidává dvoufázové mazání
pouze pro aktivního vlastníka/správce organizace s přístupem k rozpočtu a cenám.
Začátek uloží neměnný seznam identifikátorů, ověří stav koše a verze, uzamkne
obnovu i úpravy a odmítne přílohu s nevybranými navázanými verzemi. Soubory
odstraní Storage API, nikoli SQL. Dokončení ověří nepřítomnost objektů a odstraní
rozpočtové záznamy s historií. Neúspěch má trvalý identifikátor operace a lze jej
bezpečně dokončit. Záznam operace zachová autora, čas a identifikátory.
V rámci QA se trvalé mazání reálných souborů neprovádí, SQL fixture mají rollback.
