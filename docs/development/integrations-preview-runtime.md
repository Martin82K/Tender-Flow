# Microsoft To Do a DocHub v lokálním náhledu

## Opravené příčiny

- Microsoft To Do: sdílený CORS seznam Edge Functions neobsahoval výchozí Vite preview port 4173. Preflight `microsoft-todo-connection` na nasazené funkci 15. 9. 2026 vrátil pro origin `http://127.0.0.1:4173` hlavičku `access-control-allow-origin: https://tenderflow.cz`; pro port 3000 vrátil správný origin. Prohlížeč proto blokoval požadavek před získáním stavu připojení. To není důkaz odpojeného Microsoft účtu ani selhání Graph API.
- DocHub: provider `onedrive` označuje lokální synchronizovanou složku. Pipeline spouštěla projektový i kategoriový fallback také ve webu, přestože služba `ensureStructure` vyžaduje Electron. Vlastník může mít ve webu dostupnou uloženou cestu, takže neprázdná cesta sama nepotvrzuje dostupnost souborového systému.

Standardní `npm run preview` nově používá `http://127.0.0.1:5173`, který již serverový CORS seznam povoluje. Dev server nadále používá port 3000. Nastavení `strictPort: true` při obsazeném portu skončí chybou místo tichého přechodu na nepovolený port. Preview je navázáno na loopback; ruční přepsání portu přes CLI může kompatibilitu s CORS zrušit. Serverový allowlist se nemění; port 4173 zůstává nepovolený. Automatický i explicitně vyvolaný lokální fallback se provede pouze v desktopu. Cloudové providery `gdrive` a `onedrive_cloud` fungují dál ve webu; skutečné chyby souborového systému zůstávají hlášené.

## Nasazení a ověření

Oprava preview je čistě lokální konfigurace Vite. Spustit `npm run build` a `npm run preview`, poté otevřít `http://127.0.0.1:5173`. Pokud je port obsazený, uvolnit vlastní předchozí preview nebo ukončit jeho proces; nespoléhat na automatický výběr jiného portu. Není potřeba nasazovat Edge Functions, měnit oprávnění ani data. DocHub oprava vstoupí v účinnost novým frontendovým buildem.

Read-only OPTIONS preflight `microsoft-todo-connection` s originem `http://127.0.0.1:5173`, metodou POST a hlavičkami `authorization,apikey,content-type` má vracet shodný `access-control-allow-origin`. Preflight nevyžaduje přihlášení a nemění zákaznická data.

Pro uživatelskou kontrolu: ve webu se lokální složky automaticky nevytvářejí; použít desktop. Cloudové integrace nadále vyžadují platné připojení a oprávnění. Autentizovanou synchronizaci a tvorbu složek ověřovat pouze na vyhrazeném testovacím účtu/projektu, nikoli na zákaznických datech.

## Regrese

- `tests/edgeCors.preview.test.ts`: konfigurace loopback/5173/strictPort, preflight i odpověď POST, oba originy portu 5173, stávající originy, odmítnutí portu 4173, cizích adres a nevyjmenovaného portu.
- `tests/usePipelineDocHubFallback.platform.test.ts`: skutečný hook, lokální webový zákaz, desktopové projektové/kategoriové volání, oba cloudové providery a zachování hlášení skutečného selhání.
- Architektonický snapshot má o jeden import více kvůli existujícímu platformnímu adaptéru; nepřibyla cyklická závislost.

Runtime smoke test izolovaného produkčního buildu používá neprodukční konfiguraci: úvodní stránka → přihlášení → zadání e-mailu bez odeslání. Ověřuje vykreslení, navigaci, konzoli a síť, nikoli skutečnou synchronizaci Microsoft účtu nebo Electron IPC. Tyto integrační větve pokrývají regresní testy s řízenými náhradami služeb.
