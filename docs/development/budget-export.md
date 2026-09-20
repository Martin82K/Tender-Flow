# XLSX export rozpočtu a poptávky

Rozšíření navazuje na import VŘ `42e37395`; vlastní PR obsahuje pouze export.
Rozsah (celý rozpočet / VŘ / označené položky) je nezávislý na volbě cen.
U VŘ pochází množství z autoritativních alokací, nikoli z textu `node.tenders`.
Součty za objekty, soupisy a oddíly obsahují jen exportované listové položky.
Strom se seřadí průchodem po rodičích, takže pododdíly zůstávají uvnitř svého oddílu.
Dílčí alokace stejné položky/VŘ přesně sečte bez zaokrouhlení množství.
Překročená množství, chybějící rodiče a cykly export odmítne.

## Bezpečnost a životní cyklus

Export je lokální vytvoření nového workbooku z explicitního seznamu polí.
Nikdy se neklonuje zdrojový sešit, metadata, poznámky, skryté listy nebo vzorce.
Vstupní text začínající `=` zůstává textem. Varianta bez cen nečte cenové hodnoty
pro výpočty, nevkládá interní štítky a má prázdné cenové vstupy. Nové vzorce jsou
sestavené jen z programem určených adres buněk, nikoli z uživatelských výrazů.
Nemají externí odkazy ani uložené interní částky. Číselné řetězce zůstávají přesné;
výpočet dodavatele podléhá běžné přibližné numerické přesnosti Excelu.

Cenový export vyžaduje explicitní oprávnění v kontraktu exporteru i UI; serverový
redigovaný rozpočet zůstává primární datovou hranicí. Export nic nezapisuje do DB,
nemění zálohy, účet ani projekt, neodesílá soubory dodavatelům. Nevznikají nové
runtime závislosti ani migrace. Stažený soubor je nezávislá uživatelská kopie.

## Výpočtový kontrakt

Poptávková položka: `IF(AND(ISNUMBER(Fn),En<>""),ROUND(NUMBERVALUE(En,".",",")*Fn,2),"")`.
XLSX používá prefix `_xlfn.` pro NUMBERVALUE. Přepočet není cachován interní cenou.
Prázdný nebo textový vstup ponechá výsledek prázdný; číselná nula je platná.
Mezisoučty a celková rekapitulace používají jen typy K/M. `COUNTIFS` nejprve
ověří úplnost, teprve pak `SUMIF` sčítá; nezahrnuje nadřazené mezisoučty podruhé.
Řádky rekapitulace odkazují na vlastní skupiny listu Rozpočet.

Celý oceněný rozpočet zachovává uložené částky. Oceněné VŘ počítá alokované
množství × jednotková cena, zaokrouhlené po položkách. Neúplné součty jsou prázdné.

## Ověření pracovního diffu nad 42e37395

- RED: chybějící nové API exportu; GREEN cílené testy rozsahů, přesnosti, hierarchie,
  cenového oprávnění, úniku dat po XLSX roundtrip, neplatných alokací a neúplnosti.
- `constructionBudgetExportDialog.test.tsx`: nezávislá volba VŘ a cen, zákaz cen bez
  oprávnění, zachování označeného výběru.
- Sestavený UI harness: Chrome desktop 1440 a mobil 390 px, výběr VŘ, skutečné
  stažení obou variant, bez chyb konzole a bez přetečení stránky. Syntetická data.
- Nativní LibreOffice: přepočet a znovunačtení pěti kopií skutečného staženého XLSX.
  Množství 3.125 a 2, ceny 20 a 30 → 62.50 + 60 = 122.50. Nulová první cena → 60.
  Obě prázdné / jedna chybějící / neplatný text → celkový součet prázdný. Žádné
  chybové buňky. Testovací read/write musí zachovat `xlfn:true`; jinak SheetJS
  odstraní namespace moderní Excel funkce. Produkční exporter zdrojový workbook
  neznovunačítá. Microsoft Excel samotný v tomto průchodu ověřen nebyl.
- Typecheck a web build prošly. Build hlásí existující velké chunky; nativní runtime
  hlásí konfiguraci fontconfig cache, výpočty tím nebyly dotčené.
- Boundary, legacy a docs kontroly prošly; desktop API se nemění.

Finální CI a nezávislá PR bezpečnostní revize musí odpovídat konečnému commitu a
integrační základně. Soukromý dodaný XLSX není testovací fixture ani součást PR.

Nezávislá revize #490 upozornila na platné opakované alokace položky do stejného VŘ.
Regresní test zachovává součet `1.000000000000000001 + 2.125` přesně jako
`3.125000000000000001`; peněžní zaokrouhlení nastává až po celém množství položky.

Finální review neúplných pracovních revizí: uložený total se u oceněného celého
rozpočtu/výběru nepoužije, pokud chybí unitPrice. Řádek i rekapitulace zůstanou
neúplné. Dvě regrese nejprve selhaly; po opravě prošlo 12 exportních/UI testů
a typecheck nad main `7de7ad4b`. Finální CI a bezpečnostní revize se vztahují
k publikované opravě; databáze ani formát vzorců se nemění.

Navazující regrese pokrývají všechna tři povinná číselná pole: množství,
jednotkovou cenu a celkovou částku, pro celý rozpočet i výběr. Chybějící pole
ponechá součet prázdný; nula zůstává platná. Dvě RED regrese pro množství po
opravě prošly společně se 17 exportními/UI testy a typecheckem (diff po a275537b,
base main 7de7ad4b). Ocenění VŘ nadále vychází z jeho přiděleného množství.
