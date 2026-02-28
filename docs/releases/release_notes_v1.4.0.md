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
