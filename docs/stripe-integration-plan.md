# Stripe Integration — Plán & Implementační Log

**Datum vytvoření:** 2026-04-27
**Branch:** main
**Autor:** Claude (Opus 4.7) na žádost Martina
**Status:** ✅ Fáze A + B + C + D + F dokončena (kód, testy, runbook hotové). Fáze E (manuální E2E ve Stripe test módu) čeká na Stripe účet + naplnění env varů + `supabase db push` — kompletní checklist je v `docs/stripe-setup.md`.

> **Tento dokument je self-contained.** Obsahuje vše potřebné pro pokračování implementace bez závislosti na konverzaci, ve které vznikl. Pokud Claude pokračuje po `/clear`, stačí načíst tento dokument + `docs/gopay-integration-audit.md` + `CLAUDE.md`.

---

## 1. Cíl a kontext

**Cíl:** Přidat Stripe jako **paralelní platební bránu** vedle existující GoPay integrace. Brány běží **separátně** — žádný společný abstraktní backend, jen tenká abstrakce na frontendu.

**Motivace uživatele (Martin):**
> *„V projektu mám nejvíc připravenou jednu platební bránu GoPay, ale chtěl bych mít možnost přepnout třeba i na druhou platební bránu, třeba Stripe. ... Stripe bude separátně, případně odejdu od GoPay."*

**Klíčová architekturní rozhodnutí (auto mode, učiněna bez další konzultace):**

| # | Rozhodnutí | Odůvodnění |
|---|---|---|
| AR1 | **Globální přepínač** přes env var `VITE_BILLING_PROVIDER` (`gopay` \| `stripe`), default `gopay`. Žádný per-user/per-org switch v UI. | Nejjednodušší přepnutí, žádný UX nárok. Uživatel nepřechází na "multi-tenant", chce mít volbu. |
| AR2 | **Stripe Checkout Sessions + Subscription mode** (ne Payment Links, ne Custom Flow). | Standard, hostovaný UX, minimum kódu, vestavěné 3DS, customer portal. |
| AR3 | **Volání Stripe API přes `fetch`**, ne přes `https://esm.sh/stripe`. | Žádná Deno SDK závislost, kontrola velikosti bundle, snadnější testování. |
| AR4 | **Price IDs v env vars** — uživatel vytvoří produkty/ceny v Stripe Dashboardu, ID nakopíruje do env. | Stripe API umožňuje vytvářet ceny dynamicky, ale to ztěžuje audit. Statické ID = explicit. |
| AR5 | **Org checkout = subscription quantity = seats** (vestavěná Stripe funkcionalita). | Stripe to umí nativně, žádný custom seat tracking nutný. |
| AR6 | **Webhook ověření přes HMAC** (header `Stripe-Signature` + `STRIPE_WEBHOOK_SECRET`). | Bezpečnost (security-first dle CLAUDE.md). Stripe nemá GoPay-style "callback API verify" — výhradně HMAC. |
| AR7 | **Sdílené DB sloupce** (`billing_subscription_id`, `billing_customer_id`, `billing_provider`). Stripe Customer ID → `billing_customer_id`, Stripe Subscription ID → `billing_subscription_id`. | DB už multi-provider připravená (migrace 20260412000000). |
| AR8 | **Enterprise tier nemá self-checkout** v žádné bráně (custom pricing). Admin tier nikdy. | Kopíruje GoPay chování. |

---

## 2. Současný stav (ke dni 2026-04-27)

### 2.1 GoPay integrace — kompletní mapa

**8 edge funkcí** v `supabase/functions/`:

| Funkce | Úroveň | Akce | Hlavní DB zápisy |
|---|---|---|---|
| `gopay-create-payment` | user | Vytvoří checkout | `user_profiles.billing_subscription_id`, `billing_provider` |
| `gopay-cancel-subscription` | user | Zruší recurring | `user_profiles.subscription_cancel_at_period_end`, audit_log |
| `gopay-sync-subscription` | user | Force sync z GoPay | `user_profiles.subscription_*`, audit_log |
| `gopay-webhook` | user | Webhook (PAID, CANCELED, REFUNDED, …) | `user_profiles.subscription_*`, `billing_webhook_events`, audit_log |
| `gopay-create-org-payment` | org | Vytvoří org checkout (per-seat) | `organizations.billing_customer_id` |
| `gopay-cancel-org-subscription` | org | Zruší org recurring | `organizations.subscription_status`, audit_log |
| `gopay-sync-org-subscription` | org | Force sync org | `organizations.subscription_tier`, `subscription_status`, `max_seats` |
| `gopay-org-webhook` | org | Webhook pro org | `organizations.subscription_*`, `org_billing_history`, audit_log |

**Sdílené utility:** `supabase/functions/_shared/gopayBilling.ts` (API client) + `_shared/gopayHelpers.ts` (pure helpery, testovatelné).

### 2.2 Frontend volá GoPay přímo

- `services/billingService.ts` → `invokeAuthedFunction('gopay-create-payment', …)` (user-level)
- `features/organization/api/orgBillingActions.ts` → `invokeAuthedFunction('gopay-create-org-payment', …)` (org-level)
- **Žádná provider abstrakce neexistuje** — Stripe ji bude muset zavést.

### 2.3 DB schéma (relevantní pro multi-provider)

**`user_profiles`:**
- `billing_provider` TEXT CHECK IN (`'stripe'`, `'gopay'`, `'paddle'`, `'manual'`) — **už podporuje Stripe** (migrace 20260412000000)
- `billing_customer_id` TEXT — Stripe Customer ID
- `billing_subscription_id` TEXT — Stripe Subscription ID
- `subscription_status`, `subscription_tier` (alias `stripe_subscription_tier`), `subscription_started_at`, `subscription_expires_at`, `subscription_cancel_at_period_end`, `billing_period`, `payment_method_last4`, `payment_method_brand`

