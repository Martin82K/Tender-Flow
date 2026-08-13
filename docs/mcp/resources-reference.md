# Reference MCP resources

Stav: 4 resource rodiny k 2026-08-09
Zdroj pravdy: doménové registrace v `server/mcp/modules/` a společný auditní
runtime v `server/mcp/core/resourceRuntime.js`

Resources vracejí `application/json`. Všechny používají `cacheScope: private`,
proto jejich obsah nesmí klient sdílet mezi uživateli ani OAuth klienty.
Každé čtení podléhá OAuth/permission kontrole, rate limitu, RLS/RPC a MCP auditu.

## `tenderflow://catalog`

- Typ: pevný resource.
- Scope: `openid`.
- Cache TTL: 300 000 ms.
- Obsah: protokolová revize, resource rodiny, standardní OAuth scopes a interní permissions.
- Neobsahuje doménová data ani seznam objektů uživatele.

## `tenderflow://projects/{projectId}`

- Typ: resource template.
- Permissions: read; dostupný remote i stdio.
- Cache TTL: 60 000 ms.
- Parametr: `projectId` viditelného projektu.
- Obsah: základ projektu, VŘ, agregované počty a cenové rozpětí nabídek, smlouvy
  a plán VŘ.
- Minimalizace: nevrací dodavatele, kontaktní osobu, e-mail, telefon, bid notes
  ani dokumentové cesty. Pole `potentiallyTruncated` signalizuje dosažení
  serverových limitů.

Příklad URI:

```text
tenderflow://projects/11111111-1111-4111-8111-111111111111
```

## `tenderflow://organizations/{organizationId}/contracts/overview`

- Typ: resource template.
- Scope: read.
- Stav: dostupný remote i stdio.
- Cache TTL: 60 000 ms.
- Parametr: platné UUID organizace.
- Obsah: autorizovaný smluvní přehled z `get_contract_overview`, bez
  archivovaných záznamů.
- Minimalizace: dokument je popsán pouze příznakem a názvem souboru; raw
  storage path a přímé dokumentové URL se do MCP nevracejí.
- Neplatný/neznámý currency code se normalizuje na `CZK`, aby spotřebitelé
  nespadli při formátování.

## `tenderflow://tasks/open`

- Typ: pevný resource.
- Permissions: read; dostupný remote i stdio.
- Cache TTL: 30 000 ms.
- Obsah: nejvýše 50 otevřených, nearchivovaných tasků vlastněných přihlášeným
  uživatelem.
- Minimalizace: bez externích sync/provider metadat a bez `created_by`; RLS
  vynucuje `created_by = auth.uid()`.

## Chyby a cache

Chybné UUID, neexistující/neviditelný objekt nebo zamítnutí RLS skončí chybou
resource read a ne prázdným „úspěchem“, pokud podkladová operace vrátí chybu.
TTL je horní hranice čerstvosti, ne garance neměnnosti. Po změně oprávnění má
klient zahodit cache a znovu autorizovat.
