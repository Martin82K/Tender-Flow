# Security 20. 03. 2026

Pracovní backlog a auditní deník k nálezům z reportu `codex-security-findings-2026-03-20T13-37-18.213Z.csv`.

## Kritické případy

### 1. Admin privilegia přes `subscription_tier_override`

- Stav: `done`
- Riziko: běžný uživatel si může přes zapisovatelný profil vytvořit admin oprávnění.
- Dotčené cesty:
  - `supabase/migrations/20260206100000_fix_subscription_save_comprehensive.sql`
  - `supabase/migrations/20251208001300_user_profiles.sql`
  - `supabase/migrations/20260124143000_update_subscription_tiers_v2.sql`
- Cílový bezpečný stav:
  - platform admin oprávnění je oddělené od subscription tieru
  - `subscription_tier_override` slouží jen pro billing/feature gating
  - owner profilu nemůže měnit privilegované sloupce
- Dvoufázový rollout:
  - Fáze 1: `platform_admins`, nové `is_admin()`, migrace legacy adminů, guardy na `user_profiles`
  - Fáze 2: odstranit nouzový email fallback a prověřit všechny admin RPC/policies
- Implementováno:
  - `20260320150000_harden_platform_admin_and_org_security.sql`
  - `20260320153000_finalize_platform_admin_phase2.sql`
  - klient už neodvozuje admin stav z emailu
- Testy:
  - guard test na absenci vazby `subscription_tier_override -> is_admin`
  - guard test na ochranu citlivých sloupců v `user_profiles`
  - admin RPC nadále fungují proti novému `is_admin()`
- Otevřené otázky:
  - zda vystavit explicitní admin claim i do klientského profilu

### Stav fáze 2

- Nasazeno v migraci `20260320153000_finalize_platform_admin_phase2.sql`
- Klient už neodvozuje admin stav z emailu, ale z `platform_admins`

### 2. Baustav migrace a tenant izolace

- Stav: `mitigated_recovery_pending`
- Riziko: hromadný přesun kontaktů a hard-coded membership míchají tenant data a oprávnění.
- Dotčené cesty:
  - `supabase/migrations/20251205000300_03_data_migration.sql`
  - `supabase/migrations/20260117000100_assign_all_contacts_to_baustav.sql`
  - `supabase/migrations/20260117000200_fix_contact_visibility.sql`
  - `supabase/migrations/20260117000300_add_admin_to_baustav.sql`
- Cílový bezpečný stav:
  - nové environmenty nikdy nepřehrají destruktivní cross-tenant přepis
  - existující databáze mají auditní snapshot dotčených subcontractorů a membershipů
  - subcontractor RLS neudělá z `owner_id IS NULL` implicitně veřejný stav
- Dvoufázový rollout:
  - Fáze 1: neutralizace historických migrací v repu, auditní tabulky, strict policies
  - Fáze 2: recovery skript jen tam, kde je bezpečně dohledatelný původ dat; jinak karanténa/manual review
- Implementováno:
  - historické destruktivní migrace jsou v repu neutralizované pro nové environmenty
  - auditní snapshot tabulky jsou vytvořené
  - strict subcontractor policies jsou obnovené
- Testy:
  - guard test na no-op historických migrací
  - guard test na auditní snapshot tabulky
  - guard test na strict subcontractor policies bez veřejného NULL-owner chování
- Otevřené otázky:
  - které Baustav membershipy jsou businessově legitimní a které mají být odebrány
  - odkud bezpečně vzít původní tenant při recovery

### 3. `get_or_create_user_organization` bez auth kontrol

- Stav: `done`
- Riziko: klient může podvrhnout `user_id` nebo `email` a získat členství v cizím tenantovi.
- Dotčené cesty:
  - `supabase/migrations/20260104230000_auto_organization_for_solo_users.sql`
  - `supabase/migrations/20260104233000_per_tenant_contact_statuses.sql`
- Cílový bezpečný stav:
  - veřejný wrapper používá jen `auth.uid()` a email z auth kontextu
  - interní bootstrap funkce není volatelná pro `authenticated`
  - signup trigger dál funguje bez změny onboarding flow
- Dvoufázový rollout:
  - Fáze 1: interní funkce + veřejný wrapper + revoke interního EXECUTE
  - Fáze 2: audit všech míst, kde se organizace tvoří nebo joinují podle email domény
- Implementováno:
  - veřejný wrapper používá jen auth kontext
  - interní bootstrap funkce není grantnutá `authenticated`
  - trigger a signup flow zůstaly kompatibilní
- Testy:
  - guard test na oddělení interní a veřejné funkce
  - guard test na kontrolu `p_user_id` a `p_email` proti auth identitě
  - signup trigger používá interní funkci
- Otevřené otázky:
  - zda pro domain join vynutit potvrzený email před přidáním do existující business organizace

## Hotfixy po hardeningu

### UI: správa předplatného v admin tabulce

- Stav: `done`
- Problém: subscription sloupec byl v admin tabulce prakticky neviditelný kvůli příliš širokému layoutu.
- Implementováno:
  - kompaktnější tabulka v `components/UserManagement.tsx`
  - regresní test v `tests/UserManagement.test.tsx`