**`organizations`:**
- `billing_customer_id`, `subscription_tier`, `subscription_status`, `billing_period`, `max_seats`, `expires_at`

**`subscription_audit_log.change_type` CHECK** (migrace 20260124140000) obsahuje:
- ✅ `stripe_webhook` (legacy, dříve používaný)
- ❌ `stripe_cancel_recurrence`, `stripe_org_webhook`, `stripe_org_cancel_recurrence`, `stripe_sync` (chybí, je třeba přidat)

**`billing_webhook_events`:** event_id (PK), event_type, status, source TEXT DEFAULT 'stripe', payload_summary, error_message — **multi-source ready**.

### 2.4 Pricing (z `services/billingService.ts`)

| Tier | Monthly (CZK halíře) | Yearly (CZK halíře) | Self-checkout? |
|---|---|---|---|
| free | 0 | 0 | – |
| starter | 39900 (399 Kč) | 383040 (3830 Kč, 20% sleva) | ✅ |
| pro | 49900 (499 Kč) | 479000 (4790 Kč, 20% sleva) | ✅ |
| enterprise | – (na míru) | – | ❌ (mailto) |
| admin | – | – | ❌ |

---

## 3. Mapování GoPay → Stripe

| GoPay | Stripe | Poznámka |
|---|---|---|
| OAuth2 token (`/oauth2/token`) | Static Secret Key (`sk_live_…`) | Stripe používá API key v header, žádný OAuth |
| Payment object | Checkout Session + Subscription + Customer | Stripe rozdělil koncepty |
| `order_number` (idempotence) | `idempotency_key` HTTP header | Stripe nativně podporuje idempotency |
| `recurrence_cycle: MONTH, period: 1` | `interval: month, interval_count: 1` | V Price objektu, ne v subscription |
| `additional_params: [{name, value}]` | `metadata: {key: value}` | Stripe používá flat object |
| Webhook GET `?id=…` + verify přes API call | Webhook POST + HMAC `Stripe-Signature` | Naprosto odlišné! |
| `voidRecurrence(paymentId)` | `subscriptions.update(cancel_at_period_end: true)` | Stripe nemá "void", má cancel_at_period_end |
| `gw_url` (redirect) | `Session.url` (redirect) | Obojí redirectuje na hostovaný checkout |

---

## 4. Architektura cílového stavu

### 4.1 Edge funkce — 8 nových (mirror GoPay)

```
supabase/functions/
├── stripe-create-payment/         # user checkout
├── stripe-webhook/                # user webhook (HMAC)
├── stripe-cancel-subscription/    # user cancel
├── stripe-sync-subscription/      # user force sync
├── stripe-create-org-payment/     # org checkout (quantity = seats)
├── stripe-org-webhook/            # org webhook
├── stripe-cancel-org-subscription/
└── stripe-sync-org-subscription/
```

### 4.2 Sdílené utility

```
supabase/functions/_shared/
├── stripeBilling.ts               # API client (fetch wrapper, retry, error map)
└── stripeHelpers.ts               # pure helpery (testovatelné z Vitest)
```

### 4.3 Frontend abstrakce

```
services/
├── billingService.ts              # zachovat, ale routovat přes paymentProviderService
├── paymentProviderService.ts      # NEW — provider router
└── functionsClient.ts             # beze změny

features/organization/api/
└── orgBillingActions.ts           # routovat přes paymentProviderService
```

**Provider routing logika:**

```ts
// services/paymentProviderService.ts (zjednodušeně)
const provider = import.meta.env.VITE_BILLING_PROVIDER || 'gopay';

export const paymentProvider = {
  createCheckoutSession: (req) =>
    provider === 'stripe'
      ? invokeAuthedFunction('stripe-create-payment', { body: req })
      : invokeAuthedFunction('gopay-create-payment', { body: req }),
  // ... cancelRecurrence, syncSubscription
};
```

### 4.4 DB migrace

Jediná migrace: rozšíření CHECK constraintu na `subscription_audit_log.change_type` o 4 nové stripe-specifické hodnoty:
- `stripe_cancel_recurrence`
- `stripe_org_webhook`
- `stripe_org_cancel_recurrence`
- `stripe_sync` (případně `stripe_manual_sync`)

Jiná schema změna není potřeba — vše ostatní je multi-provider ready.

---

## 5. Env vars (kompletní seznam)

### 5.1 Server-side (Supabase Edge Functions)

| Env var | Příklad | Účel |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` / `sk_live_…` | API key (Bearer auth) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | HMAC ověření user webhooků |
| `STRIPE_ORG_WEBHOOK_SECRET` | `whsec_…` | HMAC ověření org webhooků (samostatný endpoint = samostatný secret) |
| `STRIPE_API_URL` | `https://api.stripe.com/v1` (default) | Pro test override |
| `STRIPE_API_VERSION` | `2026-04-22.dahlia` | Stripe API version (zachytit v request header) |
| `STRIPE_PRICE_ID_STARTER_MONTHLY` | `price_1Q…` | Price ID per-seat starter monthly |
| `STRIPE_PRICE_ID_STARTER_YEARLY` | `price_1Q…` | Price ID per-seat starter yearly |
| `STRIPE_PRICE_ID_PRO_MONTHLY` | `price_1Q…` | Price ID per-seat pro monthly |
| `STRIPE_PRICE_ID_PRO_YEARLY` | `price_1Q…` | Price ID per-seat pro yearly |
| `SITE_URL` | (existuje) | Allowlist pro redirect URLs |
| `ALLOWED_CHECKOUT_ORIGINS` | (existuje) | Allowlist pro redirect URLs |

