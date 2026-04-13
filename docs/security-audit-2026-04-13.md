# Security Audit - Tender Flow
**Datum:** 2026-04-13  
**Autor:** Claude Code (automatizovany audit)

---

## KRITICKE nalezy

| # | Typ | Soubor | Popis |
|---|-----|--------|-------|
| 1 | **Auth bypass - Demo mod** | `context/AuthContext.tsx:169-182` | Kdokoli muze nastavit `demo_session` v localStorage a obejit prihlaseni. DEMO_USER se nastavi bez overeni. |
| 2 | **IPC bez autentifikace** | `desktop/main/ipc/handlers.ts` | 67 IPC handleru v Electronu nema zadnou kontrolu autentifikace. Kompromitovany renderer muze volat cokoliv - mazat credentials, pristupovat k souborum, spoustet OAuth flow. |
| 3 | **Biometric bypass** | `context/AuthContext.tsx:219-228` | Biometricka vyzva je ciste klientska, bez serveroveho overeni. Da se obejit. |

---

## VYSOKE riziko

| # | Typ | Soubor | Popis |
|---|-----|--------|-------|
| 4 | **Plaintext fallback** | `desktop/main/services/secureStorage.ts:54` | Pokud `safeStorage.isEncryptionAvailable()` vrati false, credentials se ukladaji v plaintextu. |
| 5 | **CSP prilis permisivni** | `desktop/main/services/csp.ts:6-12` | `'unsafe-inline'` v produkci, `'unsafe-eval'` v dev modu - otevira dvere XSS. |
| 6 | **XSS pres dangerouslySetInnerHTML** | `TemplateManager.tsx:491`, `ExtractionValidation.tsx:556`, `MarkdownDocumentPanel.tsx:609,617,654` | Vice komponent pouziva `dangerouslySetInnerHTML`. DOMPurify je pouzit, ale ne konzistentne. |
| 7 | **SVG XSS** | `public/subscriptions/convert.html:47` | SVG obsah se vklada pres `innerHTML` bez sanitizace - SVG muze obsahovat `<script>`. |
| 8 | **Wildcard CORS** | `vite.config.ts:13-15`, `supabase/functions/ai-proxy/index.ts:8` | `Access-Control-Allow-Origin: *` umoznuje jakemukoli webu posilat requesty vcetne auth tokenu. |
| 9 | **OAuth secret pres IPC** | `desktop/main/ipc/modules/oauthHandlers.ts:22-26` | Client secret se posila z renderer procesu pres IPC. |

---

## STREDNI riziko

| # | Typ | Soubor | Popis |
|---|-----|--------|-------|
| 10 | **Admin check jen na klientu** | `features/settings/AdminSettings.tsx:15` | Admin role se kontroluje pouze `user?.role === 'admin'` na frontendu. Chybi serverova validace. |
| 11 | **Slaba validace tokenu** | `context/AuthContext.tsx:104` | Token se validuje jen na delku >= 10 znaku, zadna kontrola podpisu. |
| 12 | **Flask /merge bez API klice** | `server_py/excel_unlock_api/app.py` | Endpoint `/unlock` ma API key validaci, ale `/merge` ne. |
| 13 | **Role v localStorage** | `services/authService.ts:94-109` | User role a subscription tier se cachuji v plaintextu v localStorage - daji se manipulovat. |
| 14 | **Password reset bez rate limitingu** | `supabase/functions/request-password-reset/` | Token se posila v plaintextu v URL emailu, zadny rate limit na generovani tokenu. |
| 15 | **Open redirect** | `features/organization/ui/OrgBillingTab.tsx:125` | `window.location.href = result.checkoutUrl` bez validace domeny. |

---

## POZITIVNI nalezy

