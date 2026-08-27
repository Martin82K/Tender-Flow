# Tender Flow v1.9.18

Patch sjednocuje pracovní Microsoft účet pro přihlášení, online dokumenty a
Microsoft To Do a přidává obousměrnou synchronizaci osobních úkolů.

## Jedno připojení Microsoft účtu

- Jedno přihlášení zpřístupní funkce Microsoft Graph schválené správcem
  tenantu pro používanou Entra App Registration.
- Nastavení účtu zobrazuje jednoznačný stav, zda je Microsoft účet připojený.
- Desktop OAuth používá stejný bezpečný tok a callback zobrazuje správnou
  českou diakritiku.
- Chybná kombinace tenant ID, client ID nebo client secret je bezpečně
  odmítnuta bez zpřístupnění citlivých podrobností uživateli.

## Obousměrná synchronizace Microsoft To Do

- Osobní TODO projekty mají odpovídající seznamy v Microsoft To Do včetně
  samostatného seznamu Tender Flow – Inbox.
- Vytvoření, úpravy, dokončení a podporované odstranění úkolů se synchronizují
  oběma směry pomocí Microsoft Graph delta synchronizace.
- Lokální změny se odesílají automaticky; změny z Microsoft To Do se načítají
  při otevření, návratu do aplikace a pravidelně při aktivní obrazovce TODO.
- Dočasné selhání první synchronizace neodstraní existující Graph grant ani
  již vytvořená mapování.

## Vzhled a použitelnost

- Modré a oranžové interaktivní akcenty na veřejných a přihlašovacích
  obrazovkách nahradila sjednocená světlejší zelená paleta včetně hover stavů.
- Stav Microsoft účtu uživatele nevede k opakovanému připojování účtu, pokud
  je jednotný Graph přístup aktivní.

## Bezpečnost a ověření

- Microsoft Graph tokeny zůstávají pouze v serverové vrstvě a nejsou
  zapisovány do klientského bundle ani aplikačních logů.
- Release nemění oprávnění v Entra tenantu a nepřidává nové závislosti.
- Kompletní testovací sada, TypeScript, webový build, desktop kompilace,
  dependency audit, dokumentace a kontroly architektury prošly před vydáním.
- Release artefakty jsou sestavené a ověřené lokálně před nahráním na GitHub.
