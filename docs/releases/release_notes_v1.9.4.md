# Tender Flow v1.9.4

Patch opravuje skutečný online fallback sdílených DocHub složek v desktopové
aplikaci. Vydání zůstává před publikací v režimu draft a nezobrazí uživatelům
modal „Co je nového“.

## Oprava

- Projekt s lokálním OneDrive `rootId` a uloženou SharePoint URL nyní může
  obnovit cloudové spojení read-only dotazem a otevřít přesnou sdílenou složku.
- Sdílený uživatel projde nejdříve autentizací, projektovým RLS a explicitní
  kontrolou `project_shares`; teprve potom smí backend použít OAuth token
  vlastníka projektu.
- Electron otevírá výsledný odkaz přes autentizované IPC a existující allowlist
  podporovaných HTTPS hostů.

## Bezpečnost a ověření

- Lokální Codex Security diff scan nenašel reportovatelnou zranitelnost.
- Úplná sada 2 124 testů, typecheck, web build, desktop compile, dokumentační,
  boundary a legacy-structure kontroly prošly.
- Root i desktop dependency audit hlásí 0 zranitelností a registry podpisy jsou
  ověřené.
- Produkční Edge Function `dochub-get-link` je nasazena jako verze 58 se
  zapnutým `verify_jwt`; její vzdálený obsah odpovídá `main`.

## Databáze

Toto vydání nepřidává databázovou migraci. Všechny migrace požadované verzí
1.9.3 zůstávají beze změny.

## Povinný test před publikací

Na Windows nainstalovat sestavení 1.9.4, přihlásit se jako sdílený uživatel,
otevřít projekt `26034 Pyrum - spodní stavba`, přejít do Výběrových řízení,
otevřít kategorii Betony a kliknout na fialovou ikonu složky. Musí se otevřít
přesná online SharePoint složka v systémovém prohlížeči bez chybového modalu.

Assety se připojí k draft release výhradně z lokálního `dist-electron/`.