- **SQL injection: NULOVY vyskyt** - vsechny Supabase dotazy jsou parametrizovane
- **RLS je dukladne implementovano** - 371+ security definer funkci, systematicke hardening migrace
- **Service role klic** je pouze server-side (edge functions), nikdy na klientu
- **Mass assignment ochrana** - explicitni whitelisty poli v update operacich
- **Electron sandbox** je zapnuty, `contextIsolation: true`, `nodeIntegration: false`
- **Path traversal ochrana** v `fsHandlers.ts` - `fs.realpath()` + `isPathInsideRoot()`
- **URL redirect validace** v URL shorteneru - whitelist protokolu
- **Sifrovani kontraktu** - AES-GCM + SHA256 integrity check
- **Subprocess bezpecny** - `spawn()` s array argumenty, ne shell injection
- **Zadne zranitelne balicky** - dompurify 3.3.1, electron 40.8.5, supabase-js 2.86.0 aktualni

---

## SQL Injection & datova vrstva - detailni analyza

### Parametrizovane dotazy
- Vsechny Supabase klient dotazy pouzivaji `.from()`, `.insert()`, `.update()`, `.delete()`, `.rpc()` s parametrizovanymi argumenty
- Priklad: `/services/projectService.ts:37-43` - Insert pouziva explicitni field mapping
- Priklad: `/infra/org-billing/orgSubscriptionRpc.ts:20` - RPC volani s pojmenovanymi parametry

### RLS politiky
- Hardening migrace:
  - `20260320170000_harden_org_join_and_subscription_rpc.sql` - Prevence email spoofingu, omezeni RPC grantu
  - `20260320150000_harden_platform_admin_and_org_security.sql` - Platform admin s explicitnimi kontrolami
  - `20260320190000_harden_short_urls_rls.sql` - Oprava verejne URL enumerace pres RLS
  - `20260320173000_harden_ownerless_sensitive_project_data_rls.sql` - Ochrana financnich dat
  - `20260413100000_harden_insert_notification.sql` - Validace autentifikovane role, prevence cross-user notifikaci

### Service-role separace
- `start_user_trial()` a `activate_subscription()` revokovany z authenticated, grantovany pouze service_role
- `SUPABASE_SERVICE_ROLE_KEY` nalezen pouze v `/supabase/functions/_shared/supabase.ts` (server-side)

### Vstupni validace v Edge Functions
- `/supabase/functions/mcp-create-bid/index.ts:19-25` - Validace `demandCategoryId` a `subcontractorId`
- `/supabase/functions/mcp-list-projects/index.ts:10-24` - Sanitizace vyhledavaciho vstupu
- `/supabase/functions/contract-markdown-secure/index.ts:84-94` - Type guards pro enum hodnoty

---

## Autentifikace & session - detailni analyza

### Demo mod (KRITICKE)
```typescript
// context/AuthContext.tsx:169-182
if (isDemoSession()) {
  const hasRealSession = !!window.localStorage.getItem('crm-auth-token');
  if (hasRealSession) {
    endDemoSession();
  } else {
    setUser(DEMO_USER);  // Nastavi uzivatele bez autentifikace!
    setIsLoading(false);
    return;
  }
}
```

### IPC handlery bez auth (KRITICKE)
- 67 ruznych IPC handleru bez zadne kontroly autentifikace
- `electronAPI.session.clearCredentials()` - smazani credentials
- `electronAPI.session.saveCredentials()` - ulozeni skodlivych tokenu
- `electronAPI.fs.*` - pristup k souborum

### SecureStorage plaintext fallback
```typescript
// desktop/main/services/secureStorage.ts:31-45
if (safeStorage.isEncryptionAvailable()) {
    // ... sifrovani
} else {
    return encryptedValue;  // PLAINTEXT FALLBACK!
}
```

### OAuth state validace
- `desktop/main/ipc/modules/oauthHandlers.ts:41-62` - State validace kontroluje exact match, ale nevaliduje vazbu na session
- Chybi CSRF token binding

### CORS v Supabase edge functions
```typescript
// supabase/functions/ai-proxy/index.ts:8
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",  // Jakykoli web muze pristupovat
};
```

---

## XSS, CSRF & injection - detailni analyza

