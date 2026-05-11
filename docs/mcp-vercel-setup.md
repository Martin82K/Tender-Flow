# Zprovoznění Tender Flow MCP Na Vercelu

Verze dokumentu: 0.1.0
Datum: 2026-05-11
Stav: praktický MVP návod

## Cíl

Zprovoznit remote MCP server na stejné Vercel doméně jako Tender Flow:

```text
https://tenderflow.cz/api/mcp
```

Budeme se držet původního plánu:

- hosting: Vercel,
- autentizace: Supabase OAuth 2.1 Server,
- data a oprávnění: Supabase RLS,
- žádné `.env` soubory jako zdroj pravdy,
- žádný Supabase service role key ve Vercelu,
- první testovací klient: ChatGPT remote MCP / Developer mode.

## Co Už Je V Kódu Připravené

- MCP endpoint: `/api/mcp`
- protected resource metadata: `/api/mcp-resource`
- well-known metadata: `/.well-known/oauth-protected-resource`
- consent page: `/oauth/consent`
- Supabase JWT/JWKS ověření
- read-only MCP tools
- třífázový write flow
- audit/proposal/idempotency DB migrace

## Krok 1: Aplikuj Supabase Migraci

V Supabase spusť migraci:

```text
supabase/migrations/20260511170000_mcp_remote_server_tables.sql
```

Vytvoří:

- `mcp_audit_events`
- `mcp_change_proposals`
- `mcp_idempotency_keys`

Ověř v Supabase Table Editoru, že tabulky existují a mají zapnuté RLS.

## Krok 2: Nastav Supabase Auth URL

V Supabase Dashboard:

```text
Authentication -> URL Configuration
```

Nastav:

```text
Site URL: https://tenderflow.cz
```

Do redirect URLs přidej minimálně:

```text
https://tenderflow.cz/**
```

Pro preview/staging můžeš dočasně přidat i Vercel preview doménu:

```text
https://*.vercel.app/**
```

Produkčně drž allowlist co nejužší.

## Krok 3: Zapni Supabase OAuth 2.1 Server

V Supabase Dashboard:

```text
Authentication -> OAuth Server
```

Zapni OAuth 2.1 Server.

Nastav authorization path:

```text
/oauth/consent
```

Výsledná consent URL bude:

```text
https://tenderflow.cz/oauth/consent
```

Pokud je v Supabase dostupné nastavení Dynamic Client Registration pro MCP klienty, zapni ho. ChatGPT a další MCP klienti ho používají pro automatickou registraci OAuth klienta.

## Krok 4: Nastav Vercel Environment Variables

Nepoužívej `.env` jako zdroj pravdy. Nastav hodnoty ve Vercelu:

```text
Vercel -> Project -> Settings -> Environment Variables
```

Přidej:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-public-key>
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

Volitelně zatím nech prázdné:

```text
MCP_ALLOWED_CLIENT_IDS=
```

Po prvním úspěšném připojení ChatGPT doplň skutečný `client_id`:

```text
MCP_ALLOWED_CLIENT_IDS=<chatgpt-oauth-client-id>
```

Pozor:

- `SUPABASE_ANON_KEY` je veřejný anon key, ne service role key.
- `SUPABASE_SERVICE_ROLE_KEY` do Vercelu pro MCP nedávej.
- Refresh tokeny se neukládají do Vercelu ani do MCP tabulek.

## Krok 5: Deployni Vercel

Deploy proveď standardním Vercel flow.

Po deployi otevři:

```text
https://tenderflow.cz/api/mcp-resource
```

Očekávaný výsledek je JSON podobný:

```json
{
  "resource": "https://tenderflow.cz/api/mcp",
  "authorization_servers": ["https://<project-ref>.supabase.co/auth/v1"],
  "bearer_methods_supported": ["header"],
  "scopes_supported": ["openid", "email", "profile"],
  "resource_documentation": "https://tenderflow.cz/app/settings?tab=tools"
}
```

## Krok 6: Ověř Fail-Closed MCP Endpoint

Bez tokenu musí MCP endpoint odmítnout request.

