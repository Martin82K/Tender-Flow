# Rozpočet stavby

Rozpočet otevřete v navigaci stavby. V části **Importy a verze** najdete revize
rozpočtu a původní přílohy XLSX.

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

Volba platí pro kód v celém importovaném rozpočtu. **Použití ve výkazu výměr**
ukazuje odkazy na přesný kód v rozpoznaných řádcích VV, včetně nezařazených
soupisů; u rozsáhlého seznamu se zobrazí prvních 50 výskytů a jejich celkový počet.
Nejde o úplný rozbor všech excelových vzorců. Před volbou ověřte kontext:
stejný kód může být v původním sešitu použit pro různé části stavby.

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