### dangerouslySetInnerHTML pouziti
- `components/TemplateManager.tsx:491` - `sanitizeTemplateHtml()` s DOMPurify
- `components/projectLayoutComponents/contractsComponents/ExtractionValidation.tsx:556` - `rawTextHtml`
- `features/settings/OrganizationSettings.tsx:1003` - Email signature preview
- `features/organization/ui/OrgBrandingTab.tsx:429` - Signature preview
- `features/settings/ProfileSettings.tsx:530` - Email signature preview
- `shared/contracts/MarkdownDocumentPanel.tsx:609,617,654` - Markdown HTML

### SVG XSS v convert.html
```html
<!-- public/subscriptions/convert.html:47 -->
preview.innerHTML = svgText;  // SVG muze obsahovat <script> tagy
```

### CSP konfigurace
```typescript
// desktop/main/services/csp.ts:6-12
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",          // Povoli vsechny inline skripty
  ...(isDev ? ["'unsafe-eval'"] : []),  // eval() v dev modu
  'https://cdn.tailwindcss.com',
];
```

### Flask API problemy
- `server_py/excel_unlock_api/app.py` - MAX_CONTENT_LENGTH 150MB (prilis velke uploady)
- CORS wildcard `"*"`
- Zadny rate limiting
- Exception handling leakuje chybove detaily klientovi
- `/merge` endpoint nema API key validaci (na rozdil od `/unlock`)

### Email signature sanitizace
- `utils/templateUtils.ts:73-80` - DOMPurify s custom allowed tags
- `img` tag s `src` atributem povolen - tracking pixels
- `href` na `<a>` tagech by mohl byt `javascript:` protokol

---

## Doporucene priority oprav

### Okamzite (P0) — VYRESENO
1. ~~Zakazat demo mod v produkci / pridat kontrolu prostredi~~ ✅ isDemoSession() je runtime-only, localStorage manipulace nefunguje
2. ~~Pridat auth kontroly na IPC handlery v Electronu~~ ✅ requireAuth() na vsech IPC handlerech
3. ~~Opravit CSP - odstranit `unsafe-inline` a `unsafe-eval`~~ ✅ unsafe-inline odstraneno z production script-src, inline tailwind config extrahovan do externiho souboru

### Brzy (P1) — VYRESENO
4. ~~Zmenit wildcard CORS na konkretni origins~~ ✅ sdileny cors.ts s origin validaci, 35 edge functions migrovano, Flask + _headers + app.yaml opraveny
5. ~~Pridat API key validaci na Flask `/merge` endpoint~~ ✅ has_valid_api_key() pridano, error messages uz nelekuji detaily vyjimek
6. ~~Sanitizovat SVG v `convert.html`~~ ✅ innerHTML nahrazeno bezpecnym <img> s Blob URL
7. ~~Odstranit plaintext fallback v secureStorage~~ ✅ set() throwi SECURE_STORAGE_UNAVAILABLE, get() odmitne cist bez sifrovani

### Strednedoba (P2)
8. Serverova validace admin role (ne jen frontend check)
9. Rate limiting na password reset a token refresh
10. Validace redirect URL pred `window.location.href`
11. Posilitvalidaci tokenu (ne jen delka >= 10)
12. Sifrovani role/tier v localStorage nebo pouziti httpOnly cookies

---

## Celkove hodnoceni

**Datova vrstva (Supabase, RLS, SQL):** SILNA - zadne SQL injection vektory, dukladne RLS politiky  
**Electron bezpecnost:** DOBRA - auth na IPC, CSP zprisneno, plaintext fallback odstranen  
**XSS ochrana:** DOBRA - DOMPurify pouzit, SVG XSS opraveno, CSP zprisneno  
**Autentifikace:** DOBRA - demo mod bypass opraven (runtime-only), IPC auth pridano  
**API bezpecnost:** DOBRA - CORS omezeno na allowlist, API key na vsech endpointech; zbyva rate limiting  
