## Tender Flow v1.9.0-beta.11

Tato beta verze navazuje na beta.10 a rozšiřuje řízení projektových rolí,
Smluvní přehled a práci s tabulkou poptávek.

### Projektové role a oprávnění

- Projektová oprávnění používají úplnou matici profesních rolí a jednotné
  serverové vyhodnocení přístupu.
- Profesní role se spravují na úrovni členství v organizaci a lze je nastavovat
  v organizační administraci i projektovém týmu.
- Přístup do Smluvního přehledu respektuje organizační roli, explicitní
  oprávnění a rozsah projektů dostupných konkrétnímu uživateli.

### Smluvní přehled

- Přehled nabízí rozšířenou sadu smluvních sloupců a uživatelské nastavení
  jejich viditelnosti.
- Projekty lze vybírat přímo v tabulce a exportovat pouze data, ke kterým má
  uživatel oprávnění.
- Rozložení, filtry a ovládací prvky byly upravené pro přehlednější práci s
  větším množstvím smluvních dat.

### Poptávky

- Tabulka poptávek má kompaktnější a stabilnější rozložení pro každodenní práci.
- Nastavení zobrazení tabulky se ukládá jako uživatelská preference.
- Ovládací prvky a výběry používají sjednocené komponenty a lépe navazují na
  aktuální vizuální styl aplikace.

### Bezpečnost a kvalita

- Databázové migrace rozšiřují roli-based access control a zachovávají kontrolu
  přístupu na serverové straně.
- Smluvní přehled omezuje dotazy i export podle skutečně dostupných projektů;
  nejde pouze o skrytí prvků v uživatelském rozhraní.
- Změny pokrývají regresní testy rolí, oprávnění, přehledu smluv a rozložení
  tabulky poptávek.

### Omezení beta verze

- Jde o pre-release určený k testování, ne o stabilní produkční vydání.
- Funkce vyžadují nasazené databázové migrace rolí a Smluvního přehledu v
  cílovém Supabase projektu.
- Desktopové balíčky vyžadují finální runtime smoke test na cílovém macOS a
  Windows prostředí.