> **Poznámka k Price IDs:** uživatel musí v Stripe Dashboardu vytvořit:
> - Produkt **Starter** s 2 cenami (`Recurring monthly` 399 Kč, `Recurring yearly` 3830 Kč)
> - Produkt **Pro** s 2 cenami (`Recurring monthly` 499 Kč, `Recurring yearly` 4790 Kč)
> - Pro org variant: stejné ceny, jen quantity = seats (nesmí mít `tiered pricing` — flat per-seat).

### 5.2 Client-side (Vite)

| Env var | Hodnota | Účel |
|---|---|---|
| `VITE_BILLING_PROVIDER` | `gopay` (default) \| `stripe` | Globální přepínač |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | (existuje) | – |

---

## 6. Plán implementace (fáze)

> **Pravidla pro každou fázi (z CLAUDE.md, security-first):**
> - Po každé fázi spustit relevantní testy.
> - Na konci celé implementace `npm run test:run` + `npm run check:boundaries` + `npm run check:legacy-structure`.
> - Žádné nové soubory v legacy frozen adresářích (`components/`, `hooks/`, `services/`, `context/`, `utils/`) **kromě** `services/paymentProviderService.ts` — ten musí být v allowlistu `config/legacy-freeze.json` (nutno přidat).

### Fáze A — Foundation (sdílené utility + DB)

1. **A1** — `_shared/stripeHelpers.ts` (pure helpery)
   - `mapStripeSubscriptionStatusToInternal(stripeStatus): SubscriptionStatus`
   - `getStripePriceId(tier, billingPeriod): string` (čte z env)
   - `parseStripeMetadata(metadata): { userId?, orgId?, tier?, billingPeriod?, seats? }`
   - `validateStripeId(id, prefix): boolean` (`cus_`, `sub_`, `cs_`, `evt_`)
   - `calculateStripeAmount(tier, billingPeriod, quantity): number`
2. **A2** — `tests/stripeHelpers.test.ts` (Vitest, pokrýt všechny helpery)
3. **A3** — `_shared/stripeBilling.ts` (API client)
   - `stripeFetch<T>(method, path, body?, idempotencyKey?): Promise<T>` — formurlencoded body, Bearer auth, retry 401, 429 backoff
   - `verifyStripeWebhookSignature(payload, signatureHeader, secret): { valid: boolean, event?: StripeEvent }` — implementace HMAC SHA-256 přes Web Crypto API (Deno native)
   - Wrappery: `createCheckoutSession`, `retrieveSubscription`, `retrieveCustomer`, `cancelSubscriptionAtPeriodEnd`, `retrieveCheckoutSession`
4. **A4** — DB migrace `supabase/migrations/{timestamp}_stripe_audit_change_types.sql` — rozšíření CHECK constraintu

### Fáze B — User-level edge funkce

5. **B1** — `stripe-create-payment` — Checkout Session, mode `subscription`, line_items s price_id, customer_email, metadata, allow_promotion_codes
6. **B2** — `stripe-webhook` — HMAC verify, idempotence přes `billing_webhook_events`, eventy:
   - `checkout.session.completed` → uložit customer_id + subscription_id, set tier, status='active'
   - `customer.subscription.updated` → sync expires_at, cancel_at_period_end
   - `customer.subscription.deleted` → status='expired', tier='free'
   - `invoice.payment_succeeded` → renewal, recalculate expires_at
   - `invoice.payment_failed` → status='past_due'
7. **B3** — `stripe-cancel-subscription` — `subscriptions.update(cancel_at_period_end: true)`, audit log
8. **B4** — `stripe-sync-subscription` — retrieve subscription + customer, update user_profiles, audit log

### Fáze C — Org-level edge funkce

9. **C1** — `stripe-create-org-payment` — Checkout Session s `quantity: seats`, metadata.orgId
10. **C2** — `stripe-org-webhook` — pokud `metadata.orgId` přítomný, route na org logiku, zápis do `organizations` + `org_billing_history`
11. **C3** — `stripe-cancel-org-subscription` — analogicky B3
12. **C4** — `stripe-sync-org-subscription` — analogicky B4

### Fáze D — Frontend

13. **D1** — `services/paymentProviderService.ts` (přidat do legacy allowlist)
14. **D2** — Refaktor `billingService.ts` — volání přes paymentProvider
15. **D3** — Refaktor `features/organization/api/orgBillingActions.ts` — analogicky

### Fáze E — Validace

16. **E1** — `npm run test:run`
17. **E2** — `npm run check:boundaries`
18. **E3** — `npm run check:legacy-structure`
19. **E4** — Manuální E2E v Stripe test mode (s test card `4242 4242 4242 4242`)

### Fáze F — Dokumentace

20. **F1** — Doplnit do tohoto dokumentu **Implementační deník** s čísly testů a výsledků.
21. **F2** — README/setup pokyny pro env vars (kde je vzít v Stripe Dashboardu).

---

## 7. Bezpečnostní úvahy (CLAUDE.md: security-first)

| Riziko | Mitigace |
|---|---|
| **Webhook spoofing** (cizí POST tváří se jako Stripe) | HMAC ověření přes `STRIPE_WEBHOOK_SECRET`, constant-time porovnání |
| **Replay attack** webhooku | Idempotence přes `billing_webhook_events.event_id = stripe-{evt_…}`, plus kontrola `evt.created` ne starší než 5 min |
| **Open redirect** v `success_url`/`cancel_url` | Reuse existující `validateAllowedRedirectUrl` z `_shared/gopayBilling.ts` (vytáhnout do společného `_shared/redirectValidation.ts`) |
| **Stripe Secret Key v repo** | `STRIPE_SECRET_KEY` jen v Supabase Edge Functions env, nikdy ve VITE_, nikdy v Git |
| **Idempotence dvojkliku frontendu** | Stripe `Idempotency-Key` HTTP header s UUID generovaným per-checkout-call |
| **PII v audit_log** | Logovat jen `customer_id`, `subscription_id`, ne email/jména |
| **Tenant isolation** | `metadata.orgId` ověřit proti DB (user musí být member orgu) — stejně jako gopay-create-org-payment |
| **TOCTOU race u cancel** | Stripe to řeší serverside (cancel_at_period_end je atomic) |
| **Webhook DoS** | Supabase rate limiting + early HMAC reject (rychlý fail) |

