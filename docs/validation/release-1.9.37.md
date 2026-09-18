# Validace vydání 1.9.37

Lokálně ověřeno 18. 9. 2026 na macOS Apple Silicon. Rozsah: všechny změny
sloučené do main mezi v1.9.36 a commitem 4b00e383, synchronizace verze
a release poznámky. Otevřená PR #470/#471 a pracovní output/ a tmp/
nejsou součástí tohoto vydání.

## Kontroly

- Vitest: 548 souborů, 3 035 testů, bez skip/todo a neošetřených chyb.
- Regrese release indexu nejprve selhala na starém odkazu; po opravě prošlo
  všech 13 cílených testů i kompletní sada.
- Typecheck, web build, kontrola web dist, desktop compile, docs, boundaries
  a legacy structure prošly. Lockfile diff mění pouze verzi aplikace.
- Root audit: 5 moderate, 2 low, žádné high/critical. Desktop: 0 nálezů.
  Ověřeno 854 root a 116 desktop registry podpisů a 143/5 attestací.
- Windows x64 NSIS a macOS arm64 DMG/ZIP sestaveny lokálně; použitá nastavení
  `mac.identity=-` a `toolsets.nsis=1.2.1` odpovídají předchozím vydáním.
- Windows release metadata prošla ověřením. macOS aplikace prošla
  `codesign --verify --deep --strict` a spuštěním z app.asar v izolovaném
  profilu: přihlášení, verze 1.9.37, výchozí cíl všech staveb, žádné page errors.
- Updater loopback test prošel včetně výběru zdroje, fallbacku a odmítnutí
  špatného SHA-512. Nenahrazuje skutečnou instalaci na Windows.
- Produkční web preview: úvodní stránka → přihlášení, správná verze a vizuální
  kontrola. Konzole bez error; očekávané upozornění na chybějící session.
  Přihlášené zákaznické toky ani úplný Windows update nebyly lokálně provedeny.

## Databáze

Všechny čtyři migrace po v1.9.36 už byly nasazené, včetně
`20260918104557_preserve_price_offer_restore`. Závěrečný CLI dry-run:
`Remote database is up to date.` Nebyla provedena změna schématu ani dat.
RLS je zapnuté na contracts, contract_handover_events a
contract_generated_documents; kontrola cesty nabídky, kind constraint a FK
verze dokumentu jsou validované. Anon nemůže volat potvrzení předání.
Oba DocHub OAuth callbacky jsou aktivní s aktualizací z 17. 9. 2026.

## Zbývající rizika

- Ve sloučeném PR #472 zůstávají čtyři nevyřešená P2 review vlákna:
  licence při převodu vlastnictví, MCP návrhy/idempotentní výsledky,
  tarif projektových šablon a organizační telemetrie. Tento release
  je neopravuje; nelze tvrdit úplné uzavření licenčního review.
- Review vlákna PR #475/#476 jsou vyřešená; #474 nemá review vlákna.
- GitHub Code Scanning nemá analýzu (404); Dependabot alerts jsou vypnuté (403).
- Supabase advisors nadále hlásí širší nálezy: mutable search_path,
  spustitelné SECURITY DEFINER funkce, vypnutou ochranu uniklých hesel,
  neindexované FK a výkonnostní doporučení. Nebyly plošně opravovány.
  Viz [Supabase database linter](https://supabase.com/docs/guides/database/database-linter).
- Windows bez Authenticode podpisu; macOS ad-hoc podpis bez notarizace.
- Build upozorňuje na velké chunky a neúčinný dynamický import incidentLogger.
- První omezený testovací běh narazil na sandbox a Xcode licenci.
  Finální sada běžela s Command Line Tools a povolenými loopback servery.

