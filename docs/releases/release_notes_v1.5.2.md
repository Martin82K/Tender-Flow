## Tender Flow v1.5.2

### Co je nového

- **Import wizard kontaktů**: nový průvodce pro hromadný import kontaktů a subdodavatelů s náhledem, mapováním sloupců a možností vyloučení řádků před importem.
- **Hromadná úprava specializací**: specializace subdodavatelů lze nyní upravovat hromadně přímo v přehledu kontaktů — výběr více kontaktů a přiřazení specializací najednou.
- **Dodatky a vlastní náklady**: vylepšené formuláře pro dodatky a adresy stavby. U dodatků přibyla podpora vlastních nákladových položek.
- **Šifrované zálohy**: zálohy v desktop verzi jsou automaticky šifrovány algoritmem AES-256-GCM. Šifrovací klíč je chráněn OS (Windows DPAPI / macOS Keychain). Desktop ukládá zálohy automaticky s denní frekvencí a 7denní retencí. Nové tlačítko pro samostatnou zálohu kontaktů.
- **Systém nápovědy**: interaktivní kontextová nápověda s bublinami přímo u prvků rozhraní. Klávesová zkratka pro rychlé vyhledávání v nápovědě. Onboarding průvodce pro nové uživatele.
- **Automatické složky dokumentů**: DocHub v desktop verzi umí jedním kliknutím vytvořit standardizovanou strukturu složek pro dokumenty stavby (nabídky, smlouvy, zápisy atd.).
- **Přepracovaná uživatelská příručka**: kompletně přepsaná příručka (verze 2.2) pokrývající všechny moduly aplikace včetně nových funkcí.

### Opravy chyb

- **Scrollování tabulek**: opraveno horizontální scrollování v tabulkách pipeline, harmonogramu a plánu VŘ.
- **Překryvy UX**: opraveny problémy s překrývajícími se prvky v tabulkách a modálních oknech.
- **Delay nápovědy**: zvětšen delay pro zobrazení nápovědních bublin, aby nerušily při běžné práci.

### Technické změny

- **Verze aplikace**: bump na `1.5.2`.
- **Odebrání Viki**: kompletně odstraněn experimentální AI agent Viki (frontend, backend, edge funkce, dokumentace, testy).
- **Příručka**: verze příručky aktualizována na 2.2.

### Instalace

#### Windows

Stáhněte soubor `Tender Flow Setup 1.5.2.exe` a spusťte instalaci.

#### macOS (Apple Silicon M1/M2/M3)

Stáhněte soubor `Tender Flow-1.5.2-arm64.dmg` a přetáhněte aplikaci do složky Aplikace.

---

**Automatické aktualizace**: V této verzi jsou aktivní pro Windows. Na macOS (Apple Silicon) probíhá aktualizace manuálně přes nový instalační balíček.