---

## 8. Otevřené otázky (pro uživatele PŘED dalším spuštěním)

1. **Stripe účet existuje?** Pro implementaci nepotřeba (testy nejsou E2E proti reálnému Stripe), ale pro spuštění ano. Tedy: kdy mám stávat E2E test (Fáze E4)? Můžeš poskytnout test mode keys, nebo mám předat finální checklist a E4 si projedeš sám?
2. **Customer Portal?** Stripe nabízí hostovaný self-service portal (uživatel si tam mění platební kartu, vidí faktury). GoPay tohle nemá. Mám přidat odkaz "Spravovat fakturaci" v UI který otevře Stripe portal? *(Nice-to-have, mohu nechat na další iteraci.)*
3. **Trial?** GoPay nepodporuje free trial nativně, dnes řešeno přes `trial_ends_at` v DB. Stripe trial podporuje (`trial_period_days` v Checkout Session). Mám trial řešit přes Stripe (čistší), nebo zachovat DB-driven (konzistence s GoPay)? *(Default: zachovat DB-driven, jednodušší.)*
4. **Faktury z Stripe?** Stripe automaticky generuje faktury (PDF). GoPay také, ale Tender Flow je nikam neukládá. Mám aktivovat Stripe automatickou fakturaci? *(Default: ano, aktivuje se v Dashboardu, žádný kód.)*
5. **CZK podpora.** Stripe podporuje CZK pro EU účty. Ověř, že tvůj Stripe účet má `cz` business region nebo aspoň podporuje CZK currency. Pokud ne, je třeba zvolit USD/EUR a přepočítat ceník.

> **Auto mode bez konzultace:** beru defaults (3=DB-driven trial, 4=Stripe auto-fakturace, 1=poskytnu finální checklist a uživatel projede E4 sám). Otázky 2 a 5 nejsou blokery — implementace probíhá s předpokladem CZK + bez customer portalu (lze přidat později).

---

## 9. Implementační deník

> *Deník vyplňuji průběžně — datum, fáze, soubory, výsledky testů.*

### 2026-04-27 — Plán dokončen
- Mapování GoPay flow kompletní (8 edge funkcí, DB schéma, frontend volání).
- Architektura Stripe integrace navržena (8 edge funkcí, sdílené utility, frontend provider abstrakce).
- Klíčová rozhodnutí AR1–AR8 učiněna v auto módu.
- Dokument hotov, čeká se na pokračování implementace.

### 2026-04-27 — Fáze A dokončena
**A1 — `_shared/stripeHelpers.ts` (pure helpery)**
- `calculateStripeAmount(tier, period, quantity)` — částka v haléřích × seats (mirror gopay ceník)
- `getStripePlanLabel(tier, period)` — lokalizovaná popiska plánu
- `getStripePriceId(tier, period, envGetter?)` — mapování → env var (`STRIPE_PRICE_ID_*`); validuje `price_…` prefix; `enterprise` vždy `null` (žádný self-checkout)
- `mapStripeSubscriptionStatusToInternal(stripeStatus)` — pokrývá všech 8 Stripe statusů (`active`, `trialing`, `past_due`, `canceled`, `unpaid`, `incomplete`, `incomplete_expired`, `paused`); neznámý status → `expired` (defenzivní default)
- `validateStripeId(value, kind)` — kontroluje prefix (`cus_`, `sub_`, `cs_`, `evt_`, `price_`, `in_`, `pi_`), max 255 znaků, alfanumerika + underscore (test/live module IDs)
- `parseStripeMetadata(metadata)` — bezpečný parser pro `userId`, `orgId`, `tier`, `billingPeriod`, `seats`; ignoruje neznámé/nevalidní hodnoty
- `calculateExpiresAtFromPeriod(period, now)` + `stripePeriodEndToDate(unixSeconds)` — fallback pro fixtures, převod Stripe period_end

**A2 — `tests/stripeHelpers.test.ts` (Vitest)**
- 55 testů, pokrývají všechny helpery výše. **Všech 55 prošlo.**

**A3 — `_shared/stripeBilling.ts` (Deno API client)**
- `stripeFetch<T>(method, path, body?, idempotencyKey?)` — form-urlencoded body (Stripe-style nested params přes `stripeStringify`), Bearer auth, retry pro 429/5xx s exponenciálním backoff (max 3 pokusy, respektuje `Retry-After` header), `Stripe-Version` header
- `verifyStripeWebhookSignature(rawBody, header, secret, toleranceSeconds=300, nowSeconds?)` — HMAC SHA-256 přes Web Crypto API, parse `t=…,v1=…,v0=…` formátu, constant-time porovnání, kontrola tolerance (5 min)
- Wrappery: `createCheckoutSession`, `retrieveCheckoutSession`, `retrieveSubscription`, `cancelSubscriptionAtPeriodEnd`, `retrieveCustomer`
- `validateAllowedRedirectUrl` (port z `gopayBilling.ts` — sdílí allowlist přes `SITE_URL` + `ALLOWED_CHECKOUT_ORIGINS`)
- `getStripeUserWebhookUrl()` / `getStripeOrgWebhookUrl()` — Supabase URL builder pro webhook endpointy
- `buildLineItems` helper, re-export `Tier` typu

