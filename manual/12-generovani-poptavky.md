# Generování a odesílání poptávky

## Co je generování poptávky?

Generování poptávky je funkce, která automaticky vytvoří kompletní email s poptávkou na subdodávku a otevře váš emailový klient připravený k odeslání. Všechny důležité informace jsou předvyplněné.

## Kde najdu tuto funkci?

### Umístění v Pipeline

1. Otevřete projekt a přejděte na **Pipeline**
2. Klikněte na kategorii (poptávku)
3. V sloupci **"Oslovení"** najdete karty subdodavatelů
4. Na každé kartě je tlačítko **"✉ Generovat poptávku"**

## Dva stavy Pipeline

### Sloupec "Oslovení" (Contacted)

- **Barva:** Šedá
- **Účel:** Subdodavatelé připravení k oslovení
- **Funkce:** Zde se zobrazuje tlačítko "Generovat poptávku"
- **Status:** `contacted`

### Sloupec "Odesláno" (Sent)

- **Barva:** Modrá
- **Účel:** Již oslovení subdodavatelé
- **Funkce:** Čeká se na cenovou nabídku
- **Status:** `sent`

## Postup generování poptávky

### Krok 1: Přidání subdodavatele

1. V detailu Pipeline klikněte **"Přidat dodavatele"**
2. Vyberte subdodavatele ze seznamu
3. Klikněte **"Přenést do pipeline"**
4. Subdodavatel se objeví ve sloupci **"Oslovení"**

### Krok 2: Generování emailu

Na kartě subdodavatele v sloupci "Oslovení":

1. Klikněte na tlačítko **"✉ Generovat poptávku"**
2. Automaticky se otevře váš emailový klient
3. Email je předvyplněný:
   - **Komu:** Email subdodavatele z databáze
   - **Předmět:** "Poptávka - [Kategorie] - [Projekt]"
   - **Tělo:** Kompletní text poptávky

### Krok 3: Úprava a odeslání

Ve vašem emailovém klientu:

1. **Zkontrolujte** obsah emailu
2. **Upravte** text podle potřeby
3. **Přidejte přílohy** (výkresy, specifikace)
4. **Odešlete** email
5. Subdodavatel se automaticky přesune do sloupce **"Odesláno"**

## Obsah generovaného emailu

### Struktura emailu

```
Předmět: Poptávka - [Název kategorie] - [Název projektu]

Dobrý den,

obracíme se na Vás s poptávkou subdodávky pro stavbu [Projekt].

INFORMACE O STAVBĚ:
- Investor: [Investor]
- Lokace: [Adresa]
- Termín dokončení: [Datum]
- Stavbyvedoucí: [Jméno]
- Technický dozor: [TDI]

POPTÁVANÁ KATEGORIE:
[Název kategorie]

POPIS PRACÍ:
[Detailní popis z kategorie]

PODMÍNKY SOD:
- Splatnost: X dnů
- Záruka: Y měsíců
- Pozastávka: Z %
- Zařízení staveniště: A %
- Pojištění: B %

Prosíme o zaslání cenové nabídky do [DATUM].

S pozdravem,
[Stavbyvedoucí]
```

### Dynamické nahrazení

Všechny hodnoty v `[hranatých závorkách]` jsou automaticky nahrazené skutečnými daty z:

- Informací o projektu
- Údajů z kategorie
- Podmínek SOD smlouvy
- Kontaktních údajů

## Automatický přesun

### Co se stane po kliknutí?

1. **Okamžitě** - Otevře se emailový klient s předvyplněným emailem
2. **Po 100ms** - Karta subdodavatele se automaticky přesune z "Oslovení" do "Odesláno"
3. **Vizuálně** - Vidíte aktualizovaný stav v Pipeline

### Proč automatický přesun?

- **Přehlednost** - Jasné oddělení oslovených od neoslovených
- **Historie** - Sledování, komu už byla poptávka odeslána
- **Workflow** - Logická návaznost kroků výběrového řízení

## Přesouvání mezi sloupci

### Ruční přesun (Drag & Drop)

Můžete kdykoliv přetáhnout kartu mezi sloupci:

- Z "Oslovení" → "Odesláno" (manuální označení jako odesláno)
- Z "Odesláno" → "Oslovení" (vrácení pokud potřebujete znovu oslovit)
- Do jiných sloupců ("Cenová nabídka", "Užší výběr", atd.)

### Kdy použít manuální přesun?

- Oslovení mimo aplikaci (telefon, osobně)
- Oprava chyby
- Změna statusu bez generování poptávky

## Pokud subdodavatel nemá email

### Zobrazení tlačítka

Tlačítko **"Generovat poptávku"** se zobrazí pouze pokud:

- Subdodavatel má vyplněnou emailovou adresu
- Karta je ve sloupci "Oslovení"

### Co dělat bez emailu?

1. **Doplňte email** - Upravte kontakt a přidejte email
2. **Oslovte jinak** - Telefon, osobně
3. **Přesuňte manuálně** - Přetáhněte do "Odesláno"

## Příklad použití

### Praktický scénář

**Situace:**
Máte kategorii "Elektroinstalace" a potřebujete oslovit 5 elektrikářů.

**Postup:**

1. Otevřete "Elektroinstalace" v Pipeline
2. Klikněte "Přidat dodavatele"
3. Vyberete všech 5 elektrikářů
4. Přenesete je do pipeline → objeví se v "Oslovení"
5. Na první kartě kliknete "Generovat poptávku"
6. Otevře se Outlook s emailem pro první elektrikáře
7. Přidáte výkresy jako přílohu
8. Odešlete email
9. První elektrikář se přesune do "Odesláno"
10. Opakujete pro zbylé 4 elektrikáře

## Emailové klienty

### Podporované aplikace

Funkce funguje s:

- **Microsoft Outlook** (Windows, macOS)
- **Apple Mail** (macOS, iOS)
- **Thunderbird**
- **Gmail** (pokud je nastaven jako výchozí)
- Jakýkoliv výchozí emailový klient v systému

### Nastavení výchozího klienta

Aplikace používá protokol `mailto:`, který otevírá váš systémový výchozí emailový klient.

**Windows:** Nastavení → Aplikace → Výchozí aplikace → Email
**macOS:** Mail → Předvolby → Obecné → Výchozí aplikace

## Tipy a triky

### Pro efektivitu

1. **Hromadné přidání** - Přidejte všechny subdodavatele najednou
2. **Postupné oslovování** - Generujte a odesílejte jeden po druhém
3. **Kontrola emailů** - Ověřte správnost emailových adres předem
4. **Standardizace** - Používejte šablonu pro konzistentní komunikaci

### Časté chyby

❌ **Nezapomeňte přidat přílohy** - Email může být předvyplněný, ale přílohy musíte přidat ručně
❌ **Zkontrolujte datum** - V šabloně může být placeholder [DATUM] - nahraďte konkrétním datem
❌ **Email se neodešle automaticky** - Musíte kliknout na "Odeslat" v emailovém klientu

### Best practices

✅ Před odesláním vždy zkontrolujte obsah
✅ Přidejte relevantní přílohy (výkresy, specifikace)
✅ Uveďte konkrétní termín pro odeslání nabídky
✅ Označte si v kalendáři datum pro follow-up

---

**Související kapitoly:**

- [Nastavení šablony poptávkového dopisu](11-sablona-dopisu.md)
- [Pipeline management](04-pipeline.md)
- [Úprava nabídek](08-uprava-nabidek.md)
