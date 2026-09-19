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