**A4 — `supabase/migrations/20260427120000_stripe_audit_change_types.sql`**
- DROP & re-CREATE `subscription_audit_log_change_type_check`
- Přidává stripe-* hodnoty: `stripe_cancel_recurrence`, `stripe_sync`, `stripe_org_webhook`, `stripe_org_cancel_recurrence` (`stripe_webhook` už v constraintu byl)
- **Bonus / oprava:** doplňuje i `gopay_webhook`, `gopay_cancel_recurrence`, `gopay_org_webhook`, `gopay_org_cancel_recurrence`, `manual_sync` — kód v `supabase/functions/gopay-*` je už používal, ale dosavadní constraint je neměl (žádná migrace je nikdy nepřidala). Bez tohoto fixu by INSERT do `subscription_audit_log` z GoPay webhooků padal na CHECK violation.

**A5 — Validace fáze A**
- `npx vitest run tests/stripeHelpers.test.ts tests/gopayHelpers.test.ts` → **94 / 94 passed** (1.57s)
- TypeScript: nové soubory jen v `supabase/functions/_shared/` (mimo legacy frozen adresáře, žádný architektonický boundary nedotčen).
- Migrace: čeká na `supabase db push` (uživatel spustí ručně, není v auto módu).

**Otevřené body pro fázi B:**
- Zatím není potřeba `subscription_data.metadata` redundance — metadata na Checkout Session se propagují na Subscription. Ověřit při B1.
- Idempotency-Key: použít UUID generovaný z `userId + tier + period + Date.now()` pro deduplikaci dvojkliku.

### 2026-04-27 — Fáze B dokončena

**B1 — `stripe-create-payment/index.ts`**
- POST endpoint: validace vstupu (`tier`, `billingPeriod`, redirect URLs přes allowlist), enterprise tier rejected (mirror GoPay).
- Auth uživatele přes Supabase JWT. Reuse existujícího `billing_customer_id` jen když `billing_provider === 'stripe'` (žádné cross-provider customer ID).
- Volá Stripe `POST /checkout/sessions` v `subscription` modu s `line_items` z `getStripePriceId(tier, period)`, `metadata={userId,tier,billingPeriod}`, `subscription_data.metadata` (propagace na Subscription objekt), `client_reference_id=userId`, `allow_promotion_codes=true`, `locale='cs'`.
- Idempotency-Key: `stripe-create-{userId}-{tier}-{period}-{uuid}` — Stripe nativně deduplikuje při dvojkliku.
- Customer/Subscription ID se v této funkci do DB **neukládají** (Stripe je vrátí až přes webhook `checkout.session.completed`).

**B2 — `stripe-webhook/index.ts`**
- HMAC SHA-256 verifikace přes `Stripe-Signature` header + `STRIPE_WEBHOOK_SECRET` (`verifyStripeWebhookSignature` z `stripeBilling.ts`).
- Idempotence: `billing_webhook_events.event_id = "stripe-{evt_…}"` (UNIQUE constraint, source='stripe').
- Org-level eventy (s `metadata.orgId`) se ignorují — patří do `stripe-org-webhook` (samostatný endpoint v fázi C).
- Zpracovávané eventy:
  - `checkout.session.completed` → `retrieveSubscription` pro `current_period_end`, uloží `billing_customer_id` + `billing_subscription_id`, set `tier`, `status='active'`.
  - `customer.subscription.updated` → použije subscription objekt přímo z eventu (žádné API volání), sync `expires_at`, `cancel_at_period_end`, `status`, `tier`.
  - `customer.subscription.deleted` → `tier='free'`, `status='expired'`.
  - `invoice.payment_succeeded` → `retrieveSubscription` (subscription_id z invoice), refresh `expires_at`.
  - `invoice.payment_failed` → `status='pending'` (mapping ze Stripe `past_due`), `keepExistingExpires=true` (zachovat předchozí expires_at během grace period).
- `resolveUserId` strategie: 1) `metadata.userId`, 2) lookup přes `billing_subscription_id`, 3) lookup přes `billing_customer_id` (oba s podmínkou `billing_provider='stripe'`).
- Audit log: `change_type='stripe_webhook'`, notes obsahují `eventType`, `eventId`, `status`, `tier`, IDs.

**B3 — `stripe-cancel-subscription/index.ts`**
- POST endpoint: auth → load profile → validace `billing_provider='stripe'` + `validateStripeId(sub_id, 'subscription')`.
- Volá Stripe `POST /subscriptions/{id}` s `cancel_at_period_end=true` (atomic, žádný TOCTOU race).
- Idempotency-Key: `stripe-cancel-{userId}-{subscriptionId}` — opakované cancel při dvojkliku je no-op.
- Update `user_profiles.subscription_cancel_at_period_end=true` + audit log `change_type='stripe_cancel_recurrence'`.
- Subscription zůstává `active` až do `current_period_end`; expirace přijde přes webhook `customer.subscription.deleted`.

**B4 — `stripe-sync-subscription/index.ts`**
- POST endpoint: auth → load profile → ověř `billing_provider='stripe'` a validní sub_id.
- Volá Stripe `GET /subscriptions/{id}`, mapuje `status`, `expires_at` (ze `current_period_end`), `cancel_at_period_end`, `tier` (z subscription metadata, fallback existující tier).
- Update `user_profiles` (vč. customer_id pokud chybí) + audit log `change_type='stripe_sync'`.
- Při `internalStatus='expired'` → `tier='free'`, `expires_at=null`.
- Recovery flow pro případy, kdy se webhook ztratí nebo zpozdí.

