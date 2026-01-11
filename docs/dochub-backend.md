# DocHub backend (Google Drive / OneDrive) – setup (end-to-end)

Tento dokument popisuje, jak dostat DocHub do stavu “funguje end‑to‑end”: přihlášení přes Google/Microsoft, ověření hlavní složky projektu, a otevírání složek pro VŘ + dodavatele (včetně automatického vytvoření chybějících složek).

## Co je v repu
- Edge Functions:
  - `supabase/functions/dochub-auth-url/index.ts` – vrátí OAuth URL (Google/Microsoft)
  - `supabase/functions/dochub-google-callback/index.ts` – callback + uložení tokenu
  - `supabase/functions/dochub-microsoft-callback/index.ts` – callback + uložení tokenu
  - `supabase/functions/dochub-google-picker-token/index.ts` – vrátí krátkodobý access token pro Google Picker (jen pro přihlášeného uživatele)
  - `supabase/functions/dochub-google-create-root/index.ts` – vytvoří novou složku v Google Drive a nastaví ji jako “Hlavní složka projektu”
  - `supabase/functions/dochub-resolve-root/index.ts` – ověří “Hlavní složku projektu” z vloženého URL a uloží `root_id/web_url`
  - `supabase/functions/dochub-get-link/index.ts` – vrací web URL pro DocHub složky (PD / VŘ / Dodavatel) a chybějící složky vytvoří
- DB tabulky:
  - `public.dochub_oauth_states` – krátkodobý OAuth `state`
  - `public.dochub_user_tokens` – šifrované tokeny (RLS bez policies → jen service role)
  - `public.dochub_project_folders` – cache itemId/webUrl pro složky

## Předpoklady
- Supabase projekt (cloud) – kvůli redirect URI (lokálně jde OAuth end‑to‑end jen přes veřejnou URL, např. ngrok).
- Supabase CLI.

## 1) Redirect URI (Supabase Functions)
Z `VITE_SUPABASE_URL` (např. `https://abcd1234.supabase.co`) vezmi `<project-ref>` = subdoménu (`abcd1234`).

Callbacky nastav přesně takto:
- Google: `https://<project-ref>.functions.supabase.co/dochub-google-callback`
- Microsoft: `https://<project-ref>.functions.supabase.co/dochub-microsoft-callback`

Pozor: Nepoužívej `https://<project-ref>.supabase.co/functions/v1/...` jako OAuth redirect URI (Google tam přesměruje bez hlaviček a Supabase gateway vrátí `401 Missing authorization header`).

Také je potřeba, aby callback edge funkce měly vypnuté ověřování JWT (OAuth provider neposílá `Authorization` header):
- Deploy přes CLI s `--no-verify-jwt`:
  - `supabase functions deploy dochub-google-callback --no-verify-jwt`
  - `supabase functions deploy dochub-microsoft-callback --no-verify-jwt`

Konkrétně pro tvůj projekt:
- `project-ref`: `vpvowigatikngnaflkyk`
- Google redirect: `https://vpvowigatikngnaflkyk.functions.supabase.co/dochub-google-callback`
- Microsoft redirect: `https://vpvowigatikngnaflkyk.functions.supabase.co/dochub-microsoft-callback`

## 2) Google Cloud Console (Google Drive)
1) Vytvoř projekt v Google Cloud
2) Zapni API:
   - **Google Drive API**
   - **Google Picker API**
3) OAuth consent screen (Internal/External dle potřeby)
4) Credentials → Create credentials → OAuth client ID → Web application
   - Authorized redirect URIs:
     - `https://<project-ref>.functions.supabase.co/dochub-google-callback`
   - Authorized JavaScript origins:
     - URL tvé aplikace (např. `https://crm.tvoje-domena.cz`)
     - (volitelně) `http://localhost:5173`

