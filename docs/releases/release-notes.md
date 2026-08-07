## Připravované změny

### Smlouvy a Investor

- **Výchozí tabulka smluv**: projektový modul Smlouvy se otevírá přímo v tabulkovém přehledu; přepínač Split/Tabulka a akce Nová smlouva jsou ihned pod hlavní navigací.
- **Nastavitelné sloupce**: šířky sloupců lze měnit tažením, nastavení se lokálně obnoví při příštím otevření a dlouhá čísla i názvy smluv se zalamují.
- **Originální dokument smlouvy**: PDF a DOCX lze při založení bezpečně připojit, následně otevřít ikonou přímo z tabulky a OCR zůstává volitelnou předvyplňovací vrstvou.
- **OCR při založení**: formulář čeká na dokončení OCR, předvyplní validovaná pole a ponechá uživateli závěrečnou kontrolu před uložením.
- **Investor**: doplněna evidence smlouvy s objednatelem a číslovaných dodatků, fakturační období a samostatné pozastávky do předání a po dobu záruky.
- **Přesnější úhrady**: z vystavené částky se automaticky počítají obě pozastávky a čistá částka k úhradě; jako uhrazená se vykazuje až zaplacená čistá částka.
- **Vítěz VŘ → smlouva**: pokud je vítězná nabídka jednoznačně propojená se smlouvou, ikona na kartě vítěze otevře přímo její detail; deep-link lze bezpečně obnovit i přes historii prohlížeče.

### Bezpečnost

- Dokumenty smluv jsou v privátním Supabase Storage bucketu s projektovým RLS, limitem 20 MB a omezením na ověřené PDF/DOCX. Při otevření vzniká pouze krátkodobý podepsaný odkaz.

---

## Tender Flow v1.7.0

### Nové funkce

- **Viky - hlasová AI asistentka**: nový hlasový agent pro desktopovou aplikaci, dostupný administrátorům přes feature flag `feature_voice_assistant`.
- **Hlasový a textový režim**: Viky umí odpovídat hlasem nebo vložit odpověď přímo do konverzace bez čtení nahlas.
- **Kontext projektu a smluv**: agent pracuje s dostupným kontextem staveb, smluv, kontaktů a přehledů přes kontrolované read-only nástroje.
- **Přehled nákladů relace**: panel Viky ukazuje orientační cenu relace a oddělené náklady hlasového a textového modelu.

### Provozní a bezpečnostní změny

- **Feature flag a role guard**: Viky se nezapíná automaticky pro běžné uživatele; dostupnost vyžaduje desktop, administrátorskou roli a povolený příznak funkce.
- **Read-only nástroje agenta**: nástroje pro práci s daty jsou omezené na čtení, aby hlasový agent neměnil projektová data bez explicitního aplikačního toku.
- **Telemetry metadata**: doplněny typy událostí pro textový režim Viky bez ukládání obsahu konverzací do metrik používání.

### Opravy a release změny

- **Novinky po aktualizaci**: pro verzi `1.7.0` je přeskočen in-app modal „Co je nového“, aby tento update uživatele po instalaci nerušil.
- **Verze aplikace**: minor bump na `1.7.0`.

### Instalace

Assety budou doplněny ručně před publikováním release.

#### Windows

Po doplnění assetů stáhněte instalační soubor `Tender-Flow-Setup-1.7.0.exe` nebo použijte automatickou aktualizaci ve Windows desktop aplikaci.

#### macOS (Apple Silicon)

Po doplnění assetů stáhněte soubor `Tender Flow-1.7.0-arm64.dmg` a přetáhněte aplikaci do složky Aplikace.

---

**Automatické aktualizace**: Windows desktop klient používá GitHub Releases. macOS arm64 zůstává v manuálním režimu instalace.

---

## 🎉 Tender Flow v1.5.3

### 🐛 Opravy chyb

- **WhatsNewModal**: opravena uvítací obrazovka pro zobrazení správného obsahu verze.
- **Release podklady**: doplněny chybějící release notes a aktualizována příručka pro v1.5.2.
- **Čištění projektu**: odstraněn plánovací dokument.

### 🔧 Technické změny

- **Verze aplikace**: patch bump na `1.5.3`.

### 📦 Instalace

#### Windows

Stáhněte soubor `Tender Flow Setup 1.5.3.exe` a spusťte instalaci.

#### macOS (Apple Silicon M1/M2/M3)

Stáhněte soubor `Tender Flow-1.5.3-arm64.dmg` a přetáhněte aplikaci do složky Aplikace.

---

## 🎉 Tender Flow v1.5.2

### ✨ Co je nového

