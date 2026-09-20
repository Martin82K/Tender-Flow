# Rozpočet stavby

## Převzetí přiřazení do výběrových řízení

Při importu souboru do projektu s rozpočtem můžete zvolit **Aktualizovat rozpočet –
nová verze**, nebo **Pouze převzít přiřazení do VŘ**. Druhá volba pracuje s právě
otevřenou revizí: zachová její položky, strukturu, ceny a množství. Potvrzenou revizi
nemění; vytvoří pracovní kopii. Soubor pro přiřazení nemusí obsahovat ceny ani
množství. Při vytvoření nové verze lze převzetí VŘ zapnout samostatně.

V náhledu potvrdíte navržené sloupce názvu a případně čísla VŘ pro každý list.
Sloupce mohou být vložené před, mezi i za původní sloupce rozpočtu. Návrh vychází
z hlaviček a obsahu; při nejasnosti vyberete sloupec ručně. Náhled ukazuje skutečné
buňky. Pro nestandardní rozložení položek použijte také editor mapování importu.
Prázdný název VŘ znamená vynechání řádku, nikoli smazání vazeb nebo převzetí hodnoty
z předchozího řádku. Čárka v názvu VŘ zůstává součástí názvu. Čísla jako `02` zůstávají
textovými kódy, oddělenými od interních identifikátorů.

Párování kontroluje typ, kód, popis a jednotku. U duplicit může pomoci přesná část
nebo ověřený zdrojový list a řádek. Zkrácené odkazy ani samotné pořadí nejsou důkazem
shody. Nejasné položky přiřaďte ručně nebo výslovně vynechte. Vyhledávání dalších
cílových položek nabízí shodné jednotky. Jeden cíl nelze použít pro více zdrojových
řádků v téže operaci.

Názvy mapujete na **VŘ tohoto projektu** nebo potvrdíte vytvoření chybějících.
Existující vazby lze zachovat, doplnit pouze zbývající množství nebo výslovně nahradit.
Před uložením potvrďte souhrn dopadů včetně vynechání a nahrazení vazeb. Změna plánu
VŘ, nabídek a smluv není součástí tohoto importu. Změní-li někdo mezitím cílovou revizi
nebo seznam VŘ, server zápis odmítne; otevřete nový náhled. Opakování stejného
požadavku po síťové chybě nevytvoří další řízení ani alokace.

**Vlastní vzory VŘ** umožňují uložit projektové názvy a externí kódy do vlastního
souboru JSON a opakovaně jej použít v jiných projektech. Před vložením můžete upravit
definice a vybrat, které vytvořit; existující názvy a kódy se nepřepisují. Projektové
kopie lze dále upravovat v přehledu VŘ. Vzor neobsahuje položkové alokace, ceny,
nabídky, dodavatele, stav řízení ani dokumenty. Nejde o živé sdílení mezi projekty.
Soubor vzoru uchovávejte podle pravidel vaší organizace.

Nový tok vyžaduje oprávnění pro úpravy rozpočtu, čtení cen, alokace a úpravy modulu
VŘ v cílovém projektu. Původní XLSX zůstává chráněnou přílohou. Technický postup
nasazení a ověření popisuje [import VŘ](development/budget-tender-import.md).

Rozpočet otevřete v navigaci stavby. V části **Importy a verze** najdete revize
rozpočtu a původní přílohy XLSX.

## Automatické rozpoznání rozpočtů

Import automaticky rozpozná **KROS** a **Globus** (pracovní název exportu
EstiCon podle ikony zeměkoule). Formát určuje podle hlaviček a struktury každého
listu, nikoli podle názvu souboru nebo přítomnosti loga. Podporované soupisy se
rovnou vyberou; v náhledu stačí zkontrolovat rozsah a dokončit import. Pokročilé
mapování zůstává sbalené jako pomoc pro nerozpoznané nebo nestandardní soubory.
Posunuté hlavičky a přeuspořádané sloupce se rozpoznají bez ručního mapování.
U vlastního záhlaví lze v pokročilém mapování zvolit **Formát listu → Globus**,
roli, řádek hlavičky a sloupce. Volba formátu zachová význam řádků `P` a `SD`
i bez rozpoznatelných názvů sloupců. U běžných vzorů tato volba není potřeba.

