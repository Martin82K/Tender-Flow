> **DRAFT** — tyto poznámky ještě nejsou finální. Po revizi smažte `.draft` ze jména souboru a případně sloučit do `release-notes.md`.

## Tender Flow v1.5.5

### Nové funkce

- **Plánování trasy na mapě projektu**: po výběru subdodavatele se vykreslí skutečná trasa po silnici (Mapy.cz routing) s km a odhadem doby jízdy.
- **Reálné vzdálenosti u nejbližších**: panel nejbližších subdodavatelů ukazuje skutečnou vzdálenost a čas jízdy po silnici místo vzdušné čáry (matrix routing, 1 dotaz pro celý seznam).
- **Globální vyhledávání (Ctrl+K)**: rychlé vyhledávání napříč projekty, kontakty a nastavením.
- **Rozdělení Nastavení a Nástrojů**: samostatné karty pro přehlednější orientaci.
- **Jednotné ovládání map**: mapa kontaktů a projektu sdílí stejné ovládání, vrstvy a chování.
- **Vylepšené notifikace**: přepracovaný systém notifikací (v2) s lepším doručováním.

### Opravy chyb

- **Mapy.com routing API**: opraveno chybné pořadí souřadnic (`lng,lat` místo `lat,lng`), které způsobovalo 404 u routing a matrix volání.

### Technické změny

- Nové hooky `useRoute` a `useNearbyRoutes` nad `mapyApiService`.
- Feature gate `MAPS_ROUTING` (PRO+) pro výpočet tras.
- Debounce 500 ms u matrix routingu, max 100 bodů na dotaz — šetrnější k API kvótě.
- Verze aplikace: patch bump na `1.5.5`.