- **Import wizard kontaktů**: nový průvodce pro hromadný import kontaktů a subdodavatelů s náhledem, mapováním sloupců a vyloučením řádků.
- **Hromadná úprava specializací**: hromadná úprava specializací subdodavatelů přímo v přehledu kontaktů.
- **Dodatky a vlastní náklady**: vylepšené formuláře pro dodatky a adresy, podpora vlastních nákladů u dodatků.
- **Šifrované zálohy**: AES-256-GCM šifrování záloh v desktop verzi, automatické denní zálohy, záloha kontaktů.
- **Systém nápovědy**: interaktivní kontextová nápověda s bublinami, klávesové zkratky, onboarding.
- **Automatické složky dokumentů**: DocHub vytvoří strukturu složek pro dokumenty stavby jedním kliknutím.
- **Přepracovaná příručka**: kompletně přepsaná uživatelská příručka (v2.2).

### 🐛 Opravy chyb

- **Scrollování tabulek**: opraveno horizontální scrollování v pipeline, harmonogramu a plánu VŘ.
- **Překryvy UX**: opraveny překrývající se prvky v tabulkách.
- **Delay nápovědy**: zvětšen delay zobrazení nápovědních bublin.

### 🔧 Technické změny

- **Verze aplikace**: bump na `1.5.2`.
- **Odebrání Viki**: kompletně odstraněn experimentální AI agent Viki.

### 📦 Instalace

#### Windows

Stáhněte soubor `Tender Flow Setup 1.5.2.exe` a spusťte instalaci.

#### macOS (Apple Silicon M1/M2/M3)

Stáhněte soubor `Tender Flow-1.5.2-arm64.dmg` a přetáhněte aplikaci do složky Aplikace.

---

**Automatické aktualizace**: V této verzi jsou aktivní pro Windows. Na macOS (Apple Silicon) probíhá aktualizace manuálně přes nový instalační balíček.

---

## 🎉 Tender Flow v1.4.0

### ✨ Co je nového

- **Desktop aktualizace přes GitHub Releases**:
  - Windows běží v auto-update režimu.
  - macOS (Apple Silicon M1/M2/M3) je v manuálním režimu instalace.
- **Administrace rozšířena o Incident logy**: dohledání chyb podle incident ID, uživatele a času, včetně mazání starších logů dle retenčního období.
- **Správa uživatelů rozšířena**: nastavení typu přihlášení (Auto/Email/Google/Microsoft/GitHub/SAML) a možnost manuálního přepsání úrovně předplatného uživatele.
- **Organizace v Nastavení**: správa členů, schvalování žádostí, změny rolí a předání vlastnictví organizace.
- **Smlouvy**: doplněno pole IČ dodavatele a kontextové menu přímo v seznamu smluv.

### 🐛 Opravy chyb

- **Výběrová řízení (email nevybraným)**: přesnější sestavení BCC adres (deduplikace a kompatibilní oddělovač).
- **Přehledy a detail stavby**: opravy načítání a ukládání základních údajů.

### 🔧 Technické změny

- **Verze aplikace**: bump na `1.4.0`.
- **Bezpečnost a provoz aktualizací**: update distribuce je sjednocena přes GitHub Releases, čímž se snižuje provozní složitost update infrastruktury.

### 📦 Instalace

#### Windows

Stáhněte soubor `Tender Flow Setup 1.4.0.exe` a spusťte instalaci.

#### macOS (Apple Silicon M1/M2/M3)

Stáhněte soubor `Tender Flow-1.4.0-arm64.dmg` a přetáhněte aplikaci do složky Aplikace.

---

**Automatické aktualizace**: V této verzi jsou aktivní pro Windows. Na macOS (Apple Silicon) probíhá aktualizace manuálně přes nový instalační balíček.

---

## 🎉 Tender Flow v1.3.2

### ✨ Co je nového

- **Uživatelská příručka**: doplněn a zpřesněn obsah pro hlavní workflow aplikace, desktop režim a administraci.
- **Navigace v příručce**: opravené interní odkazy a aktualizované metadata příručky.

### 🐛 Opravy chyb

- **Dokumentace**: sjednocení release poznámek pro aktuální patch release.

### 🔧 Technické změny

- **Verze aplikace**: patch bump na `1.3.2`.

### 📦 Instalace

#### Windows

Stáhněte soubor `Tender Flow Setup 1.3.2.exe` a spusťte instalaci.

#### macOS (Apple Silicon M1/M2/M3)

Stáhněte soubor `Tender Flow-1.3.2-arm64.dmg` a přetáhněte aplikaci do složky Aplikace.

---

**Automatické aktualizace**: Existující instalace budou automaticky notifikovány o nové verzi.

---

## 🎉 Tender Flow v1.2.1

### ✨ Co je nového

- **OCR Vylepšení**: Nová vylepšení pro OCR (Rozpoznávání textu).

### 🔧 Technické změny

- **Build**: Úprava konfigurace Electron build procesu.
- **Různé**: Drobné úpravy (minor).

### 📦 Instalace

#### Windows

Stáhněte soubor `Tender Flow Setup 1.2.1.exe` a spusťte instalaci.

#### macOS (Apple Silicon M1/M2/M3)

Stáhněte soubor `Tender Flow-1.2.1-arm64.dmg` a přetáhněte aplikaci do složky Aplikace.

---

**Automatické aktualizace**: Existující instalace budou automaticky notifikovány o nové verzi.
