# Tender Flow v1.9.3

Patch release opravuje otevírání sdílených DocHub složek, odděluje projektové
šablony jednotlivých uživatelů a uzavírá souběžné provedení potvrzených MCP
změn. GitHub Release zůstává před publikací v režimu draft.

## Opravy a zlepšení

- **Sdílené složky DocHub:** uživatel bez lokálně synchronizované složky může
  přímo z výběrového řízení použít bezpečný online fallback. Dohledání zůstává
  omezené na autorizovaný projektový kořen a používá read-only provider operace.
- **Osobní projektové šablony:** aktivní výběr šablony se ukládá pro konkrétního
  uživatele, stavbu a typ dokumentu. Výběr ani úprava výchozí šablony už
  nepřepisuje nastavení kolegy ve sdíleném projektu.
- **Copy-on-write výchozí šablony:** první výběr nebo uložení systémového vzoru
  vytvoří vlastní projektovou kopii uživatele; systémové vzory zůstávají pouze
  pro čtení.
- **Desktop:** odstraněný lokální MCP bridge a stale desktop build výstupy se
  již nemohou vrátit do instalačního balíčku.

## Bezpečnost a spolehlivost

- Souběžná volání stejného potvrzeného MCP proposalu používají atomický stav
  `executing`; před business mutací uspěje nejvýše jeden požadavek.
- Výběr šablony chrání RLS, složený foreign key uživatel–projekt–šablona a
  atomické ukládání defaultu přes `SECURITY INVOKER` funkci.
- Lokální Codex Security prověřil produkční diff i opravu MCP race. Oprava má
  regresní testy pro souběh se stejným i rozdílným idempotency klíčem.

## Databázové migrace

- `20260813102845_add_mcp_proposal_executing_status.sql`
- `20260813120000_personal_project_template_selections.sql`

Před vydáním musí být obě dopředné migrace nasazené ve stejném pořadí a
ověřené kontrolou constraintů, RLS, grantů, indexů, foreign keys a hosted
security/performance advisors.

## Ověření před publikací

- Ověřit web build, desktop compile, úplnou testovací sadu a dependency audity.
- Lokálně sestavit macOS ARM64 DMG/ZIP a Windows x64 NSIS včetně blockmap a
  updater YAML souborů.
- Ověřit shodu verze, názvy, velikosti a SHA-512 metadata updater assetů.
- Ověřit instalaci a aktualizaci z `v1.9.2`, přihlášení, hlavní navigaci,
  výběrové řízení a otevření sdíleného odkazu DocHub na stavbě Pyrum.

## Instalace

Assety budou připojeny k draft release výhradně z lokálního
`dist-electron/`. GitHub Actions je nesmí připojit ani přepsat.
