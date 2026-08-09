## Tender Flow v1.9.0-beta.12

Tato beta verze nahrazuje beta.11 a obsahuje stejné rozšíření projektových
rolí, Smluvního přehledu a tabulky poptávek doplněné o lifecycle opravu
načítání smluv.

### Oprava stability

- Rozpracované načítání smluv se při opuštění projektu bezpečně zneplatní.
- Opožděná odpověď už po odpojení komponenty nespouští React update.
- Regresní test pokrývá změnu projektu i odpojení komponenty během načítání.

### Obsah převzatý z beta.11

- Úplná matice profesních projektových rolí a serverově vynucených oprávnění.
- Rozšířený Smluvní přehled s volitelnými sloupci, projektovým filtrem a
  exportem omezeným na dostupné projekty.
- Kompaktnější tabulka poptávek s uloženými uživatelskými preferencemi.

### Omezení beta verze

- Jde o pre-release určený k testování, ne o stabilní produkční vydání.
- Funkce vyžadují nasazené databázové migrace rolí a Smluvního přehledu.
- Desktopové balíčky vyžadují finální runtime smoke test na cílovém macOS a
  Windows prostředí.
