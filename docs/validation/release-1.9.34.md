# Validace vydání 1.9.34

Ověřeno 16. 9. 2026 lokálně na macOS Apple Silicon.

## Rozsah a regresní kontroly

Portfolio a projektová navigace, kompaktní analytický souhrn, pozastávky z PR
#457, dokumentace z PR #449 a vyřazení zkracovače URL z již sloučeného PR #461.
Pracovní grafické výstupy, obchodní podklady v `output/` a dočasné `tmp/`
nejsou součástí zdrojového commitu tohoto vydání.

- Vitest před review: 531 souborů, 2 883 testů, bez skip/todo a bez neošetřených chyb.
- Python Excel merge: 8 testů.
- Typecheck, web build, kontrola dist, desktop compile, docs, boundaries a
  legacy structure prošly. Lockfile mění pouze verzi aplikace.
- Root audit: 0 high/critical, 3 moderate a 2 low (Vitest/mocker, Hono, Joi/wait-on).
  Desktop audit: 0 zranitelností. Ověřeno 854 root a 116 desktop podpisů;
  143 root a 5 desktop attestací. Žádná aktualizace závislostí.
- Updater runtime: loopback test výběru zdroje, fallbacku a odmítnutí špatného
  kontrolního součtu prošel; není náhradou skutečné instalace na Windows.
- Browser fixture: 3 šířky, 12 kombinací skin/režim, hover, fokus, klávesnice,
  výběr příjemce, smluvní odkazy, zoom a mobil prošly bez neočekávané chyby.
- Produkční preview: login guard ve fresh profilu; v existující přihlášené
  relaci portfolio načetlo souhrny, hledání omezilo tabulku i grafy a odkaz
  otevřel stavbu. Sidebar rozbalil Objednatele a Subdodavatele.

Původní běhy zachytily zastaralé očekávání počtu modulů, staré selektory vzhledu
a chybějící release notes. Testy byly sladěny se změnou UI; kontroly oprávnění
zůstaly zachované. Testy lokálních serverů vyžadovaly běh mimo síťový sandbox.

## Doplnění po review

Review #462 odhalilo přepsání uloženého scrollu při změně hledání nebo filtru
vlastních staveb. Dva regresní testy nejprve obnovily 0 místo 240 px; po opravě
oba prošly. Změna filtrů nyní přebírá aktuální scroll z refu. Původní CI
potvrdilo 2 883 testů; po doplnění regresí má sada 2 885 testů.

Další review doplnilo rozlišení shodných názvů staveb lokací a fází a otevření
nově založené stavby přímo z filtrovaného archivu. Oba scénáře mají RED/GREEN
regrese. Finální lokální sada: 532 souborů, 2 891 testů, bez skip/todo a chyb.
Typecheck, web build, docs, boundaries, legacy structure i browser fixture prošly.

CI root audit eviduje 5 moderate + 2 low (navíc závislé MCP SDK a Hono server),
bez high/critical; desktop audit je čistý. Ověřilo 860 root a 116 desktop podpisů.
Lokální macOS balíček prošel deep/strict kontrolou ad-hoc podpisu a skutečně se
spustil z app.asar do přihlášení s verzí 1.9.34. Balení používá stejná lokální
nastavení jako 1.9.33: `mac.identity=-`, `toolsets.nsis=1.2.1`.

## Databáze

Dry-run obsahoval pouze `20260914184053_retention_release_evidence.sql`.
První pokus odmítl trigger archivované stavby; transakce byla celá vrácena.
Regresní RED/GREEN test pokrývá atomický backfill s exkluzivním zámkem a
obnovením archivního i timestamp triggeru. Nevypínají se jiné triggery ani RLS.

Opravená migrace byla nasazena. Před i po: 73 smluv, 12 krátkodobých a
10 dlouhodobých plánů, 0 uvolněných smluv. Porovnání kontrolního součtu původních
sloupců potvrdilo, že se nezměnily, včetně `updated_at`. Neshody backfillu: 0.
Všechny čtyři relevantní triggery jsou zapnuté.

SQL regression v rollback transakci ověřil plán/skutečnost, autora historie,
odmítnutí opakování, budoucího data, cizího uživatele, anonymního přístupu a
editace historie. Po rollbacku zůstalo 0 testovacích eventů. Historie má RLS,
authenticated má pouze SELECT a anon nemůže spustit potvrzovací RPC.
Závěrečný dry-run: `Remote database is up to date.`

