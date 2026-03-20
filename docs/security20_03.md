# Security 20. 03. 2026

Pracovní backlog a auditní deník k nálezům z reportu `codex-security-findings-2026-03-20T13-37-18.213Z.csv`.

## Kritické případy

### 1. Admin privilegia přes `subscription_tier_override`

- Stav: `in_progress`
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
- Testy:
  - guard test na absenci vazby `subscription_tier_override -> is_admin`
  - guard test na ochranu citlivých sloupců v `user_profiles`
  - admin RPC nadále fungují proti novému `is_admin()`
- Otevřené otázky:
  - kdy odstranit bootstrap email fallback po ověření provozu
  - zda vystavit explicitní admin claim i do klientského profilu

### 2. Baustav migrace a tenant izolace

- Stav: `in_progress`
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
- Testy:
  - guard test na no-op historických migrací
  - guard test na auditní snapshot tabulky
  - guard test na strict subcontractor policies bez veřejného NULL-owner chování
- Otevřené otázky:
  - které Baustav membershipy jsou businessově legitimní a které mají být odebrány
  - odkud bezpečně vzít původní tenant při recovery

### 3. `get_or_create_user_organization` bez auth kontrol

- Stav: `in_progress`
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
- Testy:
  - guard test na oddělení interní a veřejné funkce
  - guard test na kontrolu `p_user_id` a `p_email` proti auth identitě
  - signup trigger používá interní funkci
- Otevřené otázky:
  - zda pro domain join vynutit potvrzený email před přidáním do existující business organizace

## Navazující backlog `high`

- `AI memory endpoint skips project-level authorization checks`
- `Org join requests allow email spoofing to target any org`
- `Command injection via macOS docx conversion IPC handler`
- `Authenticated users can modify any subscription via RPC grants`
- `Public RLS policy exposes all short_urls entries`
- `Electron IPC exposes unrestricted filesystem access`
- `Short URL redirects allow arbitrary schemes causing stored XSS`
- `Ownerless project RLS exposes contract/financial data`
- `Projects RLS makes NULL-owner rows globally readable/editable`
- `Overly permissive RLS policies expose all subcontractors`

## Minimální gate před merge

- `npm run test:run -- tests/criticalSecurityMigrations.test.ts`
- `npm run test:run -- tests/complianceRlsPolicies.test.ts`
- `npm run test:run -- tests/fsHandlers.test.ts`
- `npm run test:run -- tests/securityHeaders.test.ts`
- `npm run check:boundaries`
- `npm run check:legacy-structure`
- `npm run test:run`
