# Microsoft To Do a DocHub v lokálním náhledu

## Opravené příčiny

- Microsoft To Do: sdílený CORS seznam Edge Functions neobsahoval výchozí Vite preview port 4173. Preflight `microsoft-todo-connection` na nasazené funkci 15. 9. 2026 vrátil pro origin `http://127.0.0.1:4173` hlavičku `access-control-allow-origin: https://tenderflow.cz`; pro port 3000 vrátil správný origin. Prohlížeč proto blokoval požadavek před získáním stavu připojení. To není důkaz odpojeného Microsoft účtu ani selhání Graph API.
- DocHub: provider `onedrive` označuje lokální synchronizovanou složku. Pipeline spouštěla projektový i kategoriový fallback také ve webu, přestože služba `ensureStructure` vyžaduje Electron. Vlastník může mít ve webu dostupnou uloženou cestu, takže neprázdná cesta sama nepotvrzuje dostupnost souborového systému.

CORS nově povoluje přesně `http://localhost:4173` a `http://127.0.0.1:4173`. Nezavádí wildcard ani libovolné porty. Automatický i explicitně vyvolaný lokální fallback se provede pouze v desktopu. Cloudové providery `gdrive` a `onedrive_cloud` fungují dál ve webu; skutečné chyby souborového systému zůstávají hlášené.

## Nasazení a ověření

Frontendová oprava vstoupí v účinnost novým webovým/desktopovým buildem. Změna `_shared/cors.ts` vyžaduje nové nasazení funkcí, které tento modul importují; samotný frontendový release CORS nasazené funkce nezmění. Pro Microsoft To Do jde minimálně o `microsoft-todo-connection` a `microsoft-todo-sync`; pro celý integrační tok také o související DocHub endpointy. Nasazení provádí navazující release úkol s běžnou kontrolou konfigurace a JWT, bez změny oprávnění či migrací.

Po nasazení opakovat OPTIONS preflight s originem `http://127.0.0.1:4173`, požadovanou metodou POST a hlavičkami `authorization,apikey,content-type`; očekává se shodný `access-control-allow-origin`. Ověřit také odmítnutí cizího originu. Preflight nevyžaduje přihlášení a nemění zákaznická data.

Pro uživatelskou kontrolu: ve webu se lokální složky automaticky nevytvářejí; použít desktop. Cloudové integrace nadále vyžadují platné připojení a oprávnění. Autentizovanou synchronizaci a tvorbu složek ověřovat pouze na vyhrazeném testovacím účtu/projektu, nikoli na zákaznických datech.

## Regrese

- `tests/edgeCors.preview.test.ts`: preflight i odpověď POST, oba preview originy, stávající originy, odmítnutí cizích adres a nevyjmenovaného portu.
- `tests/usePipelineDocHubFallback.platform.test.ts`: skutečný hook, lokální webový zákaz, desktopové projektové/kategoriové volání, oba cloudové providery a zachování hlášení skutečného selhání.
- Architektonický snapshot má o jeden import více kvůli existujícímu platformnímu adaptéru; nepřibyla cyklická závislost.

Runtime smoke test izolovaného produkčního buildu používá neprodukční konfiguraci: úvodní stránka → přihlášení → zadání e-mailu bez odeslání. Ověřuje vykreslení, navigaci, konzoli a síť, nikoli skutečnou synchronizaci Microsoft účtu nebo Electron IPC. Tyto integrační větve pokrývají regresní testy s řízenými náhradami služeb.
