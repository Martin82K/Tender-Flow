# Vyřazení hlasového asistenta – 4. září 2026

## Rozsah

Odstraněny frontendový provider, panel, launcher, WebRTC klient, hlasové/textové
adaptéry, persona, obrázek a jejich samostatné testy. `AppContent` již kvůli
asistentovi nenačítá smlouvy všech projektů. Společné diktování a čtení textu
nejsou součástí této funkce a zůstávají dostupné.

Ze společného `ai-proxy` zmizela implementace paměti. Staré akce `memory-load`
a `memory-save` po ověření identity vracejí HTTP 410 bez přístupu do Storage,
bez načítání obchodních dat a bez volání modelu. `list-models` nadále slouží
nastavení Mistralu a používá běžné ověření předplatného.

Původní migrace a release notes zůstávají historickými záznamy. Klíče
`ai_viki` a `feature_voice_assistant` se vyskytují pouze v potřebném úklidu,
archivačních pravidlech a testu odstranění. Historické dokumenty ve Storage
se tímto krokem nemažou.

## Provedené nasazení

Projekt Supabase: `vpvowigatikngnaflkyk` (Tender Flow).

1. Ověřeny endpointy, závislosti a počty: oba feature klíče měly po pěti
   tarifních záznamech, žádné uživatelské výjimky; starší klíč měl 96 událostí.
2. Migrace `20260904212631_retire_voice_assistant.sql` vyzkoušena v transakci
   s rollbackem. Cizí klíče a RLS zůstávají zachovány; indexy, grants a pravidla
   přístupu se nemění. CLI dry-run nabídl pouze tuto migraci.
3. Z produkce odstraněny funkce `realtime-session-create` a `viky-text-response`.
4. `ai-proxy` nasazeno ve verzi 67 přes API, s `verify_jwt=true`.
5. Aplikována verzovaná migrace. Následná kontrola potvrdila nulu tarifních
   oprávnění a výjimek, odstranění nepoužívané feature a zachování všech
   96 historických událostí pod archivovaným záznamem.
6. Závěrečný `supabase db push --dry-run`: **Remote database is up to date.**
   Seznam funkcí již neobsahuje oba vyřazené endpointy.

Při rollbacku lze dohledat kód v Git historii, ale původní oprávnění nelze
obnovovat plošně. Návrat asistenta vyžaduje nové výslovné rozhodnutí,
bezpečnostní kontrolu a verzovanou migraci.

## Ověření a omezení

- Celá lokální sada: 463 souborů, 2 366 testů prošlo, bez skip/todo.
- Nové scénáře nejprve selhaly, poté prošly: obsah landing page, metadata,
  absence runtime asistenta, ukončené memory akce a oprávnění pro seznam modelů.
- Typecheck, web build, desktop TypeScript compile, dokumentační odkazy,
  boundary guard i legacy freeze prošly. Desktop kompilace použila existující
  závislosti; neproběhla nová instalace balíčků ani vydání desktopové verze.
- Produkční lokální náhled ověřen v prohlížeči na desktopu a při 390 × 844:
  čitelné nové sekce, funkční navigace, rozbalení MCP postupu a ceník.
  Odkaz do nastavení zachoval `next` při přesměrování na přihlášení.
  Bez chyb konzole; jediný warning oznamoval očekávanou nepřihlášenou session.
  Mobilní šířka dokumentu odpovídala viewportu. Přihlášený Electron scénář
  a skutečné OCR s placeným modelem nebyly v této kontrole provedeny.
- Legacy importy sníženy ze 134 na 130, frozen soubory ze 113 na 112.
  Zůstává 37 existujících boundary výjimek a build warning velkých chunků.
- Supabase advisors po migraci hlásí 334 bezpečnostních WARN + 10 INFO
  a 279 výkonových WARN + 108 INFO napříč existujícím schématem.
  Tato datová migrace nemění funkce ani RLS; nejde o uzavření databázového auditu.
  Další kontrolu potřebují například [search_path funkcí](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
  a [opakované RLS výpočty](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan).
