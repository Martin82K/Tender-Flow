# Tender Flow Remote MCP service

Tento adresář je samostatný Vercel project root pro remote MCP. Nepouští Vite
ani Electron build. Runtime importuje autoritativní implementaci z
`../server/mcp/`; ve Vercel nastavení proto musí být zapnuté **Include source
files outside of the Root Directory**. `mcp-service` je npm workspace kořenového
projektu a používá společný kořenový `package-lock.json`; samostatný lockfile v
tomto adresáři záměrně není, aby se sdílené serverové importy rozřešily z
kořenového `node_modules`.

## Vercel projekt

- Root Directory: `mcp-service`
- Framework Preset: Other
- Production Branch: `release`
- Skip deployments for unaffected projects: zapnuto
- Ignored Build Step: `node ../scripts/vercel-build-scope.mjs mcp`
- Doporučená doména: `mcp.tenderflow.cz`

Povinné serverové proměnné jsou stejné jako v MCP runbooku. Navíc nastavte:

```text
MCP_CANONICAL_BASE_URL=https://www.tenderflow.cz
```

Tím samostatná služba nadále ověřuje původní OAuth resource
`https://www.tenderflow.cz/api/mcp`, i když ji interní proxy volá přes jinou
doménu.

## Bezvýpadkový přechod

1. Nasadit samostatný projekt bez změny `MCP_UPSTREAM_URL` v aplikaci.
2. Ověřit metadata, 401 challenge, autorizovaný read canary a audit.
3. V aplikačním Vercel projektu nastavit
   `MCP_UPSTREAM_URL=https://mcp.tenderflow.cz/api/mcp` a jednou jej znovu
   nasadit.
4. Ověřit, že veřejný endpoint zůstal
   `https://www.tenderflow.cz/api/mcp` a token má stejný resource/audience.
5. Pro aplikační projekt nastavit Ignored Build Step
   `node scripts/vercel-build-scope.mjs app`.

Rollback je odebrání `MCP_UPSTREAM_URL` a jeden redeploy aplikačního projektu;
`api/mcp.js` se pak vrátí k lokálnímu handleru. Databázové migrace se kvůli
rollbacku deploymentu nevracejí destruktivně.
