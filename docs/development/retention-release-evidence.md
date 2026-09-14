# Pozastávky: plán a skutečné uvolnění

Prázdné procento i částka znamenají, že se pozastávka neuplatňuje (potvrzené produktové pravidlo). Samostatná nenulová částka se uplatňuje i bez procenta. Explicitní částka, včetně nuly, má ve výpočtu přednost před procentem. Jinak se počítá z aktuální ceny smlouvy včetně dodatků. Jde o **aktuální smluvní výpočet**, nikoli historickou uvolněnou částku ani součet srážek z faktur. Částky se tímto PR nezmrazují ani nemění; při dalších dodatcích se dosavadní procentní výpočet dál přepočítává. Souhrn fakturace není podmínkou ani potvrzením nároku na uvolnění.

## Uživatelský postup

V detailu smlouvy → Pozastávky jsou zvlášť očekávané a skutečné datum uvolnění. Akce Označit krátkodobou/dlouhodobou jako uvolněnou otevře potvrzení s datem. Uživatel ověří podmínky smlouvy a potvrdí skutečné uvolnění; aplikace neprovádí platbu. Při ukládání jsou akce uzamčené. Neúspěch zůstane viditelný a stav se nezmění. Potvrzovat může pouze uživatel s právem zápisu na smlouvě; toto právo ověřuje server. Chybějící oprávnění se zobrazí jako chyba.

## Datový kontrakt a kompatibilita

- Původní `retention_{short,long}_release_on` zůstávají kompatibilní se staršími klienty: při `held` obsahují plán, při `released` skutečnost.
- Nové `retention_{short,long}_expected_on` uchovají plán přes přechod do uvolněného stavu. Trigger synchronizuje plán při úpravách starším klientem a chrání jej před přepsáním skutečným datem.
- Backfill kopíruje pouze plány dosud neuvolněných pozastávek. U historicky uvolněných je plán neznámý, pokud byl přepsán; nedohaduje se z předání či záruky. Původní obchodní údaje migrace nepřepisuje. Stávající update trigger může aktualizovat `updated_at`.
- Při legacy opravě statusu zpět na `held` se původní pole opět považuje za plán; uživatel je musí odpovídajícím způsobem upravit. Předchozí změna zůstává v historii. Legacy formulář rozlišuje popisek data podle stavu.
- `contract_retention_events` obsahují změny stavu/dat, původní stav, zachovaný plán, skutečné datum, čas zápisu a autora z `auth.uid()`. Historické autory nevymýšlíme. Mazání celé smlouvy maže její historii kaskádou; smazání uživatele nastaví autora na NULL.
- RPC `release_contract_retention` je SECURITY INVOKER, respektuje RLS a navíc ověřuje aktivní předplatné a zápis na projektu. Řádkový zámek a kontrola stavu odmítnou opakované potvrzení. Datum musí být mezi 1900-01-01 a dneškem v UTC; výchozí datum klienta i časové pásmo RPC/triggerů jsou shodně UTC.
- Audit zapisují pouze neveřejné triggery v `private` s prázdným search_path. Klienti mohou historii pouze číst podle přístupu ke smlouvě. Starší přímé zápisy také procházejí triggerem.
- Změna nevytváří nové povinnosti, automatické uvolnění, oznámení ani nové role. Stavby a organizace zůstávají oddělené existujícími pravidly; oprávnění ani indexy tabulky contracts se nemění.

## Ověření a nasazení

Cílené testy: `tests/features/projects/contracts/RetentionSection.test.tsx`, `tests/contractService.retention.test.ts`, `tests/contractRetentionMigration.test.ts` a existující `retentionSplit.test.ts`. První regresní běh: 6 očekávaných selhání. Review navíc odhalilo rozdíl dne kolem UTC půlnoci; nový regresní test nejprve selhal a po sjednocení data prošel. SQL fixture vybírá vlastníka až po ověření aktivního předplatného a práva zápisu, bez změny těchto oprávnění. Pravidlo prázdných hodnot bylo následně upřesněno uživatelem a test upraven.

Před nasazením spustit `supabase db push --dry-run` a ověřit, že plán obsahuje pouze schválené migrace. Migrace: `supabase/migrations/20260914184053_retention_release_evidence.sql`. Nasadit ji před vydáním nového klienta. Bez migrace potvrzení nahlásí požadavek na aktualizaci databáze; neprovádí nebezpečný fallback na původní zápis.

Po schválení deploye spustit `supabase/tests/retention_release_evidence.sql`: transakce se vrací zpět, ověřuje zachování plánu, skutečné datum, autora, dvojí potvrzení, zákaz přepisování historie a odmítnutí cizího/anonymního přístupu. Porovnat počty smluv a kontrolní součet obchodních dat, RLS/granty/indexy, spustit security/performance advisors a závěrečný dry-run. Předchozí dry-run nalezl 12 krátkodobých a 10 dlouhodobých plánů ke zkopírování; tyto počty znovu ověřit těsně před deployem.

Živé databázové testy a post-deploy kontroly zatím čekají na povolení produkční migrace. GitHub Code Scanning vrací „no analysis found“ (404), tedy není dostupným bezpečnostním signálem. Automatické schválení deploy odmítlo před zeleným PR a výslovným souhlasem k produkční změně.

## Zjištění z průchodu dat

Prověřená smlouva neměla uložené dodatky, soupisy ani faktury; prázdné pozastávky podle pravidla produktu znamenají žádné. Dřívější OCR návrh se lišil od uložených údajů. Nebyl automaticky přijat a zákaznická data se neopravovala odhadem. Uvolňovací podmínky a odpovědnou osobu tento krok nedoplňuje; jsou předmětem dalšího samostatně schváleného průchodu smlouvou.
