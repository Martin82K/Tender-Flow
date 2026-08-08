## Tender Flow v1.9.0-beta.10

Tato beta verze navazuje na beta.9 a přidává řízené projektové týmy, globální
Smluvní přehled a bezpečnou práci s dokumenty smluv a dodatků.

### Projektové týmy a archiv

- Projekt má serverově vynucené role vlastníka, administrátora, člena a
  přechodného externího read-only přístupu.
- Vlastník nebo administrátor může spravovat realizační tým přímo v projektu;
  historická externí sdílení se převádějí na omezený režim pouze pro čtení.
- Archivovaný projekt je pouze pro čtení a jeho obnovení je vyhrazené vlastníkovi
  nebo administrátorovi projektu.

### Smluvní přehled

- Nový organizační Smluvní přehled zobrazuje řízený souhrn smluvních dat napříč
  dostupnými projekty.
- Vlastník a administrátor organizace mají přístup automaticky; běžný člen jej
  získá jen explicitním oprávněním.
- Navigace, deep-link a invalidace dat respektují stávající projektové hranice.

### Dokumenty smluv a dodatků

- PDF nebo DOCX lze doplnit ke smlouvě i dodatečně, bez opakovaného zakládání
  záznamu.
- Dodatky se zobrazují jako rozbalitelné řádky pod smlouvou a každý může mít
  vlastní dokument dostupný z tabulky i detailu.
- Upload při chybě zápisu metadat uklidí osiřelý soubor a zachová konzistentní
  stav evidence.

### Bezpečnost a kvalita

- Dokumenty zůstávají v privátním Supabase Storage bucketu chráněném RLS;
  otevření používá krátkodobý podepsaný odkaz.
- Upload přijímá pouze PDF/DOCX do 20 MiB a databáze kontroluje povolené typy i
  vazbu dokumentu na projekt.
- Projektová oprávnění, archivace a Smluvní přehled jsou vynucené databázově,
  nikoli pouze skrytím prvků v uživatelském rozhraní.
- Triggerová ochrana archivovaných projektů už není vystavená jako veřejně
  spustitelné RPC pro anonymní ani přihlášené klienty.

### Omezení beta verze

- Jde o pre-release určený k testování, ne o stabilní produkční vydání.
- Windows instalátor sestavený lokálně na macOS vyžaduje finální runtime smoke
  test ve Windows prostředí.
- Funkce vyžadují nasazené databázové migrace projektových týmů a dokumentů
  dodatků v cílovém Supabase projektu.
