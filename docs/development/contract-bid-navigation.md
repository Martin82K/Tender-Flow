# Propojení nabídky a smlouvy

Na kartě vítěze lze otevřít propojený záznam přímo ve Smlouvách. Při více vazbách uživatel nejdříve zvolí smlouvu. Přehled VŘ nabízí stejný přechod; při chybějící nebo vícečetné vazbě otevře příslušnou kartu. Detail smlouvy obsahuje návrat do zdrojového VŘ a zaměří konkrétní kartu. PDF se tím neotevírá. Také tabulka smluv nabízí vedle čísla propojené smlouvy kompaktní tlačítko **VŘ**. Otevře přímo zdrojovou kartu bez přepnutí na detail smlouvy; při chybějící nebo nejednoznačné vazbě se nezobrazuje.

**Propojit existující smlouvu** nabízí nepropojené smlouvy aktuální stavby. Výběr se ukládá až po **Potvrdit propojení**. Po vytvoření vazby se ovládání pro propojení skryje a zůstane přechod do Smluv. Nejde o generování smlouvy ani automatické přiřazení podle názvu nebo ceny. Původní příznak Zasmluvněno se nemění a sám nepotvrzuje existenci vazby. Historický odznak s navigačním odhadem podle ID dodavatele zůstává zachován; nový prvek používá výhradně explicitní vazbu.

## Implementace a oprávnění

Vazba používá existující `contracts.source_bid_id`. Migrace `20260912172814_widen_contract_source_bid_id.sql` rozšiřuje původní varchar(36) na text, protože obnovené nabídky používají i delší ID. Existující vazby se nemění; nové balíčky nejsou potřeba. Služba ověřuje dostupnost nabídky a její kategorie v dané stavbě. UPDATE omezuje smlouvu ID a stavbou a vyžaduje dosud prázdnou vazbu. Nulový počet upravených řádků se hlásí jako neúspěch. Souběžně vytvořená vazba se nepřepisuje; dokumenty a původ záznamu zůstávají stejné.

Klient používá běžnou přihlášenou relaci. RLS rozhoduje o čtení a úpravě smlouvy; oprávnění se nerozšiřují. Existující pole nemá cizí klíč na nabídku. Kontrola společné stavby probíhá v aplikační službě, nikoli novým databázovým constraintem. Databázové zpřísnění by vyžadovalo samostatný audit starých vazeb a migraci. UI kontrola není bezpečnostní hranice.

Návrat používá `buildAppUrl`/`parseAppRoute`, `categoryId` a `bidId`. Zdroj se hledá v načtené aktuální stavbě podle explicitního ID. Při chybějícím nebo nejednoznačném zdroji se zpětný odkaz nezobrazí. Tlačítka a výběry používají společné komponenty a tokeny skinů s malou typografií.

## Ověření

Regresní testy pokrývají jednoznačnou i vícečetnou vazbu, oddělení staveb, potvrzení, chyby a nulový zápis, ochranu před přepsáním a přesnou návratovou navigaci. `npm run test:project-ui` ověřuje skutečné komponenty a produkční CSS ve všech šesti skinech a obou barevných režimech, kontrast, velikost textu a interakce. Data jsou syntetická.

Výběr smlouvy je vyhledávatelný podle názvu, dodavatele i čísla. Rozbalená nabídka má šířku alespoň 480 px, omezenou dostupným viewportem, a celé názvy se zalamují. Před potvrzením je pod výběrem vidět celý vybraný záznam. Ostatní výběry používají původní výchozí rozměry a zkracování.

## Ověření rozšíření ID (12. 9. 2026)

Před migrací byl na syntetickém 54znakovém ID reprodukován PostgreSQL kód `22001`. Po migraci stejný vstup prošel při přiřazení do proměnné typu `contracts.source_bid_id%TYPE` bez zkrácení. Počet řádků a kontrolní součet vazeb před/po zůstaly shodné; stejně tak RLS, ACL, definice policies, indexů a constraints. Závěrečný `db push --dry-run` hlásí aktuální databázi. Zákaznické vazby nebyly pro test změněny.

Security a performance advisors byly spuštěny. Hlásí i nálezy na objektech, které migrace nemění; samotný typový přechod nepřidal policy, grant ani index. Pro tabulku contracts zůstává například téma [indexů cizích klíčů](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) a [vyhodnocování RLS funkcí](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan). Nejde o prohlášení, že celá databáze nemá bezpečnostní nálezy.

### Známý rozdíl výchozího schématu

Audit review zjistil starší drift: propojená databáze má `bids.id` typu text, ale počáteční migrace jej vytváří jako varchar(36); `bid_tags.bid_id` zůstává varchar(36) i v propojené databázi. Tato oprava mění pouze schválené `contracts.source_bid_id` a nezajišťuje obnovu delších ID do nově vytvořené databáze ani jejich použití ve štítcích. Sjednocení autoritativního ID a závislých vazeb vyžaduje samostatnou verzovanou migraci a audit obnovy. Jde o existující omezení mimo propojení smlouvy; nelze tvrdit, že tato migrace opravuje celý import/obnovu.
