# Katalog funkcí

Katalog vychází z `features/`, `app/featureRegistry/manifests.ts`, `types.ts` a
`config/features.ts`. Dostupnost konkrétní funkce závisí na tarifu, roli,
platformě a backendové konfiguraci.

## Hlavní navigační views

| View | URL | Účel | Gate |
| --- | --- | --- | --- |
| TODO Osobní | `/app/todo` | osobní a projektové úkoly | `module_tasks` podle plánu |
| Command Center | `/app/command-center` | KPI, projekty, kalendář, aktivita a signály | `module_command_center` |
| Správa projektů | `/app/projects` | vytváření, archivace, sdílení a klonování projektů | `module_projects` |
| Projekt | `/app/project/:id` | detail projektu a jeho pracovní moduly | `module_projects` |
| Kontakty | `/app/contacts` | dodavatelé, osoby, import, rating a mapová data | `module_contacts` |
| Přehled projektů | `/app/project-overview` | agregované reporty napříč projekty | `feature_advanced_reporting` |
| URL zkracovač | `/app/url-shortener` | vytváření a správa krátkých odkazů | `url_shortener` |
| Nastavení | `/app/settings` | uživatel, nástroje, organizace a administrace | role/feature podle podsekce |

Výchozí přihlášená route je `/app/todo`.

## Projektová pracovní plocha

Projekt podporuje taby:

- **Přehled** – základní údaje, finanční a stavové souhrny.
- **Plán výběrových řízení** – časový plán soutěží a vazba na kategorie.
- **Pipeline** – poptávkové kategorie, dodavatelé, nabídky a komunikace.
- **Harmonogram** – projektové termíny a exporty; dostupnost podle plánu.
- **Dokumenty** – projektová dokumentace, šablony, DocHub a ceníky.
- **Smlouvy** – kontrakty, dodatky, fakturace, retence a hodnocení dodavatelů.
- **Mapa** – projekt, dodavatelé, trasy, doporučení a geokódování.

## Feature oblasti

### Autentizace

Přihlášení, registrace, MFA, zapomenuté heslo, reset hesla, biometrika na
podporovaném desktopu a potvrzení právních dokumentů. Reset hesla podporuje web
i Electron deep-link tok.

### Projekty a výběrová řízení

Správa projektů, soutěž/realizace/archiv, klonování soutěže do realizace,
sdílení, přehled, tender plan, pipeline, harmonogram, dokumenty, kontrakty a
exporty. Viditelnost klienta je defense-in-depth; autoritativní přístup řídí DB.

### Kontakty

Evidence subdodavatelů a kontaktních osob, specializace, regiony, poznámky,
rating, import a rychlé vložení. Mapová feature používá adresy a souřadnice.

### TODO

Osobní a projektové úkoly, stromové členění, termíny, rychlé založení a mutace.
Serverový stav používá samostatné React Query klíče.

### Command Center

Skládá moduly KPI, pipeline funnel, finance gauge, matrix health, projekty,
kalendář, activity feed a odvozené akce. Rozšířené moduly jsou tarifně řízené.

### Organizace a subscription

Přehled organizace, členové a role, žádosti o vstup, branding, billing a
subscription. Administrátorské obrazovky spravují uživatele, organizace,
tarify a feature override hodnoty.

### Notifikace

Centrum notifikací, unread stav, Realtime subscription, uživatelské preference,
desktopové notifikace a krátkodobé toast zprávy.

### Zálohy

Nastavení a plánování záloh. Desktop umí pracovat s lokálním souborovým
systémem a šifrovanými zálohami; dostupnost závisí na plánu a platformě.

### Mapy

Geokódování, vyhledávání adres, vrstvy, filtry, radius, trasy, nearby pohledy,
bulk geocode a doporučení subdodavatelů. Některé funkce mají vlastní feature
flag a používají serverový proxy přístup.

### Nástroje

URL zkracovač, Excel Unlocker, Excel Merger, Excel Indexer, bid comparison agent,
DocHub a šablony. Nativní nebo lokální nástroje mohou být pouze desktopové;
web používá HTTP/Edge variantu, pokud je nakonfigurovaná.

### Voice assistant

Desktopový/admin scénář s Realtime session, WebRTC klientem, textovým fallbackem
a omezenou sadou datových tools. Dostupnost závisí na roli, platformě, route a
feature konfiguraci.

### Nápověda a What's New

Kontextová nápověda, vyhledávání, klávesové ovládání, discovery indikátory a
modál změn verze.

### Veřejné stránky

Landing/SEO prvky, cookies banner, podmínky, ochrana soukromí, DPA a imprint.
Krátké odkazy používají veřejnou route `/s/:code` s bezpečným resolverem.

## Tarifní model

Konfigurace obsahuje tarify `free`, `starter`, `pro` a `enterprise`. Enterprise
zahrnuje všechny aktuálně registrované feature keys. Desktopová aplikace navíc
v `AppContent` povoluje přístup pouze tarifům `enterprise` a `admin`; ostatní
uživatele směruje na subscription nastavení.

## Plánované položky

`MODULE_INVOICING` a `MODULE_DOCUMENTS` jsou v `config/features.ts` označené
jako plánované. Existující smluvní/dokumentové obrazovky nejsou důkazem, že
tyto dva samostatné budoucí moduly mají hotový veřejný kontrakt.