- Testy:
  - `tests/UserManagement.test.tsx`

## Navazující backlog `high`

- `todo-01` `AI memory endpoint skips project-level authorization checks` `done`
- `todo-02` `Org join requests allow email spoofing to target any org` `done`
- `todo-03` `Command injection via macOS docx conversion IPC handler` `done`
- `todo-04` `Authenticated users can modify any subscription via RPC grants` `done`
- `todo-05` `Public RLS policy exposes all short_urls entries` `done`
- `todo-06` `Electron IPC exposes unrestricted filesystem access` `done`
- `todo-07` `Short URL redirects allow arbitrary schemes causing stored XSS` `done`
- `todo-08` `Ownerless project RLS exposes contract/financial data` `done`
- `todo-09` `Projects RLS makes NULL-owner rows globally readable/editable` `done`
- `todo-10` `Overly permissive RLS policies expose all subcontractors` `done`

### Dokončené high priority položky

#### `todo-02` Org join requests allow email spoofing to target any org

- Stav: `done`
- Implementováno:
  - `20260320170000_harden_org_join_and_subscription_rpc.sql`
  - server důvěřuje jen emailu přihlášeného uživatele z auth kontextu
  - insert policy navíc validuje shodu emailu a domény organizace
- Funkční dopad:
  - běžný join request flow zůstává
  - podvržení cizího emailu už neprojde

#### `todo-03` Command injection via macOS docx conversion IPC handler

- Stav: `done`
- Implementováno:
  - `desktop/main/ipc/modules/docxConversion.ts`
  - `desktop/main/ipc/handlers.ts`
  - `tests/docxConversion.test.ts`
  - konverze na macOS už nepoužívá shell command string přes `exec`, ale `execFile` s argumentovým polem
  - název výstupního souboru je sanitizovaný pro bezpečný temp output
- Funkční dopad:
  - injekční payload ve vstupní cestě už není vykonatelný jako shell příkaz
  - `shell:convertToDocx` flow zůstává funkčně kompatibilní

#### `todo-06` Electron IPC exposes unrestricted filesystem access

- Stav: `done`
- Implementováno:
  - `desktop/main/ipc/modules/fsHandlers.ts`
  - `tests/fsHandlers.test.ts`
  - všechny `fs:*` handlery teď validují cílové cesty přes centrální path guard
  - guard povoluje jen cesty uvnitř `home`, `userData` a `tmp` roots
  - čtení navíc používá `realpath` (symlink-safe kontrola proti escape mimo povolené rooty)
  - zápis ověřuje nejbližší existující parent přes `realpath`, aby nešlo zapisovat mimo povolený scope
- Funkční dopad:
  - renderer už nemůže přes IPC číst/zapisovat libovolné cesty mimo bezpečný scope
  - běžné desktop flow (OneDrive/home/tmp/userData) zůstává funkční

#### `todo-07` Short URL redirects allow arbitrary schemes causing stored XSS

- Stav: `done`
- Implementováno:
  - `services/urlShortenerService.ts`
  - `shared/routing/ShortUrlRedirect.tsx`
  - `tests/urlShortenerSecurity.test.ts`
  - URL shortener nově centralizovaně validuje cílové URL přes `normalizeSafeShortRedirectUrl`
  - povoleny jsou pouze `http:` a `https:`; ostatní schémata (`javascript:`, `data:`, `file:` atd.) jsou blokována
  - validace běží při vytváření short URL i při resolve redirectu
  - pro unsafe cíl se neprovádí redirect ani increment kliků
- Funkční dopad:
  - short URL už nelze použít pro stored XSS přes nebezpečné URI schéma
  - validní HTTP(S) redirect flow zůstává kompatibilní

#### `todo-05` Public RLS policy exposes all short_urls entries

- Stav: `done`
- Implementováno:
  - `supabase/migrations/20260320190000_harden_short_urls_rls.sql`
  - `services/urlShortenerService.ts`
  - `tests/highPrioritySecurityMigrations.test.ts`
  - `tests/urlShortenerSecurity.test.ts`
  - odstraněna public SELECT policy `"Everyone can read short URLs"` nad `short_urls`
  - přidána owner-only SELECT policy pro správu vlastních odkazů
  - pro veřejný redirect přidána úzká `SECURITY DEFINER` RPC `public.get_short_url_target(url_id text)` s validací aliasu
  - klientský redirect flow (`getOriginalUrl`) nově čte cíl přes RPC resolver místo přímého SELECTu tabulky
- Funkční dopad:
  - tabulka `short_urls` už není veřejně enumerable přes RLS
  - veřejné přesměrování podle kódu zůstává funkční bez zpřístupnění celé tabulky

## Dodatečný hotfix po validaci

### Projects: org-wide viditelnost zobrazovala cizí stavby bez explicitního share

