# GoPay Integration — Audit & Implementation Log

**Datum auditu:** 2026-04-27
**Branch:** main
**Auditor:** Claude (Opus 4.7) na žádost Martina

## 1. Cíl

Uživatel požádal o návrh integrace GoPay platební brány. Při průzkumu kódu jsem zjistil, že **základní integrace už existuje a běží** (Supabase Edge Functions + `services/billingService.ts`). Auditem proti oficiální dokumentaci (https://doc.gopay.cz/, https://help.gopay.com/cs/tema/integrace-platebni-brany) hledám díry, bezpečnostní problémy a chybějící funkcionalitu.

## 2. Metodika

1. Načíst kompletní existující GoPay kód (Edge Functions, shared helpery, frontend service, testy).
2. Stáhnout oficiální postup integrace přes WebFetch.
3. Mapovat existující implementaci na požadované kroky GoPay (`✅ existuje` / `⚠️ částečně` / `❌ chybí`).
4. Identifikovat **bezpečnostní díry** (priorita podle CLAUDE.md – security-first).
5. Vytvořit punch list oprav s prioritami.
6. Před úpravami se zeptat uživatele na nejednoznačné body.
7. Implementovat → psát testy → spustit `npm test` + `npm run check:boundaries`.

## 3. Mapování postupu GoPay → Existující kód

| Krok GoPay | Stav | Poznámka |
|---|---|---|
| 1. ClientID, ClientSecret, GoID | ✅ | env: `GOPAY_CLIENT_ID`, `GOPAY_CLIENT_SECRET`, `GOPAY_GOID` |
| 2. Sandbox vs Produkce | ✅ | env `GOPAY_API_URL` (default sandbox) |
| 3. OAuth2 token (`/oauth2/token`, scope `payment-all`) | ✅ | `getGopayAccessToken()` v `_shared/gopayBilling.ts`, cache s 2-min bufferem, 401 retry |
| 4. Vytvoření platby (`/payments/payment`) | ✅ | `gopay-create-payment`, `gopay-create-org-payment` |
| 4a. Redirect varianta (`gw_url`) | ✅ | Frontend dostane `paymentUrl` a redirectne |
| 4b. Inline varianta (`embed.js`) | ❌ | Není implementováno – jen redirect |
| 5. Webhook (`notification_url`) | ✅ | `gopay-webhook`, `gopay-org-webhook` |
| 6. HMAC signature ověření | ⚠️ | GoPay **nemá HMAC podpis na notifikaci** – ověřuje se voláním zpět na API (`getPaymentStatus`). Toto je oficiálně doporučený postup a je správně implementováno. |
| 7. Recurring (`recurrence` objekt) | ✅ | `recurrence_cycle: MONTH`, `recurrence_period: 1` (monthly) nebo `12` (yearly) |
| 7a. Storno opakované platby (`/void-recurrence`) | ✅ | `voidRecurrence()`, `gopay-cancel-subscription` |
| 7b. Manuální vytvoření recurrence (`/create-recurrence`) | ✅ | `createRecurrence()` exportováno, ale nikde se nevolá – GoPay si recurrence řídí sám |
| 8. Stavový cyklus (CREATED, PAID, CANCELED, REFUNDED, AUTHORIZED) | ✅ | Webhook handler ošetřuje všechny stavy |
| 9. Idempotence | ⚠️ | Webhook idempotence přes tabulku `billing_webhook_events` (unique `event_id = gopay-{paymentId}-{state}`). `order_number` ale obsahuje `Date.now()` → dvojklik na frontendu vytvoří dvě různé platby. |
| 10. HTTPS, ClientSecret server-side | ✅ | Validace `validateAllowedRedirectUrl`, secret nikdy v repo |
| 11. Refundy (`/refund`) | ⚠️ | `refundPayment()` exportováno, **žádná Edge Function ho nevolá** – chybí UI/admin endpoint |

## 4. Identifikované problémy

### 🔴 KRITICKÉ (bug nebo bezpečnost)

**B1. `subscription_started_at` se přepisuje při každé recurring platbě**
- Soubor: `supabase/functions/gopay-webhook/index.ts:36-38`
- Problém: Podmínka `if (status === "active" && !updateData.subscription_started_at)` kontroluje lokální `updateData` objekt (vždy false), ne DB record. Při každém PAID se přepíše datum prvního zaplacení na `now()`.
- Dopad: Ztráta historické informace „kdy se uživatel poprvé předplatil". Účetně/reportingově nesprávné.
- Oprava: Načíst současnou hodnotu z DB, nastavit jen pokud je `null`.

### 🟡 STŘEDNÍ (technický dluh, časem rozbije)

**B2. Hardcoded `recurrence_date_to: "2030-12-31"`**
- Soubor: `supabase/functions/_shared/gopayBilling.ts:215`
- Problém: Po roce 2030 přestane recurring fungovat (nebo začne hned, podle GoPay validace).
- Oprava: Vrátit dynamicky `now() + 10 let` ve formátu `yyyy-MM-dd`.

**B3. Mrtvý/buggy `getRecurrenceCycle`**
- Soubor: `supabase/functions/_shared/gopayBilling.ts:209-210`
- Problém: Návratový typ `"MONTH" | "MONTH"` (duplikát), funkce vždy vrací konstantu, nikde se nevolá.
- Oprava: Smazat – `recurrence_cycle: "MONTH"` se zadává inline.

**B4. Webhook nevaliduje `paymentId` jako numerický**
- Soubor: `supabase/functions/gopay-webhook/index.ts:166-170`, `gopay-org-webhook/index.ts:100`
- Problém: `paymentId` se bez kontroly posílá do `getPaymentStatus()` (GoPay API to odmítne) a do DB unique key. Není to přímá SQL injection (Supabase JS klient parametrizuje), ale chybí guard na rozumné formáty.
- Oprava: Validovat regex `^\d+$` před zpracováním.

**B5. `subscription_audit_log` má `old_tier: null`**
- Soubor: `gopay-webhook/index.ts:62`, `gopay-org-webhook/index.ts:75`
- Problém: Audit log neumí ukázat „z čeho na co" se změnilo, jen „na co".
- Oprava: Před `update` načíst `stripe_subscription_tier` z `user_profiles` a předat jako `old_tier`.

### 🟢 NICE-TO-HAVE (UX, rozšíření)

**N1. Inline gateway** – aktuálně jen redirect. GoPay JS embed by zlepšil UX (zákazník neopouští stránku).
**N2. Refund endpoint** – `refundPayment()` existuje, ale žádný admin UI/endpoint ho nevolá.
**N3. Renaming legacy sloupce `stripe_subscription_tier`** – DB schema z doby Stripe migrace, breaking change → samostatný PR.
**N4. Rozdíl `CANCELED` vs `REFUNDED`** – obojí mapuje na `subscription_status: "expired"`. Sémanticky jiné.
**N5. Order number resilience proti dvojkliku** – idempotentní UUID místo `Date.now()`.

## 5. Plán implementace

Tato relace pokryje **B1–B4**. B5 a N1–N5 nechám na další iteraci nebo na rozhodnutí uživatele.

| # | Úprava | Soubor | Test |
|---|---|---|---|
| 1 | Fix `subscription_started_at` (B1) | `gopay-webhook/index.ts` | nový test ve `tests/gopayWebhook.startedAt.test.ts` |
| 2 | Dynamický `getRecurrenceEndDate` (B2) | `_shared/gopayBilling.ts` | nový test ve `tests/gopayBilling.recurrence.test.ts` |
| 3 | Smazat `getRecurrenceCycle` (B3) | `_shared/gopayBilling.ts` | – |
| 4 | Validace `paymentId` (B4) | oba webhooky | unit test |

Po každé úpravě:
- `npm test -- <konkrétní test>`
- Na konci: `npm run test:run` (všechny) + `npm run check:boundaries`

## 6. Otázky na uživatele

Než začnu opravovat, potřebuji upřesnit několik bodů – posílám separátně přes AskUserQuestion.

## 7. Implementační deník (průběžně doplňováno)

### 2026-04-27 — Audit dokončen
- Načteny všechny `gopay-*` Edge Functions, `_shared/gopayBilling.ts`, frontend `billingService.ts`, existující testy `tests/billing*`.
- Stažen oficiální postup z help.gopay.com.
- Identifikováno 5 problémů (1 kritický bug, 4 středně-závažné).
- Čekám na odpovědi uživatele před začátkem oprav.

### 2026-04-27 — Odpovědi uživatele a rozšíření scope
- B1: zachovat původní `subscription_started_at` (load-before-update).
- B2: dynamicky `now() + 10 let`.
- N4 (cancelled vs refunded): zařadit s minimální variantou (bez DB migrace, využít existující CHECK constraint).
- N5 (idempotentní order_number): zařadit (UUID místo Date.now()).
- B5 (old_tier v audit log): zařadit.
- Pokračuju s implementací.

### 2026-04-27 — Implementace dokončena

**Provedené změny:**

| Soubor | Změna |
|---|---|
| `supabase/functions/_shared/gopayHelpers.ts` | **Nový soubor** – pure helpery bez Deno/Supabase závislostí (testovatelné z Vitest). |
| `supabase/functions/_shared/gopayBilling.ts` | Přesun pure helperů do `gopayHelpers.ts`, re-exporty pro zpětnou kompatibilitu. Smazán buggy `getRecurrenceCycle`. |
| `supabase/functions/gopay-create-payment/index.ts` | `order_number` přes `generateOrderNumber()` (UUID místo Date.now()). |
| `supabase/functions/gopay-create-org-payment/index.ts` | `order_number` přes `generateOrderNumber()`. |
| `supabase/functions/gopay-webhook/index.ts` | **Přepis** – B1 (preserve started_at), B5 (old_tier v audit), N4 (CANCELED soft-cancel vs REFUNDED immediate), B4 (paymentId validation), nový `PARTIALLY_REFUNDED` case. |
| `supabase/functions/gopay-org-webhook/index.ts` | B4 (paymentId validation přes `isValidPaymentId`). |
| `tests/gopayHelpers.test.ts` | **Nový soubor** – 39 unit testů pro všechny helpery. |

**Výsledky kontrol:**

| Kontrola | Výsledek |
|---|---|
| `npm run test:run -- tests/gopayHelpers.test.ts` | ✅ 39/39 |
| `npm run test:run` (full suite) | ✅ 816/816 v 175 souborech |
| `npm run check:boundaries` | ✅ Boundary check OK (486 souborů) |
| `npm run check:legacy-structure` | ✅ Legacy structure check OK (137 souborů) |

**Co zůstává jako follow-up (neopravené v této session):**

1. **Org webhook routing bug** (Task #15) – `gopay-create-org-payment` nastavuje `notification_url` na `gopay-webhook`, ale ten neumí org logiku. Plus `gopay-org-webhook` přijímá POST, GoPay ale posílá GET. Org payments po PAID **nedostanou subscription update**. Vyžaduje rozhodnutí: buď (a) sloučit org logiku do `gopay-webhook` s detekcí orgId v additional_params, nebo (b) parametrizovat `notification_url` a opravit `gopay-org-webhook` na GET handler.

2. **Inline gateway** (N1) – aktuálně jen redirect varianta. Pro lepší UX by se hodil GoPay JS embed. Rozšíření `billingService.createCheckoutSession` o flag `inline?: boolean`.

3. **Refund admin endpoint** (N2) – `refundPayment()` API client existuje, ale chybí Edge Function/UI pro refund.

4. **Plný idempotence-key flow pro create-payment** – aktuálně dvojklik na frontendu může vytvořit dvě platby (UUID je unique, ne idempotentní). Server-side dedup by vyžadoval pending_payment_id v DB a check proti GoPay status.

5. **DB rename `stripe_subscription_tier` → `subscription_tier`** (N3) – legacy z migrace ze Stripe. Breaking change → samostatný PR + migrace.

### 2026-04-27 — Ověření proti doc.gopay.com / cz
- WebFetch proti doc.gopay.cz/com selhal na cert chain → použit WebSearch a GitHub repo gopaycommunity/gopay-api-documentation jako alternativa.
- Potvrzeno: `recurrence_cycle ∈ {DAY, WEEK, MONTH, ON_DEMAND}`. Naše `MONTH` s `period: 1|12` je validní.
- Potvrzeno: `recurrence_date_to` musí být `YYYY-MM-DD`, > now, **< 2099-12-31**. Můj `now() + 10 let` se vejde minimálně do roku 2089.
- Potvrzeno: webhook = **HTTP GET** s `?id=<paymentId>`, žádné další info v těle, žádný HMAC podpis. Verifikace stavu jen přes `GET /payments/payment/{id}`. Naše implementace v `gopay-webhook` ✅.
- **Revize sémantiky CANCELED**: GoPay `CANCELED` = platba zamítnuta (3DS reject, bank decline, timeout). NE "user zrušil subscription". Proto:
  - CANCELED **bez** parent_id (initial payment): subscription nikdy nezačal → ignore (nepřepínat na 'expired', ponechat current state).
  - CANCELED **s** parent_id (recurring failed): subscription doběhne do period_end → status='cancelled' + cancel_at_period_end=true.
  - REFUNDED: peníze vráceny → status='expired', tier='free', expires=null (immediate).
- **Nový problém objevený**: `gopay-org-webhook/index.ts:91` vyžaduje `req.method === "POST"` a čte `body.id`. GoPay ale posílá HTTP GET s `?id=`. → Org webhook se z GoPay **nikdy** netriggeruje. Navíc `getNotificationUrl()` v `gopay-create-org-payment` vrací URL na `gopay-webhook` (user webhook), ne org. Takže org payments PAID stav nedostanou.
  - **Mitigation**: user webhook by měl detekovat orgId v `additional_params` a delegovat na org logiku. Nebo `getNotificationUrl()` přidat parametr a vrátit org URL pro org payments.
  - **Status**: zaznamenáno jako follow-up Task #15. V této session **neopravuji** – je to nad rámec auditu (vyžaduje změnu signature `getNotificationUrl()` a refaktor obou create-payment funkcí + org-webhook na GET).

---

*Tento dokument je živý – průběžně se doplňuje při implementaci.*
