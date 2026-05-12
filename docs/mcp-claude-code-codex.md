# Tender Flow MCP Pro Claude Code A Codex

Datum: 2026-05-12
Stav: připraveno pro remote HTTP i lokální stdio režim

## Co Je Správný Tvar

MCP není skill. Skill je sada instrukcí pro agenta. Plugin může MCP server přibalit a distribuovat, ale vlastní integrace, přes kterou Claude Code nebo Codex komunikuje s Tender Flow, je MCP server.

Tender Flow teď podporuje dvě cesty:

1. Remote HTTP MCP: `https://tenderflow.cz/api/mcp`
   - nejlepší cílový režim pro Claude Code a Codex,
   - používá Supabase OAuth 2.1, `client_id`, RLS a audit,
   - podporuje read tools i třífázové zápisy.

2. Lokální stdio MCP: `npm run mcp:stdio`
   - záložní/dev režim pro klienty, kde remote OAuth zlobí,
   - používá Supabase access token z lokálního prostředí,
   - bez OAuth `client_id` běží záměrně pouze read-only.

## Claude Code

Repo obsahuje projektový `.mcp.json`, který přidává remote MCP server:

```json
{
  "mcpServers": {
    "tender-flow": {
      "type": "http",
      "url": "https://tenderflow.cz/api/mcp"
    }
  }
}
```

Postup:

```bash
claude
/mcp
```

V `/mcp` potvrď server `tender-flow` a projdi OAuth přihlášení. Pokud chceš server přidat ručně jen pro sebe:

```bash
claude mcp add --transport http --scope local tender-flow https://tenderflow.cz/api/mcp
```

Lokální stdio varianta:

```bash
export TENDER_FLOW_MCP_ACCESS_TOKEN="<supabase-access-token>"
claude mcp add --transport stdio --scope local tender-flow-local -- npm run mcp:stdio
```

`SUPABASE_URL`/`VITE_SUPABASE_URL` a `SUPABASE_ANON_KEY`/`VITE_SUPABASE_ANON_KEY` se načtou z prostředí nebo z `.env.local`.

## Codex

Remote HTTP konfigurace v `~/.codex/config.toml`:

```toml
[mcp_servers.tender-flow]
url = "https://tenderflow.cz/api/mcp"
enabled = true
```

Potom spusť:

```bash
codex mcp login tender-flow
codex mcp get tender-flow
```

Lokální stdio konfigurace:

```toml
[mcp_servers.tender-flow-local]
command = "npm"
args = ["run", "mcp:stdio"]
cwd = "/Users/martinkalkus/Downloads/_Ideas/Tender-Flow"
enabled = true
env_vars = ["TENDER_FLOW_MCP_ACCESS_TOKEN", "SUPABASE_URL", "SUPABASE_ANON_KEY", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]
```

## Bezpečnostní Chování

- Remote MCP vyžaduje OAuth bearer token a v produkci i `MCP_ALLOWED_CLIENT_IDS`.
- Business data se čtou přes Supabase klienta s uživatelským tokenem, takže platí RLS.
- Zápisové nástroje používají `prepare -> confirm -> execute`.
- Lokální stdio s běžným Supabase session tokenem neregistruje zápisové nástroje, protože token nemá OAuth `client_id` potřebné pro audit/RLS stavové tabulky.
- Tokeny se nedávají do `.mcp.json` ani do repozitáře. Patří do lokálního prostředí nebo bezpečného OAuth úložiště klienta.