Migrace `20260915231450_restore_retention_backup_evidence.sql` následně doplnila
export i obnovu pozastávek do obou druhů záloh. Obnova používá soukromé oprávnění
vázané na transakci a smlouvu, nikoli klientem nastavitelné GUC; žádný trigger
nevypíná. Kontroluje organizaci, stavbu a vlastníka nebo správce. Historii
nesmaže ani nepřepíše a konfliktní identifikátory odmítne. Samotná obnova se
zapisuje do `backup_history` s identitou obnovujícího uživatele.

SQL roundtrip před opravou selhal na chybějící historii. Po migraci prošla
uživatelská i organizační obnova do nových UUID, opakování bez duplicit,
odmítnutí cizí stavby/eventu a kolize ID i zachování údajů u starší zálohy.
Test pracoval pouze s novými fixture smlouvami a všechny zápisy vrátil.
Původní test s DELETE zamítla automatická kontrola; bezpečnější varianta nic
nemaže. Původních 73 smluv má po ověření stejný kontrolní součet, audit i
tabulka dočasných oprávnění jsou prázdné. Původní SQL test potvrzení uvolnění,
RLS a neměnnosti auditu také znovu prošel.

Následné bezpečnostní review odhalilo možnost podvrhnout historii v nepodepsaném
manifestu. Regresní SQL test reprodukoval změnu existující pozastávky bez auditu.
Oprava `20260915233324_authenticate_retention_backup_history.sql` zachovává
existující evidenci jako autoritativní a její UPDATE vede běžným auditním triggerem.
Historie chybějící smlouvy vyžaduje HMAC-SHA256 podpis exportu, vázaný na smlouvu,
stavbu, organizaci, vlastníka, retenční pole i události. Klíč i podpisová funkce
jsou soukromé a nepřístupné API rolím. Číselný zápis se normalizuje pro JSON
roundtrip přes JavaScript. Staré nepodepsané plány lze obnovit, nepodepsaná
historická potvrzení chybějících smluv jsou odmítnuta. Pro obnovu do jiného
databázového prostředí je nutné bezpečně obnovit také soukromý podpisový klíč;
klíč se nikdy nepřikládá ke klientským JSON zálohám.

Migrace `20260915233656_portfolio_pipeline_read_access.sql` přidává hromadnou
kontrolu pipeline oprávnění jako SECURITY INVOKER pod běžným RLS. Klient při
zamítnutí nebo chybě nesestavuje nulové souhrny. Analytický výběr staveb rozlišuje
lokaci a při úplné shodě také ID. Oba nálezy mají cílené RED/GREEN regrese.

Finální ověření po bezpečnostním review: 533 souborů / 2 897 testů bez skip/todo
a neošetřených chyb; typecheck, web build, docs, boundaries, legacy i browser
fixture prošly. Obě poslední migrace jsou nasazené. SQL testy ověřily ochranu
existujícího auditu, obnovu podepsané historie obou typů záloh, odmítnutí změny
autora/času/identity a nepodepsané historie, číselnou normalizaci JSON a staré
nepodepsané plány. Hromadná kontrola oprávnění odpovídá RLS; anon ji nespustí.
Po rollback testech: 73 smluv se stejným checksumem, 0 eventů a 0 dočasných
oprávnění; podpisový klíč není čitelný rolí authenticated. Závěrečný dry-run
hlásí aktuální databázi a advisors nemají nový nález pro přidané objekty.

Security advisor nemá nález pro nové objekty pozastávek. Performance advisor
u nového indexu autora hlásí pouze dosud nepoužitý index; zachován kvůli FK.
Globální advisors nejsou čisté: obsahují dřívější objekty se změnitelným
search_path, SECURITY DEFINER RPC, RLS bez politik, neindexované FK a další
výkonnostní doporučení. Nálezy nebyly v rámci release plošně opravovány.
Viz [Supabase database linter](https://supabase.com/docs/guides/database/database-linter).

## Zbývající omezení

- GitHub Code Scanning nemá analýzu (404), Dependabot alerts jsou vypnuté (403).
- Build hlásí velké chunky a neúčinný dynamický import incidentLogger.
- Při vstupu do již přihlášeného osobního TODO se objevila chyba fetch
  `microsoft-todo-sync`. Portfolio a jeho navigace fungovaly; synchronizace
  Microsoft účtu nebyla tímto vydáním ověřena.
- Windows Authenticode podpis ani macOS notarizace nejsou nakonfigurované;
  macOS používá ad-hoc podpis. Úplná instalace/updater na Windows vyžaduje
  samostatnou kontrolu na Windows.