**B5 — Validace fáze B**
- `npm run test:run` → **871 / 871 passed** (53.42s).
- `npm run check:boundaries` → OK (486 souborů, 19 nalezených, 10 v allowlistu).
- `npm run check:legacy-structure` → OK (137 souborů ve frozen rootech, žádný nový soubor v legacy adresáři).
- Edge funkce běží v Deno runtime — nejsou pokryty Vitestem (jako gopay-* ekvivalenty), ale sdílené helpery (`stripeHelpers.ts`) mají 55 unit testů a HMAC/API client (`stripeBilling.ts`) bude testovatelný v fázi C přes integration mocks.

**Bezpečnostní self-review:**
- ✅ HMAC verify s constant-time porovnáním + 5min tolerance window (replay protection).
- ✅ Raw body pro HMAC (`req.text()` před `JSON.parse`).
- ✅ Org-level eventy ignorovány v user webhooku (separátní secret pro `stripe-org-webhook`).
- ✅ Customer ID reuse jen při `billing_provider='stripe'` (žádné cross-provider záměny).
- ✅ Audit log notes neobsahují PII (jen IDs).
- ✅ `validateStripeId` před každým API voláním.
- ✅ Enterprise tier rejected (žádný self-checkout pro custom-pricing tier).
- ⚠️ **Otevřené:** `events_id` deduplikace platí jen v rámci tabulky `billing_webhook_events` — pokud Supabase pošle stejný event do GoPay i Stripe webhooku (technicky nemožné, jiné endpointy), zůstává oddělený key prefix. Žádný cross-provider únik.

**Otevřené body pro fázi C (org-level):**
- Org checkout musí ukládat `metadata.orgId` (a `metadata.seats`) — webhook bude routovat podle přítomnosti orgId.
- `stripe-org-webhook` má **vlastní secret** `STRIPE_ORG_WEBHOOK_SECRET` (separátní endpoint v Stripe Dashboardu).
- Quantity = seats (Stripe vestavěné per-seat pricing přes `line_items[0].quantity`).

### 2026-04-27 — Fáze C dokončena

**C1 — `stripe-create-org-payment/index.ts`**
- POST endpoint: validace vstupu (`orgId`, `tier`, `billingPeriod`, `seats` 1..1000, redirect URL allowlist), enterprise tier rejected.
- Auth uživatele přes Supabase JWT + RBAC: jen `owner`/`admin` orgu (mirror gopay-create-org-payment).
- Reuse Stripe customer ID, jen pokud `organizations.billing_provider === 'stripe'` a `cus_…` prefix (žádné cross-provider záměny).
- Volá Stripe `POST /checkout/sessions` v `subscription` modu s `line_items=[{price, quantity: seats}]`, `metadata={userId,orgId,tier,billingPeriod,seats}` na Session i Subscription objektu, `client_reference_id=orgId`, `locale='cs'`.
- Idempotency-Key: `stripe-create-org-{orgId}-{tier}-{period}-{seats}-{uuid}`.

**C2 — `stripe-org-webhook/index.ts`**
- HMAC verify přes **`STRIPE_ORG_WEBHOOK_SECRET`** (samostatný od user webhooku).
- Idempotence: `billing_webhook_events.event_id = "stripe-org-{evt_…}"` — separátní prefix od user webhooku, žádná kolize.
- User-level eventy (bez `metadata.orgId`) ignorovány — patří do `stripe-webhook`.
- Zpracovávané eventy:
  - `checkout.session.completed` → `retrieveSubscription` pro period_end, uloží `billing_customer_id`, `subscription_tier`, `subscription_status='active'`, `max_seats` (z `items[0].quantity`), `billing_period` (z `price.recurring.interval`), zápis do `org_billing_history` (status=`paid`).
  - `customer.subscription.updated` → použije objekt přímo z eventu, sync všech polí + max_seats při změně.
  - `customer.subscription.deleted` → `subscription_tier='free'`, `subscription_status='expired'`.
  - `invoice.payment_succeeded` → renewal: refresh `expires_at` + zápis do `org_billing_history` (renewal entry).
  - `invoice.payment_failed` → `subscription_status='pending'`, `keepExistingExpires=true` (grace period), zápis do `org_billing_history` (status=`failed`).
- `resolveOrgId` strategie: 1) `metadata.orgId`, 2) lookup přes `billing_customer_id` (Stripe `cus_…` prefix garantuje, že to není GoPay payment ID).
- Audit log: `change_type='stripe_org_webhook'`, notes obsahují `eventType`, `eventId`, `orgId`, `tier`, `seats`, `billingPeriod`, IDs.
- Schéma poznámka: `org_billing_history.gopay_payment_id` je legacy název — pro Stripe ukládáme tam `subscription_id` (stejný účel: identifikace platby v audit historii). Bez schema změny.

**C3 — `stripe-cancel-org-subscription/index.ts`**
- POST endpoint: auth → load org → RBAC `owner`-only (mirror GoPay; `admin` smí jen create/upgrade, ne cancel).
- Protože `organizations` nemá `billing_subscription_id` sloupec, dotahujeme aktivní subscription dynamicky přes `GET /subscriptions?customer=cus_…&status=all&limit=10` (filtr na `active|trialing|past_due|unpaid|incomplete` — vše "živé").
- Volá Stripe `POST /subscriptions/{id}` s `cancel_at_period_end=true` (atomic, žádný TOCTOU).
- Idempotency-Key: `stripe-cancel-org-{orgId}-{subscriptionId}` — opakovaný cancel je no-op.
- Update `organizations.subscription_status='cancelled'` + audit log `change_type='stripe_org_cancel_recurrence'`.

