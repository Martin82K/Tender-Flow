# Bezpečnostní zpráva – Tender Flow CRM

Datum auditu: 20. 3. 2026
Scope: web (React + Vite), desktop (Electron), Node server, Supabase DB + Edge Functions

## Executive Summary
Aplikace má solidní základ v oblasti řízení přístupu na data (RLS v Supabase, oddělené service-role operace, nová hardening migrace platform admin práv), šifrování citlivého obsahu smluv (AES-GCM) a několika obranných mechanismech v desktop vrstvě (contextIsolation, URL allowlist, IPC proxy allowlist).

Současně jsou přítomná kritická a vysoká rizika, hlavně v desktop IPC shell vrstvě (možná command injection), v oslabení Electron sandboxu a v příliš otevřených CORS/embedding hlavičkách. Web klient ukládá session tokeny do browser storage (trade-off běžný pro SPA, ale zvyšuje dopad případného XSS).

## Kde se data ukládají
- Primární aplikační data: Supabase Postgres (`public` schema, RLS politiky v migracích), např. projekty, organizace, role, audit, billing.
- Autentizace: Supabase Auth session, klientský storage klíč `crm-auth-token` ve webu (`services/supabase.ts:53`, `services/supabase.ts:296-353`, `services/supabase.ts:529-545`).
- Citlivé markdown verze smluv: DB tabulka `contract_markdown_versions` se šifrovaným obsahem `content_md_ciphertext`, hash integritou a verzí klíče (`supabase/functions/contract-markdown-secure/index.ts:29-33`, `supabase/functions/contract-markdown-secure/index.ts:327-340`).
- Desktop lokální tajemství/session credentials: `secure-storage.json` v `userData`, šifrování přes Electron `safeStorage`, fallback bez šifrování pokud není dostupné (`desktop/main/services/secureStorage.ts:15-17`, `desktop/main/services/secureStorage.ts:31-57`, `desktop/main/services/secureStorage.ts:80-82`).
- Dočasné soubory: OS temp adresář při otevření/exportu (`desktop/main/ipc/handlers.ts:335-365`, `desktop/main/ipc/handlers.ts:387-390`).
- Desktop cache: explicitně v temp (`desktop/main/main.ts:42-53`).

## Jak jsou data chráněna (pozitiva)
- RLS a omezení interních billing tabulek pouze na `service_role` (`supabase/migrations/20260310223000_lock_billing_internal_tables_rls.sql:5-29`).
- Nová platform admin autorita oddělená do `platform_admins` + SECURITY DEFINER helpery (`supabase/migrations/20260320150000_harden_platform_admin_and_org_security.sql:10-31`, `:48-117`) a odstranění legacy email fallbacku (`supabase/migrations/20260320153000_finalize_platform_admin_phase2.sql:5-15`).
- Šifrování markdown obsahu AES-GCM + SHA-256 integrita (`supabase/functions/_shared/crypto.ts:25-56`, `supabase/functions/contract-markdown-secure/index.ts:327-340`).
- Desktop renderer má `contextIsolation: true` a `nodeIntegration: false` (`desktop/main/main.ts:95-96`).
- Externí URL jsou allowlistované (`desktop/main/main.ts:19-39`, `desktop/main/ipc/handlers.ts:32-73`, `desktop/main/ipc/handlers.ts:321-327`).
- Proxy z rendereru do main procesu omezuje cíle na whitelist hostů/suffixů (`desktop/main/ipc/handlers.ts:43-73`, `desktop/main/ipc/modules/netHandlers.ts:24-27`).
- Sanitizace logů (redakce tokenů, JWT, emailů) (`shared/security/logSanitizer.ts:1-65`).
- XSS obrana u markdown přes DOMPurify (`shared/contracts/markdownRender.ts:9-27`).

## Nálezy

### Kritické
1. **[CRIT-01] Možná command injection v desktop IPC konverzi DOC -> DOCX**
- Lokalita: `desktop/main/ipc/handlers.ts:372-397`
- Evidence: příkaz pro `exec` skládá shell string s `inputPath`.
- Dopad: při kompromitaci rendereru nebo zneužití IPC volání může dojít ke spuštění libovolného shell payloadu.
- Doporučení: nahradit `exec` za `spawn`/`execFile` s argument array, harden validaci cesty a zakázat shell interpolaci.

### Vysoké
2. **[HIGH-01] Hlavní BrowserWindow má vypnutý Electron sandbox**
- Lokalita: `desktop/main/main.ts:97`
- Dopad: zvyšuje blast radius při kompromitaci rendereru.
- Doporučení: vrátit `sandbox: true`, případně oddělit problematické toky do izolovaného procesu/API.

