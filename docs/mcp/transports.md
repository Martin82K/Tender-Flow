# MCP transporty

Stav: implementované transporty k 2026-08-09
Zdroj pravdy: `api/mcp.js`, `server/mcp/nodeHandler.js`,
`scripts/mcp-stdio.js` a `desktop/main/services/mcpServer.ts`

## Remote stateless HTTP

Kanonický endpoint je `/api/mcp`. Protokol `2026-07-28` nepoužívá
`initialize`/`initialized` ani `Mcp-Session-Id`; každý požadavek musí být
samostatně autorizovatelný a směrovatelný.

Povinné nebo očekávané prvky:

- `Authorization: Bearer <token>` pro chráněné volání,
- `MCP-Protocol-Version: 2026-07-28`,
- `Mcp-Method` a podle metody `Mcp-Name`,
- JSON-RPC body s odpovídající metodou/názvem,
- client info/capabilities v `_meta` podle revize.

Server kontroluje shodu header/body přes SDK, CORS/Origin před tokenovou datovou
cestou a vrací 401 s odkazem na protected-resource metadata. HTTP je stateless,
ale návrhy změn jsou explicitní aplikační stav v databázi.

## Stdio

`npm run mcp:stdio` spouští stejnou Node MCP factory nad standardním vstupem a
výstupem. Token přichází pouze z `TENDER_FLOW_MCP_ACCESS_TOKEN`; nesmí být
argumentem příkazové řádky ani součástí JSON konfigurace. Běžný Supabase
session token získá pouze interní permission pro obecné čtení bez kontaktních
údajů. Tokenové `tenderflow.*` scopes se ignorují. `TENDER_FLOW_MCP_READ_ONLY`
zůstává dodatečný přepínač, ale write permission současná policy nevydává.

## Desktop legacy

`desktop MCP` je samostatná implementace a dosud není ekvivalent remote/stdio
katalogu. Používá vlastní lifecycle, IPC guardy a starší protokolové chování.
Dokud neproběhne sjednocovací loop, nelze výsledky testu remote serveru
automaticky vztáhnout na desktop.

## Zakázané předpoklady

- Origin allowlist není autentizace.
- Stateless transport neznamená, že business operace nemají stav.
- Private cache hint neopravňuje klienta data dlouhodobě persistovat.
- Stdio není bezpečné jen proto, že běží lokálně; token a stdout/stderr musí
  zůstat oddělené a host proces musí být důvěryhodný.
