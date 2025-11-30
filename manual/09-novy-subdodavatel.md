# Vytvoření nového subdodavatele

## Kdy použít?

Funkci vytvoření nového subdodavatele použijte, když:

- Firma není v databázi
- Objevili jste novou spolupracující firmu
- Přidáváte subdodavatele přímo při vytváření poptávky

## Postup vytvoření

### Přímé vytvoření z Pipeline

#### Krok 1: Otevření výběru subdodavatelů

1. V Pipeline view klikněte na **"+ Přidat dodavatele"**
2. Otevře se okno s výběrem

#### Krok 2: Vyhledání

1. Do vyhledávacího pole zadejte název firmy
2. Pokud firma není nalezena, zobrazí se modrá karta:

```
🔵 Vytvořit nového dodavatele: "[Název]"
Přidat do databáze a vybrat pro tuto poptávku
```

#### Krok 3: Kliknutí na vytvoření

1. Klikněte na modrou kartu
2. Otevře se formulář "Nový dodavatel"

### Vyplnění formuláře

#### Povinné pole

- **Firma / Název** \* - Název společnosti (předvyplněný z vyhledávání)

#### Doporučené informace

- **Specializace** - Obor působnosti (např. "Elektro", "Zedník")
- **Kontaktní osoba** - Jméno zodpovědné osoby
- **Email** - Emailová adresa
- **Telefon** - Telefonní číslo

#### Doplňující údaje

- **IČO** - Identifikační číslo (automaticky se doplní později)
- **Region** - Geografická působnost

### Uložení

1. Zkontrolujte vyplněné údaje
2. Klikněte na **"Vytvořit"**
3. Nebo **"Zrušit"** pro zrušení

## Co se stane po vytvoření?

Po kliknutí na "Vytvořit":

### 1. Přidání do databáze

- Subdodavatel se uloží do **Supabase databáze**
- Získá unikátní ID
- Je dostupný pro budoucí použití

### 2. Automatický výběr

- Nový subdodavatel se **automaticky vybere**
- Je připraven k přidání do poptávky
- Checkbox je zaškrtnutý

### 3. Dostupnost

- Firma je nyní v seznamu všech subdodavatelů
- Můžete ji použít i v jiných projektech
- Je viditelná v sekci "👥 Subdodavatelé"

## Příklad

### Scénář

Pracujete na poptávce "Elektroinstalace" a chcete přidat firmu "ELPROF s.r.o.", která není v databázi.

### Postup

1. Otevřete okno "Přidat dodavatele"
2. Zadejte "ELPROF" do vyhledávání
3. Klikněte na "Vytvořit nového dodavatele: ELPROF"
4. Vyplňte formulář:
   - Firma: ELPROF s.r.o.
   - Specializace: Elektro
   - Kontaktní osoba: Jan Elektrikář
   - Email: jan@elprof.cz
   - Telefon: 777 123 456
5. Klikněte "Vytvořit"
6. Firma je vybrána a můžete ji přidat do poptávky

## Tipy pro kvalitní data

### Název firmy

- Používejte oficiální název včetně právní formy (s.r.o., a.s.)
- Kontrolujte pravopis

### Specializace

- Buďte konzistentní (např. vždy "Elektro", ne "Elektrikář")
- Používejte kategorie, které už máte v databázi

### Kontaktní údaje

- Vyplňte alespoň email NEBO telefon
- Dvojitě zkontrolujte překlepy

### Region

- Uveďte kraj nebo město působnosti
- Pomůže to při filtrování

## Následné úpravy

Po vytvoření můžete:

1. Přejít do sekce **"👥 Subdodavatelé"**
2. Najít nově vytvořenou firmu
3. Kliknutím na ✏️ doplnit další údaje:
   - IČO
   - Adresu
   - Další kontakty

## Trvalost dat

- ✅ Data jsou uložena v **Supabase databázi**
- ✅ Přetrvají mezi relacemi
- ✅ Jsou dostupná všem uživatelům systému
- ✅ Lze je upravovat a mazat

---

**Gratulujeme!** Nyní ovládáte všechny základní funkce Construction CRM.

Pro pokročilé funkce nebo dotazy kontaktujte tým podpory.
