# Nahrávání dokumentů k poptávce

## Co jsou dokumenty poptávky?

Dokumenty poptávky jsou přílohy, které můžete přidat k jednotlivým kategoriím (poptávkám) v projektu. Mohou obsahovat výkresy, specifikace, rozpočty nebo jiné podklady potřebné pro subdodavatele.

## Kdy použít?

- Výkresová dokumentace (PDF, DWG)
- Technické specifikace
- Položkový rozpočet
- Fotografie stávajícího stavu
- Další podklady pro kalkulaci

## Postup nahrání dokumentů

### Krok 1: Otevření formuláře nové poptávky

1. V projektu klikněte na **"+ Nová Poptávka"**
2. Vyplňte základní údaje kategorie (název, rozpočet, popis)

### Krok 2: Přidání dokumentů

V části **"Dokumenty"** formuláře:

1. Klikněte na oblast **"Klikněte pro výběr souborů"**
2. Vyberte jeden nebo více souborů z vašeho počítače
3. Vybrané soubory se zobrazí v seznamu s náhledem

#### Podporované formáty

- **Dokumenty:** .pdf, .doc, .docx, .xls, .xlsx
- **Obrázky:** .jpg, .jpeg, .png
- **Limit velikosti:** 10 MB na soubor

### Krok 3: Kontrola a odebrání

- **Zobrazení:** Každý vybraný soubor zobrazuje název a velikost
- **Odebrání:** Klikněte na ikonu ❌ pro odstranění souboru ze seznamu
- **Přidání dalších:** Můžete přidat více souborů opakovaným výběrem

### Krok 4: Vytvoření poptávky

1. Zkontrolujte všechny údaje včetně příloh
2. Klikněte na **"Vytvořit poptávku"**
3. Během nahrávání se zobrazí indikátor průběhu
4. Po dokončení se kategorie vytvoří s připojenými dokumenty

## Zobrazení dokumentů

### V přehledu kategorií

Na kartě kategorie se zobrazuje:

- Ikona 📎 (attachment)
- Počet přiložených dokumentů

### V detailu Pipeline

Po otevření kategorie v Pipeline view:

1. **Sekce "Přiložené dokumenty"** - nahoře pod záhlavím
2. **Mřížka dokumentů** - přehledné zobrazení všech příloh
3. **Náhled** - název souboru a velikost
4. **Stažení** - kliknutím otevřete/stáhnete dokument

## Příklad použití

### Praktický příklad

**Situace:**
Vytváříte poptávku na SDK konstrukce a máte:

- Výkresy PDF (5 MB)
- Výkaz výměr XLSX (200 KB)
- Detailní fotografie JPG (3 MB)

**Postup:**

1. Vyplníte název: "SDK konstrukce - podhled"
2. Zadáte rozpočty
3. V sekci Dokumenty nahrajete všechny 3 soubory
4. Potvrdíte vytvoření
5. Subdodavatelé nyní mají k dispozici všechny podklady

## Technické detaily

### Úložiště

- Dokumenty jsou uloženy v **Supabase Storage**
- Bucket: `demand-documents`
- Každá kategorie má vlastní složku

### Bezpečnost

- Přístup pouze pro přihlášené uživatele
- Dokumenty jsou svázány s konkrétním projektem

## Časté otázky

**Q: Můžu přidat dokumenty i k existující poptávce?**
A: Aktuálně lze dokumenty přidat pouze při vytváření. Pro přidání k existující kategorii je nutné ji upravit.

**Q: Co když překročím limit 10 MB?**
A: Soubor nebude přidán a zobrazí se upozornění. Rozdělte dokument nebo zmenšete obrázky.

**Q: Mohou subdodavatelé nahrávat dokumenty?**
A: Ne, nahrávání dokumentů je k dispozici pouze pro administrátory projektu.

---

**Další krok:** Pokračujte na [Nastavení šablony poptávkového dopisu](11-sablona-dopisu.md).