```bash
curl -i https://tenderflow.cz/api/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Očekávej:

```text
HTTP/2 401
www-authenticate: Bearer resource_metadata="https://tenderflow.cz/api/mcp-resource"
```

Tohle je správně. Znamená to, že endpoint není veřejně čitelný bez OAuth tokenu.

## Krok 7: Otestuj Consent Page

Přímé otevření bez `authorization_id`:

```text
https://tenderflow.cz/oauth/consent
```

má ukázat chybu, že chybí `authorization_id`. To je správně.

Reálný test proběhne až přes OAuth flow z ChatGPT/MCP klienta, protože Supabase vygeneruje `authorization_id`.

## Krok 8: Připoj MCP V ChatGPT

V ChatGPT:

```text
Settings -> Apps / Connectors -> Advanced settings -> Developer mode
```

Zapni Developer mode.

Potom vytvoř / přidej remote MCP server:

```text
Server URL: https://tenderflow.cz/api/mcp
Authentication: OAuth
Protocol: Streamable HTTP
```

ChatGPT by měl spustit OAuth flow:

1. ChatGPT zjistí metadata MCP/OAuth.
2. Supabase zaregistruje nebo použije OAuth klienta.
3. Uživatel se přihlásí do Tender Flow.
4. Tender Flow zobrazí `/oauth/consent`.
5. Uživatel schválí přístup.
6. ChatGPT získá access token.
7. ChatGPT zavolá MCP `initialize` a `tools/list`.

## Krok 9: Po Prvním Připojení Zafixuj Client Allowlist

Po prvním úspěšném připojení zjisti OAuth `client_id`.

Možnosti:

- Supabase Dashboard -> Authentication -> OAuth Apps
- audit záznamy v `mcp_audit_events`, pokud už proběhl tool call
- token claims při lokálním debugování

Potom nastav ve Vercelu:

```text
MCP_ALLOWED_CLIENT_IDS=<client_id>
```

Redeployni aplikaci.

Od té chvíle MCP odmítne OAuth tokeny od neznámých klientů.

## Krok 10: Ověř První Prompty

V ChatGPT použij jednoduché dotazy:

```text
Najdi moje projekty v Tender Flow.
```

```text
Vyhledej VŘ, která mají blížící se termín.
```

```text
Najdi kontakty na subdodavatele podle názvu firmy.
```

Pro zápis testuj jen neškodně:

```text
Připrav vytvoření úkolu v Tender Flow s názvem "Otestovat MCP integraci".
```

Model musí nejdřív použít `tf_prepare_change`, potom žádat potvrzení přes přesný confirmation text a až nakonec `tf_execute_change`.

## Rychlá Diagnostika

### `/api/mcp-resource` vrací 500

Zkontroluj Vercel env:

```text
SUPABASE_URL
VITE_SUPABASE_URL
```

### `/api/mcp` nevrací 401 bez tokenu

To je problém. Endpoint musí fail-closed. Zkontroluj deploy a route `/api/mcp`.

### ChatGPT se nedostane na consent page

Zkontroluj:

- Supabase Site URL je `https://tenderflow.cz`,
- OAuth Server Authorization Path je `/oauth/consent`,
- redirect URL allowlist obsahuje správnou doménu,
- Vercel má nasazenou route `/oauth/consent`.

### Consent page ukazuje chybu Supabase OAuth API

Zkontroluj, že OAuth 2.1 Server je v Supabase opravdu zapnutý. Bez něj `supabase.auth.oauth.*` metody nebudou fungovat správně.

### Tool call vrací chybu RLS

To znamená, že OAuth token funguje, ale uživatel nemá přístup k daným datům. Ověř:

- uživatel je vlastník projektu,
- je člen správné organizace,
- existuje `project_shares`,
- RLS policy nečeká jiný claim než `auth.uid()`.

### Po zapnutí `MCP_ALLOWED_CLIENT_IDS` vše padá na 401

Client ID nesedí. Dočasně proměnnou vyprázdni, znovu připoj klienta a ověř skutečný `client_id`.

## Bezpečnostní Checklist

Před produkčním použitím:

- [ ] ve Vercelu není `SUPABASE_SERVICE_ROLE_KEY`,
- [ ] `.env` není commitnutý,
- [ ] Supabase OAuth Server je zapnutý,
- [ ] consent path je `/oauth/consent`,
- [ ] `/api/mcp` bez tokenu vrací 401,
- [ ] `/api/mcp-resource` vrací správné metadata,
- [ ] `mcp_*` tabulky mají RLS,
- [ ] po prvním připojení je nastavený `MCP_ALLOWED_CLIENT_IDS`,
- [ ] write test vytvoří pouze testovací úkol,
- [ ] audit log obsahuje tool calls.

## Ověřovací Příkazy V Repu

Před deployem nebo po změnách:

```bash
npm run test:run
npm run check:boundaries
npm run check:legacy-structure
npm run build
```

## Zdroje

- OpenAI remote MCP guide: https://platform.openai.com/docs/mcp/
- OpenAI ChatGPT Developer mode: https://platform.openai.com/docs/guides/developer-mode
- Supabase OAuth 2.1 Server: https://supabase.com/docs/guides/auth/oauth-server
- Supabase OAuth Getting Started: https://supabase.com/docs/guides/auth/oauth-server/getting-started
- Supabase MCP Authentication: https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication

## Version History

| Verze | Datum | Změny |
| --- | --- | --- |
| 0.1.0 | 2026-05-11 | První praktický návod pro zprovoznění MCP MVP na Vercelu se Supabase OAuth 2.1. |