Globus podporuje dvouřádkové záhlaví cen, jednotlivé objekty a soupisy, oddíly
`SD`, položky `P`, doplňující popis `PP`, výkaz výměr `VV` a technický popis
`TS`. Rekapitulace, oddíly, pomocné číslování sloupců a popisy cenu nezvyšují.
Kódy zůstávají textové, včetně úvodních nul; varianty a cenová soustava zůstávají
ve zdrojových buňkách. Položky `P` používají interní kategorii práce `K`, ale
původní označení `P` se uchovává v `sourceType`. Oddíly `SD` jsou sourozenci
pod soupisem. Podrobnosti `PP`, `VV` a `TS` se zobrazí pod příslušnou položkou
tlačítkem **VV** ve zdrojovém pořadí.

Textové výpočty Globus, např. `2*1 = 2,000 [A]`, se uchovávají jako původní
text. Pokud VV nemá číselnou buňku množství, zůstane množství prázdné; import
neodhaduje výsledek z popisu. Ceny se načtou ze skutečných buněk i u souboru
pojmenovaného „bez cen“. Prázdné ceny nejsou nuly: pracovní import je možný,
potvrzení neúplného ocenění zůstává blokované.

Technicky formáty rozpoznává registr profilů `model/importProfiles.ts`.
Každý list má volitelný `format`; starší dokumenty bez něj fungují dál.
Společný importér a worker zachovávají validaci, limity ZIP/XLSX a zdrojové
buňky. Vzorce se nespouštějí, používají se pouze uložené výsledky. Makra,
externí vazby a vložené objekty import nadále odmítá. Originál se nemění.

Lokální test reálného vzoru lze spustit přes `GLOBUS_SMOKE_FILE` a
`tests/constructionBudgetGlobusRealFile.test.ts`; soukromý soubor se necommituje.
Při přidání dalšího formátu je nutný reprezentativní vzor a regresní test
automatického rozpoznání, zdrojových vazeb a součtů.

Tlačítko **VV** vlevo u každé položky zobrazí pouze její výpočty a poznámky.
Jednotlivé výkazy lze otevírat nezávisle; u položky bez podrobností je tlačítko neaktivní.
Mají drobnější písmo, nižší řádky a odsazený popis. VV a Online PSC mají čisté
pozadí tabulky bez podbarvení položky, také při jejím označení. Mezi výpočty
nejsou dělicí čáry; množství zůstává ve svém sloupci.
V ozubeném kolečku **Nastavení zobrazení** za tlačítkem **Firemní číselníky** najdete **Zalamovat text popisu**,
**Hustota zobrazení** (Kompaktní / Pohodlná), **Zobrazení sloupců** a **Rozsah**. Nastavení se pamatuje pro daný
projekt a uživatele. Nabídku zavřete kliknutím mimo ni nebo klávesou Escape.
V **Zobrazení sloupců** má každý sloupec samostatné volby **Zobrazit** a
**Ponechat vlevo**. Tato volba drží sloupec na místě při vodorovném posouvání
tabulky; jeho šířku nemění. Šipky nahoru a dolů upravují pořadí zleva doprava v tabulce,
zvlášť mezi připnutými a ostatními sloupci. Alespoň jeden sloupec zůstává
viditelný. **Obnovit výchozí** vrátí původní sloupce; ostatní nastavení ponechá.
Kliknutím na název sloupce otevřete jeho filtr s rovnou aktivním hledáním.
Psaní průběžně filtruje položky; ostatní filtry i výběr hodnot zůstávají zachované.
Vymazání čipu **Hledání** nebo volba **Vymazat všechny filtry** vyčistí také
vyhledávací pole v projektové hlavičce.
Vyhledávací pole jsou uvnitř filtrů, hlavička tabulky má jen názvy sloupců.
Nadpisy množství a cen jsou zarovnané doprava stejně jako jejich hodnoty.
Zalamování mění jen text popisu, také u pomocných řádků. Hustota mění výšku řádků. Upozornění **Chybí cena**
se zobrazuje pouze u neoceněných rozpočtových položek, nikoli u VV a poznámek.
Úplný popis jednotlivé položky otevřete kliknutím na její název v tabulce.
Pod názvem není samostatný odkaz pro rozbalení; zobrazení celého textu přímo
v tabulce ovládá společná volba **Zalamovat text popisu**.
Přepočet VV v detailu položky podporuje i importovaný zápis typu
`2*1 = 2,000 [A]`: počítá samotný výraz, nikoli uložený výsledek za rovnítkem.
Původní popis zůstává zachovaný; nové množství je nutné potvrdit uložením položky.

