# Příjemce poptávky na kartě VŘ

Karta dodavatele používá `Bid.contactPerson`, `email` a `phone` jako uložený
kontakt pro konkrétní VŘ. Výběr v `BidRecipientPicker` nabízí pouze osoby
subdodavatele této karty. Existující uložená nebo ručně zadaná adresa zůstává
zachovaná i při změně adresáře. Výběr nemění adresář ani pořadí hlavních kontaktů.

Nové karty použijí hlavní osobu (první v adresáři), má-li platný e-mail. Jinak
se použije jediná osoba s platnou adresou. Při více možnostech nebo bez adresy
zůstane e-mail prázdný a uživatel musí vybrat příjemce či zadat adresu v editaci.
Obecná adresa může být běžnou kontaktní položkou; nemá zvláštní prioritu.

## Ukládání a oprávnění

`usePipelineRecipientSelection` kontroluje příslušnost karty k aktivnímu VŘ a
osoby k dodavateli. API aktualizuje pouze tři kontaktní sloupce; filtruje podle
ID karty, VŘ a dodavatele. Zápis používá běžnou Supabase session a stávající RLS
pro vlastníka projektu nebo sdílení s právem editace. Nemění schéma, granty ani
RLS. Úspěch vyžaduje vrácený řádek; nulový počet změněných řádků není úspěch.

Po dobu zápisu je výběr a generování blokováno. Zámek pro projekt/VŘ žije mimo
komponentu až do dokončení požadavku, takže odchod, návrat ani nové připojení
komponenty nepovolí druhý souběžný zápis. Stejný zámek chrání příjemce během
načítání šablony a příloh pro koncept. Lokální karta se změní až po
potvrzeném zápisu. Jednoznačně odmítnutý zápis zachová původní kontakt.
Po úspěšné i nejednoznačné odpovědi zápisu API načte stejný řádek pod stejným RLS
rozsahem a rozpozná i zápis, jehož odpověď se ztratila, nebo novější volbu jiného editora. Pokud ověření selže
nebo vrátí jiný kontakt, označí konkrétní kartu za neověřenou a generování
ve VŘ zablokuje. Nový úspěšný výběr na jiné kartě blokaci nezruší; musí se
znovu potvrdit právě neověřená karta. Položku „uložený příjemce“ lze znovu
potvrdit i bez kontaktu v adresáři; používá se uložené jméno, e-mail a telefon
této karty, nikoli libovolná hodnota z volání UI. Odstraněné karty neblokují zbývající VŘ. Dostupný výsledek čtení se zobrazí,
aniž by se vydával za potvrzení požadované změny. Potvrzená
kontaktní pole se sloučí do aktuálních dat, aby se nepřepsala souběžná cena nebo
stav. Odpověď po přechodu do jiného projektu nesmí měnit jeho karty. Demo ukládá
stejná pole lokálně, bez síťového zápisu.

## Generování a provozní ověření

Standardní i materiálový koncept čte uložený `bid.email` a ověřuje jednu platnou
adresu. Hromadné koncepty používají stejná pole; rekapitulace obsahuje firmu,
osobu a e-mail. Zůstává deduplikace a skrytá kopie BCC. Karty bez platné adresy
se v hromadné rekapitulaci zobrazí jako vynechané, stejně jako dříve.

Volba platí pro další koncepty a kola. Již otevřené EML/mailto koncepty aplikace
neupravuje. Dosavadní přesun do fáze Odesláno při generování je zachován;
nejde o potvrzení skutečného odeslání poštovním klientem. Nový audit odesílání
ani historii zpráv tato změna nezavádí.

Ruční kontrola: na kartě vybrat jinou osobu, obnovit projekt, zkontrolovat
rekapitulaci hromadného e-mailu a adresáta konceptu v poštovním klientu.
Při odebraném právu editace nebo výpadku připojení se musí zobrazit chyba
uložení; nesmí dojít ke zdánlivému přepnutí kontaktu. Automatické testy pokrývají
výchozí výběr, chyby uložení, rozsah zápisu, ruční kontakt a návaznost na BCC.

Uložení celého formuláře karty sdílí zámek s výběrem příjemce a generováním. Zámek trvá až do dokončení zápisu i po zavření dialogu a navigaci, aby opožděný zápis formuláře nepřepsal novou volbu z menu.
