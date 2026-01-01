# Tender Flow – Uživatelská příručka

Tato příručka popisuje práci v aplikaci Tender Flow pro řízení staveb, výběrových řízení a subdodavatelů.

Verze příručky: **1.2** • Datum: **2026‑01‑01** • Aplikace: **v0.9.3-260101**

![Tender Flow logo](./assets/logo.png)

## Obsah

- [Novinky (poslední změny)](#novinky-poslední-změny)
- [Účel a role](#účel-a-role)
- [Přihlášení a účet](#přihlášení-a-účet)
- [Navigace v aplikaci](#navigace-v-aplikaci)
- [Dashboard](#dashboard)
- [Detail stavby (záložky)](#detail-stavby-záložky)
- [Plán VŘ](#plán-vř)
- [Výběrová řízení (Pipeline)](#výběrová-řízení-pipeline)
- [Dokumenty a šablony](#dokumenty-a-šablony)
- [Subdodavatelé (Kontakty)](#subdodavatelé-kontakty)
- [Správa staveb](#správa-staveb)
- [Přehled staveb (analytika)](#přehled-staveb-analytika)
- [Nastavení aplikace](#nastavení-aplikace)
- [Administrace systému](#administrace-systému)
- [Registrace a whitelist](#registrace-a-whitelist)
- [Seznam povolených emailů](#seznam-povolených-emailů-whitelist)
- [Správa uživatelů a rolí](#správa-uživatelů-a-rolí)
- [Import a synchronizace kontaktů](#import-a-synchronizace-kontaktů)
- [AI funkce](#ai-funkce)
- [Časté otázky](#časté-otázky)

---

## Novinky (poslední změny)

Verzi aplikace najdete vlevo dole v sidebaru.

### v0.9.3-260101

- **Hlavní stránka / DEMO**: pro ceník a možnost „DEMO“ bylo vytvořeno demo s provizorními (generovanými) daty pro možnost seznámení se s aplikací.
- **Funkčnost (AI)**: úprava AI backendové části pro lepší a rychlejší fungování; implementace cache AI, aby nedocházelo k neustálému volání a přegenerování reportů.
- **Dashboard / Stavba (UX)**: vylepšený přehled poptávek pro rychlejší práci; nově je možné prokliknout se z přehledu přímo do kanbanu dané poptávky.
- **Dashboard / Stavba (UX)**: UX vylepšení obsahuje také pop‑okna v designu aplikace.

### v0.9.2

- **Sidebar**: přidána možnost tlačítkem schovat postranní panel a získat tak větší plochu a lepší čitelnost.
- **Hlavní stránka**: vytvořena nová landing page se základními informacemi o aplikaci.
- **Routy přihlášení/registrace**: přihlášení a vytvoření účtu jsou na samostatných routách `tenderflow.cz/login` a `tenderflow.cz/register`.

### v0.9.1

- **Subdodavatelé**: možnost přidávat další specializace bez nutnosti zdvojovat dodavatele v databázi.
- **Kontakty**: k jednomu subdodavateli lze evidovat více kontaktů (posiluje potřebu mít jen jednoho dodavatele).
- **Databáze**: provedena úprava databáze v návaznosti na změny dle updatu.
- **Import kontaktů**: import/synchronizace slučuje záznamy podle názvu firmy (case-insensitive) a doplňuje specializace i kontakty bez duplicit.

### v0.9.0

- **Whitelist (registrace)**: registrace není povolena všem uživatelům, ale jen těm, kteří jsou na whitelistu (prozatímní řešení pro postupnou integraci).
- **Poznámka**: whitelist dočasně nahrazuje možnost vlastního mailového hostingu, která bude potřeba dále implementovat.
- **Role**: systém obsahuje kritickou roli **admin** pro možnost nastavení dodatečných rolí; každý tenant má svého „administrátora“.
- **Seznam rolí v tomto updatu**: Přípravář • Hlavní stavbyvedoucí • Stavbyvedoucí • Technik.
- **Práva dle rolí**: každá role určuje, k čemu má uživatel přístup a jaké akce může provádět; nejvyšší práva má aktuálně **Přípravář** (hlavní uživatel a zadavatel dat).
- **Databáze**: proběhla úprava databáze, tabulek a správy dat, aby vyhovovala nově aplikovaným procesům a funkcím.

### v0.8.0

- **Dashboard**: srdcem aplikace je přístup ke všem stavbám uživatele a rychlému přehledu základních informací; možnost přepínání staveb přes rozevírací menu.
- **Subdodavatelé**: přidán nový stav „nedoporučuji“ pro možnost varování kolegů před použitím problémového subdodavatele.
- **Správa staveb**:
  - ve vašich seznamech staveb nyní vidíte i sdílení,
  - archivace stavby: při archivaci se stavba přesune do archivu (pole `archiv`), odebere se z bočního panelu Stavby,
  - archivované stavby lze vrátit zpět tlačítkem pro obnovu,
  - sdílení zůstává stejné; je vidět seznam sdílených osob a lze je odebrat,
  - propsání stavby jinému uživateli může trvat několik minut.
- **Stavby (sidebar)**: nově lze stavby přesouvat a měnit jejich pořadí; funkce je experimentální (může být odebrána).
- **Přehled stavby**:
  - přepracovaný vzhled (jednodušší a přehlednější),
  - panelové zobrazení poptávek nahrazeno tabulkovým zobrazením,
  - přidána tabulka s bilancí výběrů a přehledem stavu,
  - filtrování přehledu: všechny | poptávané | ukončené | zasmluvněné,
  - probíhá testování logiky (mohou se objevovat dodatečné opravy výjimek funkčnosti).
- **Plán VŘ** (nový modul):
  - možnost vytvořit výběrové řízení a přidat mu průběh (od–do),
  - po vytvoření se vygeneruje tlačítko „Vytvořit“ a stav VŘ „čeká na vytvoření“,
  - stiskem „Vytvořit“ dojde k vytvoření výběru ve Výběrových řízeních a stav se přepne na „probíhá“,
  - stav vždy reflektuje průběh daného výběrového řízení.
- **Výběrová řízení (dříve pipelines)**:
  - přejmenování pro intuitivnější navigaci,
  - možnost vytvářet vlastní šablony poptávky do emailu,
  - filtrování dle stavu,
  - karta poptávky obsahuje cenu SOD v základu; pokud má výběr vítěze, přepíše se na cenu vítěznou,
  - karta nabídky zaznamenává až 3 kola VŘ; do aktuální ceny se počítá aktivně vybrané kolo,
  - karta subdodavatele zobrazuje všechny jeho ceny z jednotlivých kol (případně poznámku),
  - přesunutím karty na vítězné pole se zobrazí ikona poháru (vítěz),
  - pro vítěze se zobrazuje ikona smlouvy: šedo‑bílá → blikající odškrtnutí (smlouva vyřízena),
  - stav smluv se zobrazuje také na kartě VŘ (např. 0/2 = dva vítězové, nula smluv),
  - po aktivaci všech smluv se zobrazí plaketka s odškrtnutím (hotovo),
  - uzavření výběru probíhá na kartě daného výběru,
  - export do Excelu a PDF (formát dokumentu se bude dále ladit),
  - email nevybraným: otevře výchozí emailový klient se zprávou pro všechny relevantní subdodavatele; odesílání je přes skrytého příjemce (BCC).
- **Přehled staveb**:
  - rozevírací menu pro možnost přepnutí stavby,
  - pilotní analýza pomocí umělé inteligence (TenderFlow AI),
  - export analýzy do PDF (časové razítko a možnost sdílení),
  - analýza vychází z dostupných dat (množství informací, spuštěná VŘ, stav rozpracovanosti).

## Účel a role

Tender Flow je centrální místo pro evidenci staveb a řízení výběrových řízení: od plánování poptávek, přes oslovení subdodavatelů, až po vyhodnocení nabídek a evidenci vítěze.

Pozn.: odeslání emailu probíhá přes váš výchozí emailový klient (funkce používá `mailto:`).

## Přihlášení a účet

1. Zadejte email a heslo.
2. Klikněte na **Přihlásit**.
3. Odhlášení najdete dole v levém panelu (ikonka `logout`).

![Schéma přihlášení](./assets/01-login.svg)

## Navigace v aplikaci

V levém panelu (sidebar) přepínáte hlavní části aplikace a vybíráte konkrétní stavbu.

- **Dashboard** – přehled vybrané stavby a export.
- **Stavby** – seznam staveb (projekty).
- **Subdodavatelé** – databáze kontaktů.
- **Přehled staveb** – analytika napříč stavbami.
- **Správa staveb** – vytváření, archivace, sdílení.
- **Nastavení** – vzhled, statusy kontaktů, import.

![Schéma navigace](./assets/02-navigation.svg)

## Dashboard

Dashboard zobrazuje přehled jedné vybrané stavby. V hlavičce můžete přepnout stavbu a vyexportovat XLSX.

![Schéma dashboardu](./assets/03-dashboard.svg)

## Detail stavby (záložky)

Po kliknutí na stavbu v sidebaru se otevře detail se záložkami:

- **Přehled** – rozpočty, stav, metriky.
- **Plán VŘ** – plánování výběrových řízení.
- **Výběrová řízení** – pipeline poptávek a nabídek.
- **Dokumenty** – odkazy na dokumentaci a šablony poptávek.

![Schéma záložek stavby](./assets/04-project-tabs.svg)

## Plán VŘ

Plán VŘ slouží k naplánování VŘ v čase a (dle potřeby) k jejich převodu do poptávek.

![Schéma Plánu VŘ](./assets/11-tender-plan.svg)

## Výběrová řízení (Pipeline)

Výběrová řízení jsou organizovaná po **poptávkách** (kategorie prací). Nabídky subdodavatelů přesouváte mezi sloupci (drag & drop).

![Schéma pipeline](./assets/05-pipeline-board.svg)

### Stavy nabídky (sloupce)

- **Oslovení** – připraven k oslovení (může se zobrazit „Generovat poptávku“).
- **Odesláno** – poptávka odeslána, čeká se na reakci.
- **Cenová nabídka** – dorazila nabídka.
- **Užší výběr** – shortlist.
- **Jednání o SOD** – finalisté / jednání.
- **Odmítnuto** – neúspěšní.

### Karta nabídky

Na kartě nabídky evidujete cenu, tagy, poznámky a případně generujete poptávkový email.

![Schéma karty nabídky](./assets/06-bid-card.svg)

## Dokumenty a šablony

V záložce **Dokumenty** nastavíte:

- odkaz na dokumentaci stavby (Drive/SharePoint apod.),
- šablonu poptávkového dopisu (URL, nahraný soubor nebo výběr ze správce šablon).

![Schéma dokumentů a šablon](./assets/10-documents-templates.svg)

## Subdodavatelé (Kontakty)

Databáze kontaktů pro přidávání do poptávek. Podporuje filtry, výběr více řádků a hromadné akce (např. doplnění regionu pomocí AI – pokud je povoleno).

- **Více kontaktů na firmu**: u jedné firmy můžete evidovat více kontaktních osob (jméno, pozice, telefon, email).
- **Více specializací**: specializace jsou seznam (používá se pro filtrování i výběr do poptávek).

![Schéma kontaktů](./assets/07-contacts.svg)

## Správa staveb

Slouží pro vytváření staveb, změny statusu, archivaci a sdílení (dle oprávnění).

![Schéma správy staveb](./assets/08-project-management.svg)

Sdílení podporuje dvě úrovně oprávnění: **Úpravy** a **Pouze čtení**.

![Schéma sdílení: oprávnění Úpravy vs Pouze čtení](./assets/16-project-sharing-permissions.svg)

## Přehled staveb (analytika)

Manažerské souhrny napříč stavbami: metriky, grafy a volitelně AI analýza.

![Schéma přehledu staveb a AI](./assets/12-project-overview-ai.svg)

## Nastavení aplikace

- **Vzhled** – tmavý režim, primární barva, pozadí.
- **Statusy kontaktů** – definice statusů a barev.
- **Import kontaktů** – synchronizace z URL, ruční CSV upload.
- **Administrace** – registrace, whitelist, uživatelé/role (admin/superadmin).
- **AI nastavení** – zapnutí AI a správa promptů (admin).

![Schéma nastavení](./assets/09-settings.svg)

## Administrace systému

Administrace je dostupná jen vybraným účtům. V aplikaci rozlišujeme:

- **Admin** – správa registrací, whitelistů a AI nastavení.
- **Superadmin** – navíc správa uživatelů a rolí (oprávnění).

Tip: pokud v Nastavení nevidíte sekce „Administrace systému“, nemáte potřebná oprávnění.

## Registrace a whitelist

V sekci **Nastavení registrací** (Admin) určíte, kdo se může do Tender Flow registrovat:

- **Povolit registrace všem** – pokud je zapnuto, registrace nejsou omezené doménami.
- **Whitelist domén** – registrace povolené jen pro vybrané domény (např. `@firma.cz`).
- **Vyžadovat whitelist emailů** – registrace pouze pro emaily explicitně uvedené v seznamu.

![Schéma nastavení registrací](./assets/13-registration-settings.svg)

## Seznam povolených emailů (Whitelist)

Pokud je zapnuté „Vyžadovat whitelist emailů“, mohou se registrovat pouze emaily uvedené v tomto seznamu.

1. Otevřete **Nastavení → Administrace systému**.
2. V sekci „Seznam povolených emailů“ přidejte email, jméno a poznámku.
3. U záznamu lze přepínat aktivní/neaktivní stav.

![Schéma whitelistu emailů](./assets/14-email-whitelist.svg)

## Správa uživatelů a rolí

Sekce Správa uživatelů je určená pro **Superadmina**. Umožňuje:

- spravovat role uživatelů (přiřazení role),
- definovat oprávnění rolí (permissions).

![Schéma správy uživatelů a rolí](./assets/15-user-management-roles.svg)

## Import a synchronizace kontaktů

Kontakty lze nahrát jednorázově z CSV nebo synchronizovat z URL (např. export z Google Sheets).

Očekávaný formát (typicky): `Firma, Jméno, Specializace, Telefon, Email, IČO, Region`

Poznámky k importu:

- Slučuje se podle názvu firmy (case-insensitive).
- Import doplní specializace (sloučí do seznamu) a kontaktní osoby (bez duplicit podle jména/emailu/telefonu).
- Primární kontakt (první v seznamu) se používá pro kompatibilitu i pro akce, které potřebují email.

## AI funkce

- Doplnění regionů u kontaktů (hromadně).
- AI analýza v přehledech (dle nastavení).

## Časté otázky

### Neotevře se emailový klient

Zkontrolujte výchozí emailový klient v systému. Funkce „Generovat poptávku“ používá `mailto:`.

### Některé volby nevidím

Některé sekce jsou dostupné jen pro administrátory.

---

## Informace o autorství a právech k aplikaci

Aplikace Tender Flow byla navržena a vyvinuta jejím autorem a vlastníkem jako komplexní softwarové řešení pro podporu práce s veřejnými zakázkami.

Veškerá autorská práva, majetková práva a práva k dalšímu vývoji, úpravám, rozšiřování, distribuci a monetizaci aplikace Tender Flow jsou plně vyhrazena jejímu vlastníkovi.

Bez předchozího výslovného písemného souhlasu vlastníka není dovoleno aplikaci ani její části:

- upravovat, kopírovat nebo jinak zpracovávat,
- distribuovat třetím osobám,
- poskytovat jako součást jiných produktů nebo služeb,
- využívat ke komerčním účelům nad rámec udělené licence.

Vlastník aplikace si vyhrazuje právo na průběžné změny, úpravy funkcionality, další vývoj a změny obchodního modelu, a to bez povinnosti předchozího upozornění uživatelů.

**Autor a vlastník:**
Martin Kalkuš (martinkalkus82@gmail.com), provozovatel služby `tenderflow.cz`.

© 2025 Martin Kalkuš. Všechna práva vyhrazena.

Autorem a vlastníkem aplikace Tender Flow je **Martin Kalkuš** (`martinkalkus82@gmail.com`), provozovatel služby `tenderflow.cz`.

© `2025` Martin Kalkuš. Všechna práva vyhrazena.

---

Verze: **1.2** • Datum: **2025‑12‑31**