- Stav: `done`
- Implementováno:
  - `20260320194000_restore_project_owner_share_visibility.sql`
  - `hooks/queries/useProjectsQuery.ts`
  - `tests/highPrioritySecurityMigrations.test.ts`
  - projects SELECT/UPDATE/DELETE vráceny na `owner + explicit share (+ demo)` bez org-wide fallbacku
  - `get_projects_metadata`, `get_project_shares`, `get_project_shares_v2` sjednoceny na stejnou access logiku
  - UI query má navíc fail-closed filtr: renderer zobrazí jen projekty ownera, explicitně sdílené projekty a demo
- Funkční dopad:
  - uživatel nevidí cizí stavby jen proto, že je ve stejné organizaci
  - spolupráce přes explicitní sdílení projektu zůstává zachovaná

#### `todo-01` AI memory endpoint skips project-level authorization checks

- Stav: `done`
- Implementováno:
  - `supabase/functions/ai-proxy/index.ts`
  - `supabase/functions/ai-proxy/memoryAccess.ts`
  - `tests/aiProxy.memoryAccess.test.ts`
  - `memory-load` a `memory-save` nově validují přístup ke konkrétnímu projektu přes RLS nad tabulkou `projects`
  - storage cesta se nově skládá z `organization_id` autorizovaného projektu, ne z první nalezené organizace uživatele
- Funkční dopad:
  - uživatel bez přístupu ke zvolenému projektu nedokáže číst ani zapisovat Viki memory přes podvržené `projectId`
  - tenant scope pro storage zůstává svázaný s projektem, takže nehrozí křížový přístup mezi projekty/organizacemi přes odhadnutou cestu

#### `todo-04` Authenticated users can modify any subscription via RPC grants

- Stav: `done`
- Implementováno:
  - `20260320170000_harden_org_join_and_subscription_rpc.sql`
  - `start_user_trial` a `activate_subscription` už nejsou dostupné pro běžné `authenticated`
  - `cancel_subscription()` a `reactivate_subscription()` zůstaly jako self-service bez cizího `user_id`
- Funkční dopad:
  - běžný uživatel si dál může zrušit nebo obnovit vlastní subscription
  - běžný uživatel už nemůže obcházet billing/admin flow pro aktivaci tarifu

#### `todo-08` Ownerless project RLS exposes contract/financial data

- Stav: `done`
- Implementováno:
  - `20260320173000_harden_ownerless_sensitive_project_data_rls.sql`
  - odstraněn `owner_id IS NULL` fallback z RLS politik pro `project_contracts`, `project_investor_financials`, `project_amendments`
  - odstraněn `owner_id IS NULL` fallback z RLS politik pro `contracts`, `contract_amendments`, `contract_drawdowns`, `contract_markdown_versions`
  - přidány guard testy v `tests/ownerlessSensitiveProjectDataRls.test.ts` a `tests/highPrioritySecurityMigrations.test.ts`
- Funkční dopad:
  - orphan/legacy projekt už automaticky neotevře smlouvy, dodatky, drawdowny ani investor financials komukoli přihlášenému
  - přístup k citlivým datům zůstává jen ownerovi nebo explicitně sdílenému uživateli podle typu oprávnění

#### `todo-09` Projects RLS makes NULL-owner rows globally readable/editable

- Stav: `done`
- Implementováno:
  - `20260320180000_harden_projects_null_owner_rls.sql`
  - odstraněn `owner_id IS NULL` fallback z `projects` SELECT/INSERT/UPDATE/DELETE politik
  - `get_projects_metadata()`, `get_project_shares()` a `get_project_shares_v2()` nově používají stejnou access logiku bez public `NULL-owner` výjimky
  - orphan projekty jsou nově vázané na tenant přes `organization_id`, explicitní share nebo demo režim
- Funkční dopad:
  - `NULL-owner` projekt už není globálně čitelný ani editovatelný pro libovolného přihlášeného uživatele
  - tenantové projekty bez ownera zůstávají dostupné jen členům stejné organizace, sdíleným uživatelům nebo přes demo flow tam, kde to dává smysl

#### `todo-10` Overly permissive RLS policies expose all subcontractors

- Stav: `done`
- Implementováno:
  - `20260320183000_harden_subcontractors_rls.sql`
  - odstraněny legacy/public subcontractor politiky s implicitním `NULL-owner` chováním
  - SELECT/INSERT/UPDATE/DELETE zůstávají sdílené v rámci celé organizace přes `organization_id = ANY(public.get_my_org_ids())`
  - přístup už ale není veřejný mimo tenant a není otevřený přes `owner_id IS NULL`
- Funkční dopad:
  - každý člen organizace může dál číst a spravovat společnou databázi kontaktů své organizace
  - kontakty už nejsou vystavené mimo tenant přes příliš permissive/public RLS

## Doporučené další kroky

- dokončit recovery plán pro Baustav incident na základě auditních snapshotů
- high-priority sada `todo-01` až `todo-10` je dokončená

## Minimální gate před merge

- `npm run test:run -- tests/criticalSecurityMigrations.test.ts`
- `npm run test:run -- tests/complianceRlsPolicies.test.ts`
- `npm run test:run -- tests/fsHandlers.test.ts`
- `npm run test:run -- tests/securityHeaders.test.ts`
- `npm run check:boundaries`
- `npm run check:legacy-structure`
- `npm run test:run`
