# Tender Flow – Uživatelská příručka

Tato příručka popisuje práci v aplikaci Tender Flow pro řízení staveb, výběrových řízení a subdodavatelů.

![Tender Flow logo](./assets/logo.png)

## Obsah

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

Autorem a vlastníkem aplikace Tender Flow je **Martin Kalkuš** (`martinkalkus82@gmail.com`), provozovatel služby `tenderflow.cz`.

© `2025` Martin Kalkuš. Všechna práva vyhrazena.

---

Verze: **1.0** • Datum: **2025‑12‑14**