Tlačítka **+ / −** úplně vlevo před zaškrtávátkem rozbalují a sbalují objekty,
soupisy a oddíly. Výpočty a poznámky jednotlivých položek ovládá tlačítko **VV**. U řádků bez podřízeného obsahu tlačítko není.
Ovládání zůstává vlevo i při vodorovném posouvání tabulky.

Pravým tlačítkem v tabulce otevřete nabídku **Sbalit vše / Rozbalit vše** pro
objekty, soupisy, oddíly i podřízené řádky položek celého rozpočtu. Aktivní rozsah, filtry, výběr položek
i samostatně otevřené výkazy výměr zůstávají zachované. Nad buňkou je navíc volba
**Filtrovat podle této hodnoty**; samotné otevření nabídky filtr nemění.
Nabídku otevřete také klávesami Shift+F10, ovládáte šipkami a zavřete Escape.

Rekapitulace funguje jako **strom rozpočtu**: objekt → soupis → oddíly.
Odsazení ukazuje skutečné vazby mezi kapitolami; **+ / −** mají jen větve
s dalšími kapitolami. Kliknutí na název zvýrazní kapitolu ve stromu a přesune
tabulku na její začátek, také při opakovaném kliknutí. Aktivní sloupcové
filtry zůstávají zachované; pokud cíl skryjí, aplikace na to upozorní.
Hledání zobrazuje shody včetně nadřazené cesty a podřízených kapitol nalezené
větve. Po vymazání hledání se obnoví předchozí rozbalení stromu.
Pravé tlačítko ve stromu nabízí **Sbalit vše / Rozbalit vše** pouze pro strom;
při hledání ovládá nalezené větve. Šipky nahoru/dolů pohybují zaměřením,
vpravo/vlevo rozbalují/sbalují nebo přecházejí mezi rodičem a potomkem,
Home/End přejdou na začátek/konec a Enter či mezerník otevřou kapitolu.
Součty se změnou rozbalení ani hledáním nemění a respektují oprávnění k cenám.

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

### Editor oprav importu

Automatické rozpoznání zůstává výchozí cestou. **Otevřít editor oprav** otevře větší
pracovní plochu se třemi kroky: **Sloupce**, **Struktura**, **Kontrola**. Existující
pracovní verzi otevřete přes **Akce → Opravit import**; potvrzenou verzi nejprve
zkopírujte do pracovní. Uložení používá původní práva projektu a kontrolu verze.

Ve Sloupcích je vlevo náhled původních buněk a vpravo stejně široké ovládací prvky.
Sloupce vybíráte písmenem a názvem hlavičky. Náhled má nejvýše 60 řádků okolo hlavičky;
ostatní importované řádky jsou dostupné ve Struktuře po 100 řádcích. Úroveň hierarchie
lze mapovat mimo AU (číslování od 0). Volba podle profilu zachovává AU pro KROS a
ploché oddíly Globus. KROS bez platné úrovně nebo se skokem přes chybějícího rodiče
vytvoří návrh zařazení s blokující chybou, nikoli potvrzenou hierarchii.
I chybný návrh zůstává omezený na úrovně 0–32; extrémní hodnoty zdroje nesmějí
vytvořit neomezeně hluboký strom. Globus nepoužívá AU bez výslovného mapování.

