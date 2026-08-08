# Reference MCP resources

Stav: 3 resource rodiny k 2026-08-09
Zdroj pravdy: `registerTenderFlowResources` v `server/mcp/tenderFlowMcp.js`

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
- Permissions: read + contacts; aktuálně **disabled**.
- Cache TTL: 60 000 ms.
- Parametr: `projectId` viditelného projektu.
- Obsah: základ projektu, VŘ, nabídky, smlouvy a plán VŘ.
- Důvod contacts permission: agregovaný detail zahrnuje nabídky/dodavatele a může
  nést kontaktní údaje.

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

## Chyby a cache

Chybné UUID, neexistující/neviditelný objekt nebo zamítnutí RLS skončí chybou
resource read a ne prázdným „úspěchem“, pokud podkladová operace vrátí chybu.
TTL je horní hranice čerstvosti, ne garance neměnnosti. Po změně oprávnění má
klient zahodit cache a znovu autorizovat.