Získáš:
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`

Google Picker (frontend):
1) Credentials → Create credentials → API key
2) Restrict key:
   - Application restrictions: HTTP referrers
   - Allowed referrers: `http://localhost:5173/*` a `https://tenderflow.cz/*`
3) Ve frontendu nastav `VITE_GOOGLE_API_KEY`

## 3) Azure Portal (OneDrive / SharePoint)
1) Azure → App registrations → New registration
2) Authentication → Add a platform → Web
   - Redirect URIs:
     - `https://<project-ref>.functions.supabase.co/dochub-microsoft-callback`
3) Certificates & secrets → New client secret
4) API permissions (Microsoft Graph) – přidej:
   - `offline_access`
   - `User.Read`
   - `Files.ReadWrite`
   - `Sites.ReadWrite.All`
5) Grant admin consent (pokud vyžaduje)

Získáš:
- `MS_OAUTH_CLIENT_ID`
- `MS_OAUTH_CLIENT_SECRET`



## Desktop OAuth (Electron)
- OAuth client ID: Desktop app (Installed app).
- Use system browser + loopback redirect (no web callback).
- Frontend env: `VITE_GOOGLE_OAUTH_CLIENT_ID_DESKTOP`.
- Deploy function: `supabase functions deploy dochub-google-desktop-token`.
## 4) Supabase secrets (Edge Functions)
V Supabase nastav secrets:

- `SITE_URL` – URL frontend aplikace (např. `https://crm.tvoje-domena.cz`)
- `DOCHUB_TOKEN_ENCRYPTION_KEY` – base64 klíč o délce 32 bajtů (AES‑GCM)

Google:
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI` – `https://<project-ref>.functions.supabase.co/dochub-google-callback`

Microsoft:
- `MS_OAUTH_CLIENT_ID`
- `MS_OAUTH_CLIENT_SECRET`
- `MS_OAUTH_REDIRECT_URI` – `https://<project-ref>.functions.supabase.co/dochub-microsoft-callback`

Generování `DOCHUB_TOKEN_ENCRYPTION_KEY`:
- `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

## 5) Deploy migrací a funkcí
1) `supabase login`
2) `supabase link --project-ref <project-ref>`
3) `supabase db push`
4) Deploy functions:
   - `supabase functions deploy dochub-auth-url`
   - `supabase functions deploy dochub-google-callback`
   - `supabase functions deploy dochub-google-desktop-token`
   - `supabase functions deploy dochub-microsoft-callback`
   - `supabase functions deploy dochub-google-picker-token`
   - `supabase functions deploy dochub-google-create-root`
   - `supabase functions deploy dochub-resolve-root`
   - `supabase functions deploy dochub-get-link`
5) Nastav secrets (CLI):
   - `supabase secrets set SITE_URL=... DOCHUB_TOKEN_ENCRYPTION_KEY=... ...`

## 6) Flow v aplikaci (end-to-end)
1) Projekt → `Dokumenty` → `DocHub`
2) Vyber provider + režim → klikni `Připojit přes Google/Microsoft`
3) Google: klikni `Vybrat složku z Google Drive` (Picker) nebo `Vytvořit` (vytvoří novou složku) → uloží `rootId/rootWebUrl`
4) OneDrive: vlož share link do pole “Hlavní složka projektu” + `Ověřit odkaz (backend)`
5) V detailu VŘ klikni `DocHub` – otevře (a případně vytvoří) složku `.../Výběrová řízení/<VŘ>/Poptávky`
6) U dodavatele klikni ikonu složky – otevře (a případně vytvoří) složku dodavatele v rámci poptávek

## Bezpečnost
Tokeny se ukládají šifrovaně do `public.dochub_user_tokens`. Tabulka má RLS bez policies → běžný uživatel ji neuvidí; edge funkce používají service role.

## Co je další krok
- OneDrive/SharePoint picker (ekvivalent Google Pickeru).
- Podsložky `Email` / `Cenová nabídka` + ukládání emailu/CN do Drive/OneDrive.


