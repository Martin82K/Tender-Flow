# Propojení nabídky a smlouvy

Na kartě vítěze lze otevřít propojený záznam přímo ve Smlouvách. Při více vazbách uživatel nejdříve zvolí smlouvu. Přehled VŘ nabízí stejný přechod; při chybějící nebo vícečetné vazbě otevře příslušnou kartu. Detail smlouvy obsahuje návrat do zdrojového VŘ a zaměří konkrétní kartu. PDF se tím neotevírá.

**Propojit existující smlouvu** nabízí nepropojené smlouvy aktuální stavby. Výběr se ukládá až po **Potvrdit propojení**. Nejde o generování smlouvy ani automatické přiřazení podle názvu nebo ceny. Původní příznak Zasmluvněno se nemění a sám nepotvrzuje existenci vazby. Historický odznak s navigačním odhadem podle ID dodavatele zůstává zachován; nový prvek používá výhradně explicitní vazbu.

## Implementace a oprávnění

Vazba používá existující `contracts.source_bid_id`. Nejsou potřeba migrace ani nové balíčky. Služba ověřuje dostupnost nabídky a její kategorie v dané stavbě. UPDATE omezuje smlouvu ID a stavbou a vyžaduje dosud prázdnou vazbu. Nulový počet upravených řádků se hlásí jako neúspěch. Souběžně vytvořená vazba se nepřepisuje; dokumenty a původ záznamu zůstávají stejné.

Klient používá běžnou přihlášenou relaci. RLS rozhoduje o čtení a úpravě smlouvy; oprávnění se nerozšiřují. Existující pole nemá cizí klíč na nabídku. Kontrola společné stavby probíhá v aplikační službě, nikoli novým databázovým constraintem. Databázové zpřísnění by vyžadovalo samostatný audit starých vazeb a migraci. UI kontrola není bezpečnostní hranice.

Návrat používá `buildAppUrl`/`parseAppRoute`, `categoryId` a `bidId`. Zdroj se hledá v načtené aktuální stavbě podle explicitního ID. Při chybějícím nebo nejednoznačném zdroji se zpětný odkaz nezobrazí. Tlačítka a výběry používají společné komponenty a tokeny skinů s malou typografií.

## Ověření

Regresní testy pokrývají jednoznačnou i vícečetnou vazbu, oddělení staveb, potvrzení, chyby a nulový zápis, ochranu před přepsáním a přesnou návratovou navigaci. `npm run test:project-ui` ověřuje skutečné komponenty a produkční CSS ve všech šesti skinech a obou barevných režimech, kontrast, velikost textu a interakce. Data jsou syntetická.