3. **[HIGH-02] Session tokeny ve webu v localStorage/sessionStorage**
- Lokalita: `services/supabase.ts:296-353`, `services/platformAdapter.ts:481-516`
- Dopad: při XSS lze tokeny exfiltrovat; riziko převzetí session.
- Doporučení: preferovat HttpOnly cookie session (BFF pattern) nebo výrazně posílit CSP + anti-XSS + krátké lifetime tokenů.

4. **[HIGH-03] Produkční statické hlavičky jsou otevřené (`*`) pro frame ancestors i CORS**
- Lokalita: `public/_headers:2-4`
- Dopad: clickjacking a nechtěné cross-origin použití endpointů.
- Doporučení: nahradit explicitním allowlistem domén, odstranit `ALLOWALL` a `frame-ancestors *`.

### Střední
5. **[MED-01] Edge Functions mají globální CORS `*` jako shared default**
- Lokalita: `supabase/functions/_shared/cors.ts:1-6`
- Dopad: usnadňuje cross-origin zneužití u funkcí, které nemají důslednou authz kontrolu.
- Doporučení: zavést per-function allowlist originů podle typu endpointu.

6. **[MED-02] `send-email` validuje jen přítomnost Authorization headeru**
- Lokalita: `supabase/functions/send-email/index.ts:29-37`
- Dopad: při chybné gateway konfiguraci by endpoint mohl být zneužit pro spam/abuse.
- Doporučení: explicitně volat `auth.getUser()` (nebo `createAuthedUserClient`) a vynutit roli/limit.

7. **[MED-03] Fallback secure storage ukládá tajemství nešifrovaně**
- Lokalita: `desktop/main/services/secureStorage.ts:43-57`
- Dopad: na systémech bez `safeStorage` je at-rest ochrana slabá.
- Doporučení: fail-closed pro citlivé klíče nebo přidat alternativní šifrovací vrstvu.

8. **[MED-04] Server nastavuje jen úzkou sadu bezpečnostních hlaviček**
- Lokalita: `server/securityHeaders.js:57-60`
- Dopad: chybí `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` atd.
- Doporučení: rozšířit middleware o kompletní baseline hlaviček.

### Nízké / Informativní
9. **[LOW-01] V `supabase/config.toml` je minimum hesla 6 znaků**
- Lokalita: `supabase/config.toml:144`
- Poznámka: může být jen lokální/dev konfigurace; v produkci ověřit policy u hostovaného projektu.

10. **[LOW-02] Dev/provozní logy obsahují zbytečně detailní debug výpisy v preload/platform adapteru**
- Lokalita: `desktop/main/preload.ts:20-25`, `services/platformAdapter.ts:571-575`
- Dopad: informační únik provozních detailů.
- Doporučení: omezit verbose logy v production buildu.

## Přístupová bezpečnost (Access Control)
- DB vrstva: RLS + policy model je rozsáhle používán napříč tabulkami (viz migrace s `ENABLE ROW LEVEL SECURITY` a `CREATE POLICY`).
- Admin oprávnění: centralizováno přes `platform_admins` a `is_admin()` bez legacy fallbacku po migraci phase2.
- Funkce s vyššími právy: používají `service_role` klienta (`supabase/functions/_shared/supabase.ts:11-15`), což je správně pro interní operace, ale vyžaduje velmi striktní vstupní authz.
- Desktop IPC: část modulů má dobré allowlisty (URL/proxy), ale shell a filesystem kanály mají vyšší rizikový profil a potřebují další hardening.

## Stav testů
Spuštěné bezpečnostně relevantní testy: 8 souborů, 34 testů, vše prošlo.
- `tests/securityHeaders.test.ts`
- `tests/desktopCsp.test.ts`
- `tests/contractMarkdownSecurity.test.ts`
- `tests/inquiryService.security.test.ts`
- `tests/adminMfaService.test.ts`
- `tests/criticalSecurityMigrations.test.ts`
- `tests/highPrioritySecurityMigrations.test.ts`
- `tests/complianceRlsPolicies.test.ts`

## Prioritní doporučení (30 dní)
1. Opravit `shell:convertToDocx` (eliminovat `exec` + shell string).
2. Zpřísnit produkční hlavičky (`public/_headers`, `server/securityHeaders.js`).
3. Zapnout Electron sandbox nebo vytvořit bezpečný ekvivalent s omezenými capabilities.
4. Zpřísnit authz v `send-email` a zavést per-function CORS allowlist.
5. Přehodnotit web token storage model (BFF/HttpOnly cookies) pro snížení XSS dopadu.