Ve Struktuře vyberte řádek, jeho typ a konkrétního rodiče s úplnou cestou. Náhled
ukáže dotčené řádky a jejich cenu. Můžete přesunout celý podstrom nebo pouze vybraný
řádek; u druhé možnosti se přímé děti přesunou k jeho původnímu rodiči. Další sousední
oddíl se nemění. Rodič musí být dřívější uzel stejného soupisu, což zabrání cyklům
a zachová pořadí pro serverové ověření. **Vrátit poslední opravu** vrací poslední
změnu v otevřeném editoru. Poznámky, opakované hlavičky a mezisoučty nevstupují do
ceny. Neznámé neprázdné řádky se zachovají pro ruční klasifikaci.

**Uložit a zavřít** uloží pracovní verzi i opravy a umožní pozdější pokračování.
Blokující chyby a neúplné ocenění nadále brání potvrzení; bezcenové potvrzené rozpočty
tato změna nezavádí. Mapování se aplikuje jen na vybraný list. Má-li list ruční opravy,
jejich zrušení při novém rozpoznání vyžaduje výslovné zaškrtnutí. U uložené verze
je tento souhlas vyžadován vždy, protože načtení originálu nahradí také pozdější
úpravy cen a množství daného listu. Existující alokace
nebo štítky brání přemapování daného listu v téže verzi: použijte novou verzi a ověřený
přenos vazeb. Opravy se nikdy automaticky nepřenášejí na další soubor.
Rozpracované změny mapování jiného listu se nepoužijí. Vyřešené konflikty figur
se při přemapování jednoho listu zachovají, pokud se nezměnila množina nalezených
hodnot; při změně hodnot vyžadují nové rozhodnutí.
Při opravě uložené revize se stav její přílohy nemění. Každá změna struktury vypne
přenos vazeb a znovu vypočítá návrh podle výsledné cesty rodičů; staré návrhy přenosu
se po změně kontextu položky nepoužijí.

Originální XLSX je neměnný, vzorce se nespouštějí a všechny jeho texty se vykreslují
jako text. Limity archivu a odmítání maker či externích vazeb zůstávají zachované.
`sourcePreview` je pouze v paměti a ukládací API jej odstraňuje, protože může
obsahovat ceny mimo serverem redigované `node.source.cells`. Po otevření konceptu
je **Načíst náhled originálu** znovu stáhne přes chráněné úložiště, aniž by přepsalo
opravy. `importRepairs` ukládá pouze typ, rodiče a rozsah ruční interpretace. Ukládání používá existující audit revizí a nevyžaduje migraci.

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

## Rekapitulace a hlavní verze

**Rekapitulace** je první záložka; při otevření rozpočtu zůstávají výchozí **Položky**.
Samostatná rekapitulace má mřížku a částky v pevném sloupci vedle názvů. Tlačítko
**Zobrazit strom / Skrýt strom** ovládá boční strom u položek. Rozsah lze změnit
v nastavení; omezení na soupis je vidět také nad tabulkou a tlačítkem × je zrušíte.

Rozbalovací seznam **Verze rozpočtu** přepíná aktivní verze a pracovní kopie.
Přepnutí vyčistí výběr položek, sloupcové filtry, rozsah, otevřená VV a historii kroku Zpět.
Vyhledávání v hlavičce projektu zůstává zachované. Nová kopie nenahrazuje hlavní verzi.
**Nastavit jako hlavní** uloží společný výběr pro všechny uživatele projektu a další
otevření rozpočtu. Vyžaduje oprávnění upravovat rozpočet a číst ceny. Potvrzení
rozpočtu ani položky se tím nemění. Pokud se aktuální ID hlavní verze liší od načteného,
systém změnu odmítne s výzvou k obnovení. Jde o porovnání aktuální hodnoty, nikoli historie
změn: při mezikroku A → B → A lze volbu založenou na A znovu uložit.
Po přesunu hlavní verze do koše se jako nová hlavní uloží nejstarší zbývající aktivní verze;
obnovení původní verze z koše tento výběr nezmění. Pokud žádná aktivní verze nezbývá,
hlavní se stane první obnovená nebo nově vytvořená verze. Nový projekt bez výslovné volby
používá nejstarší aktivní verzi, takže nové kopie nemění výchozí rozpočet.

