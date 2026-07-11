# Politika konzolového výstupu testů

Stav: implementováno a lokálně ověřeno, 11. července 2026

## Proč tato kontrola existuje

Zelený výsledek Vitest nesmí skrýt neočekávanou síťovou chybu, neúplný mock,
React warning ani jinou chybu vypsanou přes `console.error` nebo
`console.warn`. Tyto výstupy mohou signalizovat neotestovanou větev, i když
test dokončí svá očekávání úspěšně.

## Pravidla

1. Každý neočekávaný `console.error` nebo `console.warn` ukončí test chybou.
2. Negativní scénář může očekávaný výstup povolit pouze uvnitř konkrétního
   testu pomocí matcheru.
3. Deklarovaný očekávaný výstup, který nenastane, také ukončí test chybou.
4. Globální allowlist textů není povolený; skryl by regresi v jiném testu.
5. Testy, které přímo používají `vi.spyOn(console, ...)`, musí výstup potlačit
   záměrně a ověřit příslušné volání.
6. `console.log` a `console.info` nejsou součástí první fáze. Jejich objem lze
   řešit samostatně bez míchání diagnostiky s chybovými signály.

## Plánované testovací API

- `expectConsoleError(matcher, count?)`
- `expectConsoleWarn(matcher, count?)`

Matcher je text nebo regulární výraz aplikovaný na bezpečně serializovaný obsah
všech argumentů konzolového volání. Výchozí očekávaný počet je jeden.

## Testovací plán před implementací

### Guard jako samostatná jednotka

- [x] zachytí neočekávaný error a vrátí srozumitelnou chybu,
- [x] zachytí neočekávaný warning,
- [x] přijme očekávaný text nebo regulární výraz,
- [x] vyžaduje přesný deklarovaný počet výstupů,
- [x] selže, pokud deklarovaný výstup nenastane,
- [x] izoluje stav jednotlivých testů.

### Integrace celé sady

- [x] guard je aktivní přes `tests/setup.ts`,
- [x] cílený kontrolní běh je bez neočekávané konzole,
- [x] lokální ekvivalent čistého checkoutu neobsahuje neočekávaný error/warn,
- [x] všechny legitimní negativní scénáře zůstávají otestované,
- [x] lokální počet bez nesouvisejícího necommitnutého testu je zaznamenaný.

První úplné zapnutí guardu odhalilo 36 dříve zelených testů s konzolovým
výstupem. Opravy odstranily neúplné mocky Supabase Auth klienta, organization
brandingu a notification emitteru; legitimní negativní scénáře nyní deklarují
konkrétní očekávaný výstup a počet volání.

Lokální ekvivalent čistého checkoutu prošel v rozsahu 293 testovacích souborů a
1 374 testů. GitHub CI musí tento výsledek potvrdit před merge; autoritativní
počet a log zůstává v historii příslušného PR.

## Co tato politika nedokazuje

Console guard nenahrazuje coverage, integrační testy ani živé RLS testy. Hlídá
jedinou věc: zelený test nesmí současně tiše produkovat neočekávanou chybu nebo
warning.
