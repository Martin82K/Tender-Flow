# Next Steps: Ošetření citlivých klíčů a vícevrstvá ochrana

## Shrnutí
Ve workspace byl nalezen `.env.local` s citlivými klíči. Priorita je okamžitá rotace klíčů, odstranění klientských tajemství a přesun citlivých operací na server-side vrstvu (Supabase Edge Functions / backend). Cíl: žádný tajný klíč v klientovi, auditovatelné použití, minimální attack surface.

## Cíl
1. Zabránit úniku tajemství z klienta a sdíleného prostředí.
2. Zajistit, že produkční klíče jsou pouze na server-side.
3. Přidat kontrolní vrstvy: scan v CI, logování, rate limit, RLS/ACL.

## Veřejná rozhraní / kontrakty
1. Zrušit klientské použití `VITE_TINYURL_API_KEY` / `TINY_URL_API_KEY` v browser kódu.
2. Přidat server-side endpoint/Edge Function pro shortener (klient volá jen interní API).
3. AI klíče držet server-side; klient pouze posílá request na interní endpoint.

## Implementační plán
1. Incident response:
- Rotace všech klíčů nalezených v `.env.local`.
- Revokace starých klíčů u poskytovatelů.
- Ověřit audit logy (zneužití, IP, timeframe).

2. Repo hardening:
- Potvrdit `.env.local` v `.gitignore` (zachovat).
- Přidat `.env.example` bez reálných hodnot.
- Přidat pre-commit/CI secret scanning (gitleaks nebo equivalent).

3. Přesun tajemství mimo klienta:
- Refaktor `services/urlShortenerService.ts` na volání interní server-side funkce.
- Zachovat pattern jako u `services/emailService.ts` (server-side secret).
- UI nikdy nedostane raw API key.

4. AI secrets model:
- Klíče ukládat jen server-side (Supabase secrets/secure vault).
- Klient řeší jen oprávněné volání interního endpointu.
- Omezit scope klíčů na minimum (least privilege).

5. CI/CD a governance:
- GitHub Actions secrets pouze pro build/release.
- Žádné tajemství v release artefaktech, log masking zapnuto.
- Přidat kontrolu, že build failne při detekci secret leak patternu.

6. Dokumentace:
- Aktualizovat security/releasing docs:
- seznam required env vars podle prostředí,
- kdo spravuje rotaci,
- postup při incidentu (runbook).

## Testy a akceptace
1. Statické:
- `npm run test:run`
- `npm run check:boundaries`
- `npm run check:legacy-structure`
- `npm run desktop:compile`

2. Bezpečnostní scénáře:
- V klientském bundle není žádný tajný klíč.
- Shortener a AI flow fungují pouze přes server-side vrstvu.
- Neautorizovaný uživatel nedostane přístup k interním secret operacím.
- Secret scanner v CI zachytí testovací leak.

## Assumptions / defaulty
1. `.env.local` nebyl commitnut do Gitu, ale klíče bereme jako kompromitované a rotujeme.
2. Priorita je bezpečnost před rychlostí: nejdřív rotace, pak refaktor.
3. Všechny nové externí integrace půjdou přes server-side proxy vrstvu.