**Převzít do plánu VŘ** je poslední, neaktivní akce označená „Připravujeme“.
Z této obrazovky nyní nelze měnit plánované částky VŘ.
Navazující migrace `20260920080712_harden_budget_validation_and_plan_rollout.sql`
odebírá klientské spuštění veřejného i soukromého RPC této nevydané funkce.


### Kompaktní ovládání rozpočtu

Záložky **Rekapitulace**, **Položky** a **Importy a verze** sdílejí jednu lištu s tlačítky **Verze**, **Zobrazit/Skrýt strom** a **Akce**. Menu **Verze** obsahuje přepínání rozpočtů a nastavení hlavní verze. Menu **Akce** obsahuje vytvoření pracovní kopie, potvrzení rozpočtu a případné vrácení poslední úpravy; připravované převzetí do plánu VŘ zůstává poslední a neaktivní. Firemní číselníky jsou vpravo před nastavením. Menu nezabírají další řádky nad tabulkou; zavřou se klávesou Escape, přesunem fokusu nebo kliknutím mimo. Na úzké obrazovce se lišta podle potřeby zalomí.

Přepínač bočního stromu a nastavení rozsahu se zobrazují pouze v záložce **Položky**. Samostatná rekapitulace vždy zobrazuje celý rozpočet; návrat do položek zachová dříve zvolený rozsah i stav bočního stromu.

Rozbalená VV se zachovávají při přepínání záložek a vyčistí se při změně verze. Firemní číselníky lze otevřít i před prvním importem a na kartě Importy a verze. Pokud selže obnovení indexu a jsou dostupná uložená data v paměti, rozpočet zůstane zobrazený s chybou a možností opakování. Nabídky upravují svou polohu podle okrajů obrazovky.

Vyčištění výběru, rozsahu, filtrů a kroku Zpět platí také při změně otevřené hlavní verze po obnovení dat. Krok Zpět je navíc svázaný s ID konkrétní revize. Tlačítko VV i checkbox jsou svisle vystředěné ve svých buňkách, včetně vyšších řádků.

Kompaktní lišta používá ikony společně s textovými popisky. Všechna její tlačítka mají stejnou výšku 36 px, nabídky Verze a Akce označuje šipka. Na menší obrazovce se ovládání zalamuje; názvy sekcí zůstávají čitelné.

V **Nastavení zobrazení → Zobrazit mřížku** zapnete výraznější vodorovné a svislé
ohraničení buněk tabulky položek, včetně VV, záhlaví a součtů. Volba je ve výchozím
stavu vypnutá a ukládá se v tomto prohlížeči zvlášť pro uživatele a projekt, stejně
jako hustota řádků. Nemění data rozpočtu ani samostatnou mřížku rekapitulace.

Při opravě uložené revize nelze položku se štítky nebo alokacemi změnit na necenový typ ani vyřadit její soupis. Editor omezení zobrazí před uložením; vazby je nutné nejprve vyřešit v rozpočtu. Změna práce na materiál a přesun v hierarchii vazby zachovávají.
### Záloha, obnova a mazání projektu

Záloha uživatele i firmy zahrnuje dostupné rozpočty, revize, alokace, historii,
hlavní verzi, číselníky a původní XLSX. Pro úplnou zálohu je nutné oprávnění
číst rozpočty včetně cen. XLSX se kontrolují pomocí SHA-256; chybějící soubor
hotového rozpočtu nebo překročení limitu 50 MB ukončí export chybou.
Starší klient při přítomnosti rozpočtu vyžádá aktualizaci, místo aby vytvořil
neúplnou zálohu.

