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
