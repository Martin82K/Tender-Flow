# Veřejný vstup a objem assetů (audit 4, 6. září 2026)

## Změna

Veřejný vstup v `components/providers/AppProviders.tsx` vykresluje přihlášení,
právní stránky a krátké odkazy bez načtení interního `AppContent`. Až po ověření
přihlášení načte `app/AuthenticatedApp.tsx`, původní interní ochrany a nápovědu.
Parametr `next` včetně parametrů cílové stránky zůstává zachován. Veřejná větev
používá vlastní životní cyklus motivu; po přihlášení jej převezme interní aplikace.
Analytická identita zůstává nad hranicí načítání, aby se vyčistila i při odhlášení.

SheetJS (`xlsx`) se načítá dynamicky uvnitř importních/exportních akcí. Existující
ExcelJS exporty již používaly dynamické importy. Export kontaktů, šablony a plánu
VŘ a harmonogramu čeká na dokončení, blokuje opakované kliknutí a při selhání
nabídne srozumitelnou chybu a možnost opakovat akci.

## Ověřené velikosti

Baseline je nový produkční build commitu `4cd87ca342443d788e886b8caf2d9fabc579735b`,
nikoli převzaté historické měření. Oba buildy používají stejné závislosti
z lockfilu a stejnou veřejnou konfiguraci Supabase.

| Metrika | Před | Po | Úspora |
| --- | ---: | ---: | ---: |
| JS/CSS požadavky při prvním otevření `/` | 35 | 16 | 19 |
| Součet JS/CSS, nekomprimované bajty | 2 444 832 | 1 404 202 | 42,56 % |
| Součet JS/CSS, gzip bajty | 578 627 | 268 725 | 53,56 % |
| Společný CSS, bajty | 916 743 | 772 119 | 15,78 % |
| Společný CSS, gzip bajty | 98 109 | 81 979 | 16,44 % |
| SheetJS při prvním otevření, gzip bajty | 159 373 | 0 | 100 % |

Metoda: skutečný prohlížeč otevřel lokální produkční `dist` bez přihlášení.
Server se zakázanou cache zaznamenal vyžádané cesty a délku obsahu; do tabulky
patří pouze vyžádané lokální `.js` a `.css`. Gzip je součet `gzipSync` z Node.js
s výchozí kompresí pro tytéž soubory, nikoli naměřená přenosová velikost CDN.
Tabulka nezahrnuje HTTP hlavičky, HTML, obrázky, video, externí fonty ani API.
Hodnoty se mohou mírně změnit při integraci dalších bodů auditu.

## Proč bylo CSS velké

Původní konfigurace ponechávala automatické hledání tříd v celém repozitáři
vedle explicitních zdrojů aplikace. Nový `source(none)` omezuje zdroje na
aplikaci, kořenové HTML a konfiguraci. Je to podporovaný mechanismus
[Tailwind CSS](https://tailwindcss.com/docs/detecting-classes-in-source-files#disabling-automatic-detection).

Původně se navíc skenovala celá knihovna Appica, včetně nepoužívaných komponent.
Nyní se skenují používané rodiny komponent a jejich závislosti. Test
`cssSourceBoundary.test.ts` prochází skutečné importy aplikace i relativní
závislosti Appica a selže, pokud nový import nemá odpovídající zdroj CSS.
Při přidání další Appica komponenty je nutné aktualizovat seznam `@source`.

Zbývající CSS není jen nepoužitá knihovna: produkční výstup obsahuje přibližně
309 kB Tailwind utilities, 306 kB pravidel mimo pojmenované vrstvy a 115 kB
barevných fallbacků `@supports`. Zdrojový `index.css` má přibližně 250 kB a
obsahuje všechny existující motivy. Jejich plošné dělení by vyžadovalo samostatné
vizuální ověření všech motivů; tento krok jejich pravidla zachovává.

## Validace a hranice

Regrese pokrývají odložené importy, zachování názvu exportní šablony a obsahu
harmonogramu, čekání, opakovaný klik, chybu a opakování exportu. Testy vstupu
pokrývají veřejnou stránku, čekání na relaci, desktopové směrování, právní stránky,
krátké odkazy a přihlášení/odhlášení. Stávající test právního souhlasu zůstává
součástí interní aplikace.

Prohlížeč ověřil veřejnou stránku, přechod na přihlášení, předání
`/app/todo?taskId=example-task` do `next` a právní stránku `/terms`; na těchto
cestách nepožádal o SheetJS ani interní vstup. Konzole vykázala pouze stávající
upozornění na chybějící přihlášenou relaci. Soukromé obrazovky a desktopový
runtime se ověřují v navazující integrační kontrole koordinátora.

Změna neinstaluje závislosti, nemění oprávnění ani databázi. Oddělení balíčků
nenahrazuje autentizaci a RLS; interní ochrany zůstávají na místě. Rozpracované
změny ZIP/Excel v jiném checkoutu nejsou součástí tohoto kroku.
