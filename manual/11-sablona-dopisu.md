# Nastavení šablony poptávkového dopisu

## Co je šablona poptávkového dopisu?

Šablona poptávkového dopisu je dokument, který definuje strukturu a obsah emailů zasílaných subdodavatelům při poptávání nabídek. Můžete použít buď URL odkaz na online dokument, nebo nahrát vlastní soubor.

## Kde nastavit šablonu?

### Umístění v aplikaci

1. Otevřete projekt
2. Přejděte na záložku **"Dokumenty"**
3. Najděte sekci **"Poptávkový dopis (šablona)"**
4. Klikněte na ikonu úprav (✏️)

## Dva způsoby nastavení

### Varianta A: URL odkaz

Vhodné pro:

- Google Docs šablony
- OneDrive / SharePoint dokumenty
- Jakýkoliv online dostupný dokument

**Postup:**

1. V editačním režimu zůstaňte na záložce **"URL odkaz"**
2. Vložte **celou URL adresu** šablony
3. Příklad: `https://docs.google.com/document/d/...`
4. Klikněte na zelené tlačítko ✓ pro uložení

### Varianta B: Nahrání souboru

Vhodné pro:

- Offline Word dokumenty (.doc, .docx)
- PDF šablony
- OpenDocument formáty (.odt)

**Postup:**

1. V editačním režimu klikněte na záložku **"Nahrát soubor"**
2. Automaticky se otevře dialog pro výběr souboru
3. Vyberte soubor šablony z počítače
4. Zobrazí se náhled s názvem a velikostí
5. Klikněte na ✓ pro nahrání a uložení

#### Podporované formáty

- `.doc` - Microsoft Word (starší formát)
- `.docx` - Microsoft Word (nový formát)
- `.pdf` - PDF dokumenty
- `.odt` - OpenDocument Text

**Limit velikosti:** 10 MB

## Dynamické proměnné v šabloně

V textu šablony můžete použít tyto proměnné, které se automaticky nahradí při generování poptávky:

### Informace o projektu

- `{NAZEV_STAVBY}` - Název stavby
- `{INVESTOR}` - Název investora
- `{LOKACE}` - Lokace projektu
- `{TERMIN_DOKONCENI}` - Termín dokončení stavby
- `{STAVBYVEDOUCI}` - Jméno stavbyvedoucího
- `{TECHNICKY_DOZOR}` - Technický dozor (TDI)

### Podmínky SOD

- `{SPLATNOST}` - Splatnost faktury (dny)
- `{ZARUKA}` - Záruční doba (měsíce)
- `{POZASTAVKA}` - Pozastávka (%)
- `{SOD_CENA}` - Cena v SOD smlouvě

### Informace o poptávce

- `{KATEGORIE_NAZEV}` - Název poptávané kategorie
- `{KATEGORIE_POPIS}` - Popis prací
- `{PLAN_CENA}` - Plánovaná cena

### Kontakt

- `{FIRMA_DODAVATELE}` - Název firmy subdodavatele
- `{KONTAKTNI_OSOBA}` - Jméno kontaktní osoby

## Příklad šablony

```
Dobrý den,

oslovujeme Vás s poptávkou subdodávky pro stavbu {NAZEV_STAVBY}.

ZÁKLADNÍ INFORMACE:
Investor: {INVESTOR}
Lokace: {LOKACE}
Termín dokončení: {TERMIN_DOKONCENI}
Stavbyvedoucí: {STAVBYVEDOUCI}

PŘEDMĚT POPTÁVKY:
{KATEGORIE_NAZEV}

{KATEGORIE_POPIS}

PODMÍNKY SOD:
- Splatnost: {SPLATNOST} dnů
- Záruka: {ZARUKA} měsíců
- Pozastávka: {POZASTAVKA}

Prosíme o zaslání cenové nabídky do [DATUM].

S pozdravem,
{STAVBYVEDOUCI}
```

## Zobrazení aktuální šablony

### Když je šablona nastavena

- Zobrazí se klikatelný odkaz/název souboru
- Ikona 📄 pro dokument
- Text "Klikněte pro otevření šablony"
- Otevírá se v novém okně

### Když není šablona nastavena

- Zobrazí se ikona 📭
- Text "Žádná šablona není nastavena"
- Pokyn k nastavení pomocí ikony úprav

## Použití šablony

Šablona se automaticky použije při:

1. **Generování poptávky** v Pipeline
2. Kliknutí na tlačítko "Generovat poptávku" na kartě subdodavatele
3. Otevření emailového klienta s předvyplněným textem

_Viz kapitola [Generování poptávky](12-generovani-poptavky.md) pro podrobnosti._

## Doporučení

### Struktura šablony

- **Úvod** - Oslovení a představení projektu
- **Předmět** - Jasný popis poptávané práce
- **Podmínky** - Splatnost, záruka, pozastávka
- **Termín** - Do kdy očekáváte nabídku
- **Kontakt** - Jak vás mohou kontaktovat

### Tipy

- Používejte **profesionální tón**
- Buďte **konkrétní** v požadavcích
- Uveďte **všechny důležité informace**
- Využívejte **dynamické proměnné** pro automatizaci
- **Pravidelně aktualizujte** podle potřeb projektu

## Technické detaily

### Ukládání

- **URL:** Uloženo přímo v databázi projektu
- **Soubor:** Nahrán do Supabase Storage bucket `demand-documents`
- **Přístup:** Pouze přihlášení uživatelé s přístupem k projektu

### Bezpečnost

Šablony jsou dostupné pouze:

- Uživatelům s přístupem k projektu
- Přes autentizované API volání

---

**Další krok:** Pokračujte na [Generování a odesilání poptávky](12-generovani-poptavky.md).
