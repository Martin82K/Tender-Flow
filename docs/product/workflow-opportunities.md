# Další workflow: ze smlouvy ke splněnému závazku

Stav: návrh k rozhodnutí, dosud neimplementováno. Veřejný web jej neprezentuje
jako hotovou funkci. Navazuje na tok poptávka → nabídka → výběr → smlouva.

## Uživatelský scénář

Přípravář vloží podepsanou smlouvu. OCR vytvoří návrh seznamu závazků:
termín předání, pojištění, bankovní záruka, kontrolní den nebo doložení dokladů.
Každý návrh ukáže původní pasáž dokumentu, datum, odpovědnou osobu a případné
nejasnosti. Člověk opraví výsledek a schválí vznik úkolů. Tým následně sleduje
splnění a přikládá důkazy. Změna smlouvy nabídne porovnání a aktualizaci již
schválených úkolů, bez duplicit.

## Postup realizace

1. Definovat omezený výstup extrakce: typ závazku, citace/strana, datum,
   navržený odpovědný, jistota a odkaz na verzi zdrojového dokumentu.
2. Připravit reprezentativní anonymizovanou sadu smluv a hodnotit správnost
   dat, zdrojových citací a chybějících závazků. Nejasný termín musí zůstat
   k doplnění; model nesmí datum vymyslet.
3. Přidat stránku návrhů s hromadným výběrem, opravami a explicitním schválením.
4. Využít existující úkoly a notifikace. Deduplikaci odvodit z dokumentu,
   jeho verze a závazku; zopakovaný požadavek nesmí vytvořit druhý úkol.
5. Přidat MCP čtení návrhů a případný zápis přes stávající potvrzovací protokol.
6. Pilotně ověřit skutečnou úsporu času, podíl oprav, přehlédnuté termíny,
   náklady na dokument a rychlost p50/p95. Cíle stanovit proti změřenému základu.

## Hranice a testy

Smlouva je nedůvěryhodný vstup. Instrukce vložené do dokumentu nesmějí spustit
nástroje, změnit oprávnění ani odeslat zprávu. Extrakce a provedení změn jsou
oddělené. Oprávnění projektu i organizace se kontrolují při čtení i schválení.

Testovat chybné OCR, datum bez roku, dodatky, duplicitní upload, souběžné
schválení, retry po timeoutu, ztrátu oprávnění a přístup mezi organizacemi.
Přidat měření latence a nákladů bez logování obsahu smluv. Přístup k přílohám
má používat krátkodobé podepsané URL. Uchování zdrojů v TenderFlow musí mít
vlastní pravidla i při aktivním ZDR u Mistralu.

## Další směry modernizace

| Směr | Přínos | Předpoklad a důkaz dokončení |
| --- | --- | --- |
| Postupný přesun legacy funkcí | Menší provázání a bezpečnější změny | U každé funkce zachovat chování, snížit import baseline, projít boundary guardy |
| Rychlé otevření projektu | Kratší čekání na hlavní práci | Změřit p95, odstranit nepotřebné dotazy, ověřit cache a izolaci identity |
| Hromadné porovnání nabídek | Rychlejší rozhodování | Normalizace jednotek a zdrojové ceny, ruční potvrzení výběru |
| MCP pro provozní přehled | Přístup k aktuálním informacím z klienta | Omezené rozsahy, stránkování, nákladové limity a audit zápisů |
| Dokumentace jako součást změn | Méně rozporů mezi produktem a webem | Jednotný katalog funkcí, kontrola odkazů, scénáře aktualizované spolu s kódem |

Tento krok modernizace přesouvá landing page do `features/public`, rozděluje
obsah a sekce a odstraňuje runtime vyřazeného asistenta. Zbývající legacy části
vyžadují další samostatně ověřitelné migrace; globální přepis není dokončen.
