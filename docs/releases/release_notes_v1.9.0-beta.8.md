## Tender Flow v1.9.0-beta.8

Tato beta verze navazuje na beta.7 a přináší nový globální skin Nature,
sjednocené ovládání vzhledu a kompaktnější projektové pracovní plochy.

### Nature a společný systém vzhledu

- Nový skin Nature nabízí světlou lesní a tmavou noční variantu s lokálními
  obrazovými assety a chráněnými datovými povrchy.
- Nastavení, formuláře, nabídky motivu a přepínače režimu nyní používají
  společnou tokenovou vrstvu napříč skiny Classic, Industrial, Botanica a
  Nature.
- Přepínač světlého, tmavého a systémového režimu je sdílený mezi profilem a
  avatarovým menu, včetně klávesnicového focusu a přístupných stavů.
- Logo Tender Flow zůstává beze změny; Nature používá pro aktivní a focus stavy
  přístupnou lesní zelenou a zachovává sémantické chybové barvy.

### Kompaktní projektové a kalendářové plochy

- Projektový přehled, dokumenty, cenové nabídky a výběrová řízení lépe využívají
  dostupnou plochu a zachovávají čitelnost hustých dat.
- Kalendář a osobní úkoly mají sjednocené ovládání účtu a vzhledu.
- Přehled smluv a fakturace investorům zpřesňuje čtení i úpravy souvisejících
  záznamů.

### Bezpečnost a spolehlivost

- Aktivní přihlášení jsou omezená a oprávnění databázových triggerů jsou
  zpřísněná.
- Lokální lesní assety neobsahují externí URL, fonty, trackery ani aktivní obsah.
- Release zachovává stávající autentizaci, IPC hranice a uživatelská data.

### Omezení beta verze

- Jde o pre-release určený k testování, ne o stabilní produkční vydání.
- Windows instalátor sestavený lokálně na macOS vyžaduje finální runtime smoke
  test ve Windows prostředí.
- macOS build bez dostupné Developer ID identity není notarizovaný ani podepsaný
  pro distribuci mimo vývojové prostředí.