**C4 — `stripe-sync-org-subscription/index.ts`**
- POST endpoint: auth → membership-only (jakýkoli member, mirror gopay-sync-org).
- Najde nejnovější subscription pro org customer (`GET /subscriptions?customer=...&status=all`); preferuje live status, fallback na první v listu.
- `retrieveSubscription` → mapuje `status`, `expires_at`, `tier` (z metadata, fallback existující), `max_seats` (z `items[0].quantity`, fallback metadata.seats, fallback DB), `billing_period` (z `price.recurring.interval`).
- Update `organizations` + audit log `change_type='stripe_sync'`.
- Při `internalStatus='expired'` → `tier='free'`, `expires_at=null`, seats zachovány (audit hodnota).

**C5 — Validace fáze C**
- `npm run check:boundaries` → OK (486 souborů, 19 nalezených, 10 v allowlistu).
- `npm run check:legacy-structure` → OK (137 souborů ve frozen rootech).
- `npm run test:run` → **871 / 871 passed** (51.33s). Žádný regrese po přidání 4 edge funkcí v `supabase/functions/` (mimo Vitest scope).

**Bezpečnostní self-review:**
- ✅ HMAC verify s constant-time porovnáním + 5min tolerance window (replay protection).
- ✅ Raw body pro HMAC (`req.text()` před `JSON.parse`).
- ✅ User-level eventy ignorovány v org webhooku (oddělený endpoint, oddělený secret, oddělená rotace klíčů).
- ✅ Idempotence event ID prefix `stripe-org-` ≠ `stripe-` → žádná cross-scope kolize.
- ✅ Customer ID reuse jen pokud `billing_provider === 'stripe'` (žádný GoPay payment ID nelze omylem použít jako Stripe customer).
- ✅ RBAC: cancel = owner-only, create = owner+admin, sync = member (read-only).
- ✅ Audit log notes neobsahují PII (jen IDs).
- ✅ `validateStripeId` před každým API voláním a před resolution přes customer ID.
- ✅ Enterprise tier rejected při create.
- ✅ Sanity cap pro seats (1..1000) — ochrana proti UI bugu / botu.
- ⚠️ **Otevřené:** `org_billing_history.gopay_payment_id` má legacy název. Funkčně OK (string column, ukládáme tam Stripe sub_id). Pokud bude potřeba multi-provider audit reporting, budoucí migrace přidá `provider TEXT` + přejmenuje sloupec na `external_payment_id`. Není blocker pro fázi D.

**Otevřené body pro fázi D (frontend):**
- `services/paymentProviderService.ts` musí routovat všech 8 funkcí: `createCheckoutSession` / `cancelSubscription` / `syncSubscription` × `user` / `org`.
- Frontend dnes volá GoPay přímo — proxy přes paymentProvider zachová API tvar (parametry & response shape kompatibilní).

### 2026-04-27 — Fáze D dokončena

**D1 — `services/paymentProviderService.ts` (nový soubor, přidán do legacy allowlistu)**
- `getActiveBillingProvider()` — čte `VITE_BILLING_PROVIDER` (lowercased, trimmed); validuje proti `SUPPORTED_PROVIDERS = ['gopay', 'stripe']`; neznámý/prázdný → fallback `gopay`.
- `FUNCTION_NAMES` lookup table (gopay vs. stripe) pro 6 client-callable edge funkcí: `createPayment`, `cancelSubscription`, `syncSubscription`, `createOrgPayment`, `cancelOrgSubscription`, `syncOrgSubscription`.
- `normalizeCheckoutResponse()` — sjednocuje response shape mezi providerem: Stripe vrací `sessionId`, GoPay `paymentId`; upstream kód vidí vždy `paymentId`. Současně padá na `paymentUrl` ↔ `checkoutUrl` aliases (Stripe edge funkce vracejí oba).
- Public API: `paymentProviderService.{createUserCheckoutSession, cancelUserSubscription, syncUserSubscription, createOrgCheckoutSession, cancelOrgSubscription, syncOrgSubscription, getActiveProvider}`.
- Žádné error mapování / UI strings — to si konzumenti drží sami (`billingService.mapBillingErrorToUserMessage`).

**D2 — `config/legacy-freeze.json`**
- Přidán `services/paymentProviderService.ts` do `allowedFiles` (mezi `overviewChatService` a `platformAdapter`).
- Bez tohoto by `npm run check:legacy-structure` failoval po `git add` (frozen root `services/` nepovoluje nové soubory).

**D3 — `services/billingService.ts` refactor**
- `createCheckoutSession`, `cancelRecurrence`, `syncSubscription` → routováno přes `paymentProviderService.{createUserCheckoutSession, cancelUserSubscription, syncUserSubscription}`.
- `mapBillingErrorToUserMessage` rozšířen o stripe-specifická chybová klíčová slova: `stripe_secret_key`, `stripe_price_`, `stripe_webhook_secret`, `invalid api key`, `no stripe subscription found`. Pre-existing GoPay klíčová slova zachována.
- Default chování (`VITE_BILLING_PROVIDER` nenastaven) → router směřuje na `gopay-*` funkce, takže existující `tests/billingService.wallet.test.ts` (5 testů, kontroluje literály `gopay-create-payment` apod.) prochází bez změny.

**D4 — `features/organization/api/orgBillingActions.ts` refactor**
- `createOrgCheckout`, `cancelOrgSubscription`, `syncOrgSubscription` → routováno přes `paymentProviderService.{createOrgCheckoutSession, cancelOrgSubscription, syncOrgSubscription}`.
- Response normalizace pro `createOrgCheckout` (Stripe sessionId → paymentId, paymentUrl ↔ checkoutUrl).
- Import `invokeAuthedFunction` odstraněn (už ne potřeba, vše přes provider router).