Rozpočtová část zálohy je podepsaná databází. Obnova odmítne pozměněný obsah,
cizí organizaci nebo projekt mimo oprávnění uživatele. Doplňuje chybějící
revize; existující revize a jejich historie zůstávají autoritativní. Pokud po
obnově dat selže nahrání XLSX, aplikace vyzve k opakování stejné obnovy.
Původní soubory se nepřepisují.

Mazání projektu nejprve uzamkne rozpočty proti dalším změnám, odstraní jejich
soubory přes Storage API a teprve potom smaže databázové záznamy a projekt.
Po výpadku opakujte mazání stejného projektu. Rozpracované samostatné mazání
v koši rozpočtu je nutné nejprve dokončit.

Export položek do Excelu zapisuje množství a ceny jako textové buňky, aby
zachoval všechny číslice. Prázdné množství při přiřazení do VŘ znamená dosud
nepřiřazené množství, nikoli celé množství položky.

Náhled má nejvýše 60 řádků na list a 200 000 buněk a 1 000 000 znaků textů i vzorců za celý sešit (nejvýše 256 znaků na náhledovou hodnotu); u mnoha širokých listů ukazuje méně řádků. Chybové buňky Excelu zůstávají bez číselné hodnoty i po ruční opravě typu. Opravené mezisoučty jsou viditelné pod rozbaleným oddílem s položkami, do ceny se podruhé nezapočítávají.
Plně přiřazená položka se při dalším hromadném rozdělení přeskočí; nulové
množství nevytváří vazbu na další VŘ. Čísla mohou obsahovat nejvýše 24 číslic
před desetinnou čárkou a 18 za ní. Překročení při výpočtu ceny import ohlásí.
VŘ použité v rozpočtové revizi nelze smazat, dokud existují související revize
včetně koše; dialog uvede důvod. Historie změn uchovává původní upravené údaje
úsporně a zůstává součástí podepsané zálohy.

Demo režim záložku Rozpočet skrývá; přímý odkaz vrátí uživatele na přehled.
Kontextový filtr podle hodnoty je dostupný pouze na oceněných položkách K/M.
Firemní číselník se zálohuje samostatně i bez importovaných rozpočtů; obnova
chybějících položek vyžaduje správce organizace a platný podpis původní zálohy.

Přenos vazeb ze starší revize s alokacemi vyžaduje oprávnění přiřazovat položky
do VŘ; bez něj je volba zakázaná s vysvětlením. Smazání účtu autora ponechá
rozpočty a historii, pouze odstraní jeho identitu. Obnova po novém importu
stejného souboru zachová aktuální zdroj i revize a doplní chybějící staré revize.

Přepočet VV v detailu položky je nedostupný, dokud výraz obsahuje nevyřešenou figuru nebo jinou chybu; důvod je zobrazen pod tlačítkem. Po vyřešení figury lze výsledek připravit a samostatně potvrdit uložením položky. Rozpracované mazání celého projektu se dokončuje opakováním mazání projektu, nikoli vysypáním koše rozpočtu. Obnova starších importních revizí zachovává nejstarší a nejnovější datum převodu bez závislosti na pořadí revizí v záloze.

Zkrácený náhled je označen upozorněním. Omezení platí pouze pro náhled, původní buňky ani soubor se nemění. Limit znaků brání tomu, aby opakované dlouhé shared strings z malého XLSX zahltily renderer.

Oprava podstromu potvrzuje hierarchii všech dotčených řádků; jiné chyby rozpoznání a ocenění se tím nevyřeší. Položku s podřízeným výkazem výměr nebo poznámkami nelze změnit na necenový typ, dokud jejich zařazení neupravíte, aby zdrojové řádky nezmizely z běžného pohledu.

Mapování sloupců VŘ prochází listy tlačítky **Předchozí list / Další list**.
Pokud se nové skupiny shodují názvem nebo číslem, lze u jedné z nich zvolit
**Použít nové VŘ** a přiřadit obě skupiny ke společné nové definici. Rozdílné
kódy se bez vašeho výběru neslučují.
