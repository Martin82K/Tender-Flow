# Tender Flow v1.9.24

Opravný patch zpřesňuje produkční kontrolu obnovování přístupu k Tender Flow
MCP a doplňuje bezpečný incidentní postup pro opakované odpojování klienta.

## Spolehlivější kontrola MCP přihlášení

- Produkční canary nově ověřuje, že Supabase autorizační server podporuje
  `refresh_token` grant a standardní scope `offline_access`.
- Canary současně hlídá, že `offline_access` není nesprávně publikován jako
  scope chráněného MCP resource ani vyžadován v jeho 401 challenge.
- Tím se oddělují identity/resource scopes od schopnosti OAuth klienta bezpečně
  obnovovat access token bez opakované autorizace uživatele.

## Diagnostika a bezpečnost

- Pro stav `needsAuth` je zdokumentovaný postup založený na redigovaných
  `mcp_auth_rejected` kódech a korelaci s klientskou chybou token endpointu.
- Diagnostika nesmí ukládat Authorization header, JWT, refresh token, e-mail
  ani identifikátor uživatele.
- Existující fail-closed validace klienta, audience, resource, MCP role,
  permissions a tenantové izolace zůstává beze změny.
- Cílené MCP testy, kompletní testovací sada, webový build, desktopová
  kompilace a kontroly architektonických hranic prošly před vydáním.
- Release artefakty byly sestavené a ověřené lokálně před nahráním na GitHub.
