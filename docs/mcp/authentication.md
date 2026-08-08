# Autentizace a OAuth

Stav: aktuální kontrakt remote a stdio autentizace k 2026-08-09
Zdroj pravdy: `server/mcp/supabaseAuth.js`, `server/mcp/nodeHandler.js`,
`server/mcp/response.js`

## Remote přihlášení

MCP se přihlašuje jako konkrétní uživatel Tender Flow. Klient získá OAuth
access token navázaný na uživatele, OAuth klienta a kanonický MCP resource.
MCP nepoužívá sdílenou aplikační identitu a nesmí obcházet uživatelská RLS.

```mermaid
sequenceDiagram
  participant U as Uživatel
  participant C as MCP klient
  participant O as Tender Flow OAuth
  participant M as Tender Flow MCP
  participant D as Supabase/RLS
  C->>M: požadavek bez tokenu
  M-->>C: 401 + WWW-Authenticate metadata
  C->>O: authorization request + resource + standardní identity scopes
  O->>U: přihlášení a consent
  U-->>O: schválení
  O-->>C: authorization code / access token
  C->>M: Bearer token + MCP request
  M->>M: podpis a claims validace
  M->>D: dotaz jako auth.uid() uživatele
  D-->>M: pouze data povolená RLS
  M-->>C: MCP výsledek
```

Server kontroluje minimálně:

1. podpis JWT proti JWKS Supabase Auth,
2. issuer odpovídající propojenému Supabase projektu,
3. `exp` a standardní časové claims,
4. audience a resource vůči MCP endpointu/allowlistu,
5. `client_id` nebo `azp` vůči `MCP_ALLOWED_CLIENT_IDS`,
6. standardní OAuth identity scopes endpointu,
7. existenci identity uživatele v `sub`.

OAuth `scope` a doménová MCP oprávnění jsou oddělené. Supabase Auth podporuje
standardní scopes (`openid`, `email`, `profile`, případně `phone` a
`offline_access`), nikoli vlastní Tender Flow scopes. Server proto nikdy
neodvozuje přístup k datům z hodnoty `tenderflow.*` vložené do tokenového
`scope`; interní permissions přiděluje až důvěryhodná serverová policy.

V produkci musí být `MCP_ALLOWED_CLIENT_IDS` neprázdné. Browserový Origin se
kontroluje přes `MCP_ALLOWED_ORIGINS`; absence Origin u serverového klienta
nenahrazuje tokenovou kontrolu.

## Lokální stdio

`TENDER_FLOW_MCP_ACCESS_TOKEN` je lokálně předaný Supabase session token.
Normální session token dostane interní oprávnění jen pro obecné čtení, nikoli
kontaktní údaje ani zápis. Standardní OAuth scopes zůstávají identity claims a
nejsou uměle doplňovány. Audit používá pevné
`client_id = local-stdio`; databázová politika tuto výjimku dovolí pouze tokenu
bez `client_id` i `azp`.

## Zacházení s tokeny

- Tokeny patří pouze do lokálního secret store nebo runtime environmentu.
- Token nesmí být v Git, dokumentaci, audit payloadu, URL ani chybové zprávě.
- MCP audit ukládá identifikátor uživatele/klienta a redigované souhrny, ne
  Bearer token.
- Při podezření na únik je nutné zneplatnit session/credential, odstranit OAuth
  client z allowlistu a prověřit MCP audit.
