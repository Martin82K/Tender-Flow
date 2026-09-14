# Příjemce konkrétní poptávky

Na kartě subdodavatele ve VŘ je blok kontaktu (jméno, e-mail, telefon), při více příjemcích s rozbalovacím výběrem. Výběr se okamžitě použije pro příští generování. Nepřidává se potvrzovací dialog. Hlavní nebo jediný použitelný kontakt se předvybírá při vytvoření karty; bez platného e-mailu nelze z dané karty generovat.

## Oddělení volby a uložené karty

`usePipelineRecipientSelection` drží explicitně vybraného příjemce odděleně od načtených údajů karty, v paměti relace (React Query cache), v rozsahu uživatele, organizace, projektu, VŘ, karty a dodavatele. Volba i stav zapamatování přežijí odmontování obrazovky při navigaci. `inquiryBids` skládá aktuální ostatní údaje s touto volbou. Refetch či pomalé uložení celé karty tak nepřepíše adresáta připravované poptávky. Ostatní karty se neblokují.

Zapamatování kontaktu na kartě zůstává doplňkový zápis na pozadí. Používá stávající RLS rozsah, CAS přes přesnou serverovou hodnotu `updated_at`, časové limity a následné autoritativní načtení. Nezasahuje do globálního adresáře. Selhání zapamatování se zobrazí u menu; zvolený adresát zůstane v aktuální relaci použitelný. Po úplném obnovení stránky se načte skutečně uložená hodnota. Pozdní odpověď starší volby nepřepíše novější lokální výběr. Demo režim zapisuje pouze lokální demo data.

## Pevný adresát konceptu

Při kliknutí na generování se příjemce kopíruje do konkrétní operace před prvním asynchronním načítáním šablony nebo příloh. Standardní i materiálová poptávka proto používají tehdejší adresu. Pozdější změna kontaktu nebo editace karty může pokračovat a platí až pro další generování. Současně je blokováno pouze opakované generování stejné karty během přípravy, i po odmontování karty nebo záložky.

Hromadná poptávka používá kopii karet z otevřené rekapitulace. Pozdější aktualizace karet nemění adresáty tohoto konceptu. Rekapitulace uvádí firmy, osoby, e-maily a přeskočené karty bez platného e-mailu. BCC a deduplikace adres zůstávají zachovány. Přechod na jiné VŘ nebo projekt rekapitulaci zavře.

Aplikace připravuje EML/mailto; existující změna stavu na `sent` po vytvoření konceptu zůstává zachována. Nejde o potvrzení skutečného odeslání e-mailu. Již otevřený koncept ani odeslaný e-mail se změnou karty neupravují. Nepřidává se nová historie, migrace ani agenda odesílání.

## Ověření

- Pomalé nebo neúspěšné zapamatování kontaktu neblokuje generování ani jiné karty.
- Výběr kontaktu zůstává dostupný během načítání šablony; běžící koncept používá původní adresu.
- Hromadný koncept odpovídá příjemcům z rekapitulace i po následné změně karty.
- Karta bez platného e-mailu neumožní generovat; neplatné kontakty jsou v menu neaktivní.
- Volby se nepřenášejí mezi projekty, VŘ nebo dodavateli. Ruční příjemce mimo adresář zůstává použitelný.
- UI testy ověřují desktop, mobil, klávesnici, více témat a demo persistence po obnovení.

Ruční kontrola: vybrat kontakt, generovat poptávku, během přípravy vybrat jiný kontakt. První koncept musí obsahovat první adresu, další koncept druhou. Totéž ověřit při otevřené hromadné rekapitulaci. Skutečné odeslání není součástí automatických testů.

Zápisy jedné karty jsou řazeny za sebe podle klíče uživatele, organizace, projektu, VŘ a karty. Fronta nikdy neblokuje místní výběr ani generování; při nedokončeném síťovém zápisu pouze čeká doplňkové zapamatování. Uložení dialogu připne nového příjemce jen při skutečné změně kontaktních polí proti otevřenému formuláři. Při změně ceny nebo poznámky nejsou kontaktní pole součástí UPDATE a v demo/lokálním stavu zůstanou aktuální hodnoty.

## Zobrazení příjemce na kartě

Jméno, e-mail a telefon tvoří společný blok pod názvem dodavatele. Změna příjemce přenáší všechna tři pole; chybějící telefon nepřebírá číslo předchozí osoby. Jediný příjemce nemá rozbalovací menu, více příjemců používá přístupný ThemedSelect s jednotlivými údaji na samostatných řádcích. Zavřený výběr nemá rámeček ani trvalé podbarvení; šipka, hover a klávesnicový fokus signalizují možnost změny. Otevřené menu zůstává ohraničené. Typ kontaktu a odkaz na editaci se v tomto bloku nevykreslují. Editace celé karty zůstává dostupná přes tužku nebo dvojklik.

Ručně uložený příjemce se zachová jako samostatná možnost, pokud se liší od adresáře včetně telefonu. Pokud starší karta nemá platného příjemce a adresář nabízí jediný platný kontakt, lze jej výslovně použít tlačítkem bez menu. Kontakty bez platného e-mailu jsou nadále nedostupné pro generování; vyhledávání se nabízí až při více než šesti možnostech.