**D5 — `tests/paymentProviderService.test.ts` (nový, 14 testů)**
- `getActiveBillingProvider()` — default gopay, stripe override, case normalizace, fallback při neznámém providerovi (`paddle`).
- User-level routing pro oba providery (gopay + stripe) × 3 akce (create/cancel/sync).
- Org-level routing pro oba providery × 3 akce.
- Verifikace `sessionId` → `paymentId` normalizace pro Stripe response.

**D6 — Validace fáze D**
- `npm run check:legacy-structure` → OK (138 souborů ve frozen rootech, paymentProviderService.ts v allowlistu).
- `npm run check:boundaries` → OK (487 souborů, 19 nalezených, 10 v allowlistu).
- `npm run test:run` → **885 / 885 passed** (50.77s; +14 nových testů paymentProviderService).

**Bezpečnostní self-review:**
- ✅ Žádný frontend kód nečte ani neposílá Stripe Secret Key (zůstává jen v Edge Functions env).
- ✅ Provider router je čistá routing logika — neudržuje žádný state, žádný cache, žádné side-effecty kromě `invokeAuthedFunction`.
- ✅ Default `gopay` při neplatném env varu je defenzivní (fail-safe na známou pracující bránu).
- ✅ Idempotence + auth headers řeší existující `functionsClient.invokeAuthedFunction` — nezměněno.
- ✅ Test pokrývá fallback path (nezávislé chování při corrupted env varu).

**Otevřené body pro fázi E (validace + E2E):**
- Manuální E2E v Stripe test mode vyžaduje:
  - Vytvoření test produktů + cen v Stripe Dashboardu.
  - Naplnění `STRIPE_*` env varů v Supabase (8 vars: secret + 2× webhook secret + 4× price IDs + API URL).
  - Nastavení `VITE_BILLING_PROVIDER=stripe` v Vercel/lokálním .env.
  - Test card `4242 4242 4242 4242` (Stripe sandbox).
- Migrace `20260427120000_stripe_audit_change_types.sql` musí být aplikována (`supabase db push`).

### 2026-04-27 — Fáze F dokončena

**F1 — Implementační deník (tento dokument)**
- Záznamy fází A–D byly průběžně doplňovány během implementace.
- Hlavičkový status updatován: A + B + C + D + F hotové, E čeká na Stripe účet uživatele.

**F2 — `docs/stripe-setup.md` (operační runbook)**
- 8 sekcí: 0) předpoklady (Stripe účet, CLI, CZK podpora), 1) Stripe Dashboard produkty + 4 recurring ceny (CZK, exact amounts: 399 / 3 830.40 / 499 / 4 790), 2) dva separátní webhooky (user + org) s rozdílnými secrety, 3) kompletní matice env varů (server: 7 povinných + 4 volitelné, client: 1 nový), 4) `supabase db push` + deploy 8 edge funkcí, 5) **Phase E E2E checklist** — 9 sub-scénářů (user happy path, cancel, sync, payment failure, org happy path, org seat změna, org cancel/sync, 9 negative testů) s konkrétními SQL queries pro DB ověření, 6) přepnutí do live módu, 7) rollback plán, 8) reference.
- Obsahuje exaktní `npx supabase secrets set …` příkaz, exact webhook URL pattern, exact test card numbers.
- Bezpečnostní kontrolní seznam (sekce 3.3): nikdy `STRIPE_SECRET_KEY` ve `VITE_*`, `.gitignore` audit, key rotation, failed events monitoring.
- Dokument je samostatný — uživatel ho může otevřít, projít step-by-step a dokončit Phase E bez znalosti implementačních detailů.

**Phase E status:** Připraveno k provedení. Blokery jsou pouze externí (Stripe účet, vytvoření test produktů v Dashboardu, naplnění env varů, `supabase db push`, deploy edge funkcí). Po splnění checklistu v `docs/stripe-setup.md` sekce 0–4 lze E2E provést dle sekce 5.

**Konečná validace všech fází (po fázi F):**
- `npm run check:legacy-structure` — OK (138 souborů ve frozen rootech, paymentProviderService.ts v allowlistu).
- `npm run check:boundaries` — OK (487 souborů, 19 nalezených, 10 v allowlistu).
- `npm run test:run` — **885 / 885 passed** (paymentProviderService 14, stripeHelpers 55, gopayHelpers 39, billingService.wallet 5, atd.).

**Otevřené follow-up úkoly (mimo scope tohoto plánu):**
- Customer Portal endpoint (uživatel si spravuje kartu / vidí faktury) — nice-to-have, nový endpoint volá `POST /v1/billing_portal/sessions`.
- Org seat live update endpoint (`stripe-update-org-seats` s proration_behavior) — pokud chceš UI slider místo cancel & re-checkout.
- Po cca 2 týdnech provozu: smazat dead-code v `gopay-*` (pokud `VITE_BILLING_PROVIDER=stripe` zůstane) — ale to je velký krok, lepší držet GoPay jako rollback option.

---

## 10. Reference

- **GoPay audit:** `docs/gopay-integration-audit.md`
- **CLAUDE.md** (kořen repa) — pravidla pro architekturu, testy, hranice
- **Stripe API docs:** https://docs.stripe.com/api (Subscriptions, Checkout, Webhooks)
- **Stripe Webhook signing:** https://docs.stripe.com/webhooks/signatures
- **Existující GoPay shared utility:**
  - `supabase/functions/_shared/gopayBilling.ts`
  - `supabase/functions/_shared/gopayHelpers.ts`
  - `tests/gopayHelpers.test.ts`
- **Klíčové migrace:** 20260123000100, 20260124000100, 20260124140000 (audit_log), 20260203001000 (stripe_subscription_tier), 20260412000000 (gopay billing_provider), 20260412100000 (org subscription billing)

---

*Konec dokumentu. Pokračování implementace začne fází A1 (`_shared/stripeHelpers.ts`).*
