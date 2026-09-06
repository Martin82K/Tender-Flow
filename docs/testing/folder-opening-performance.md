# Otevírání složek v desktopu

Kontrola existence složky VŘ či dodavatele používá `fs:folderExists` místo
rekurzivního `fs:listFiles`. Velikost obsahu ani nepřístupná podsložka proto
nevyvolává sken celého stromu před otevřením. Samotný seznam dokumentů nadále
používá původní výpis souborů. Prázdná složka je platný cíl; chybějící cesta,
soubor místo složky nebo nepovolená cesta vrací `false`.

Nativní kontrola zachovává autentizaci IPC, obnovení uživatelem povolených
kořenů, přemapování OneDrive cesty a ověření skutečné cesty (`realpath`).
Změna nepřidává cache oprávnění, nemění MCP, cloudové API, databázi ani pravidla
autentizace. Alternativní starší názvy složek a online fallback zůstávají zachované.

## Diagnostika pomalého otevření

V existujícím lokálním exportu runtime diagnostiky hledejte `scope: filesystem`
a `event: operation_timing`. Export je dostupný přes `window.__TF_DEBUG__.export()`
v konzoli desktopové aplikace. Pro rychlé zobrazení lze použít
`window.__TF_DEBUG__.getEvents().filter(event => event.scope === "filesystem")`.

Události měří tyto jednotlivé operace pomocí monotónních hodin:

| stage | Měřený krok |
| --- | --- |
| `folder_exists` | Nativní kontrola existence včetně IPC a kontroly cesty |
| `authenticate` | Načtení relace a její stávající ověření hlavním procesem |
| `open_in_explorer` | První nativní otevření, včetně kontrol cesty a předání OS |
| `grant_access` | Dialog povolení přístupu včetně času uživatele |
| `retry_open_in_explorer` | Opakované otevření po udělení přístupu |

Datový payload obsahuje pouze `stage`, `duration_ms` a `outcome`
(`success`, `failure` pro záporný výsledek, `error` pro výjimku).
Neobsahuje cesty, názvy projektů, tokeny ani texty chyb. Standardní obálka
diagnostiky nadále obsahuje její obvyklé údaje, například čas a aplikační route.
Tyto události nevyvolávají cloudový požadavek; ukládá je existující odložený
lokální mechanismus s omezenou historií. Selhání diagnostiky nesmí změnit výsledek
operace. Tato úprava nemění obsah starších incidentních logů.

Měření končí návratem nativního otevření. Neříká, kdy Průzkumník/Finder dokončil
vykreslení obsahu nebo kdy OneDrive stáhl soubory. Události jednotlivých kroků
nepředstavují celkový čas kliknutí; při diagnostice provádějte jedno otevření
po druhém. Pomalá autentizace a čekání na síťové kořeny se tímto PR neoptimalizují.

## Ověření při změně a po nasazení

- Regrese: dostupná i prázdná složka bez výpisu obsahu, záporný výsledek,
  odmítnuté IPC, soubor místo složky, symlink mimo povolený kořen, původní názvy
  a online fallback. Ověřit, že autentizace stále předchází otevření.
- Diagnostika: úspěch, záporný výsledek, výjimka, zachování původní chyby při
  selhání loggeru a nepřítomnost citlivých údajů v nových payloadech.
- Spustit celou testovací sadu včetně MCP, typecheck, webový build, desktopový
  TypeScript compile, dokumentační a architektonické kontroly.
- Desktop smoke: na testovací složce otevřít složku z aplikace, ověřit udělení
  přístupu, opakované otevření a odmítnutí nepovoleného cíle.
- Na postiženém počítači porovnat stejnou složku přímo v Průzkumníku/Finderu
  a z Tender Flow. Vyzkoušet malou i velkou složku přes domácí Wi-Fi, opakovat
  studené a následné otevření a zaznamenat časy jednotlivých kroků. Tento
  uživatelský test nenahrazuje simulace latence ani lokální smoke test.
