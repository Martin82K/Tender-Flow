# Stripe — Dashboard Setup, Env Vars & E2E Test Plan

**Pro koho:** Martin (provozní setup po dokončení implementace fází A–D).
**Status:** Implementace edge funkcí, helperů, frontend routeru a testů hotová. Tento dokument je **operační runbook** — co nakliknout v Stripe Dashboardu, jak nakonfigurovat env vary, a jak provést manuální E2E v test módu.

> Všechen kód k Stripe integraci žije v: `supabase/functions/stripe-*`, `supabase/functions/_shared/stripe{Billing,Helpers}.ts`, `services/paymentProviderService.ts`, `tests/{stripeHelpers,paymentProviderService}.test.ts`. Plán a deník: `docs/stripe-integration-plan.md`.

---

## 0. Předpoklady

- Stripe účet (test mode stačí). Business region nemusí být `CZ` — stačí, aby účet podporoval **CZK** currency u recurring pricing. Ověř si v `Settings → Business → Account details → Country` a `Settings → Tax & invoicing → Currency` (nebo zkus vytvořit produkt s CZK cenou; pokud ti to Stripe nepovolí, máš nepodporovaný region).
- Nainstalovaný [Stripe CLI](https://docs.stripe.com/stripe-cli) (volitelné, ale výrazně zjednoduší E2E lokálně přes `stripe listen`).
- Přístup k Supabase projektu (Edge Function secrets) a k Vercel deploymentu (Vite env vars).
- Nainstalovaný Supabase CLI (`npx supabase` funguje z repa).

---

## 1. Stripe Dashboard — produkty a ceny

> Stripe Price ID je statický (přiřazený k produktu). My ho čteme z env varu `STRIPE_PRICE_ID_*`. Postup je v test mode i v live mode identický — jen se přepneš v levém horním rohu Dashboardu.

### 1.1 Vytvoř dva produkty

V `Product catalog → Add product`:

| Produkt | Name | Description (volitelné) |
|---|---|---|
| Starter | `Tender Flow Starter` | CRM pro menší týmy / OSVČ |
| Pro | `Tender Flow Pro` | Plná funkcionalita pro projektové firmy |

> **Enterprise tier vědomě nevytváříš.** Custom pricing, žádný self-checkout.
> **Free tier vědomě nevytváříš.** Stripe nemá co spravovat — uživatel ho dostane lokálně defaultem.

### 1.2 Přidej k oběma produktům dvě recurring ceny

Pro každý produkt klikni `Add another price` → vyber **Recurring** → **Standard pricing** (NE tiered/volume!) → **Currency: CZK** → vyplň částku.

| Produkt | Price | Amount | Billing period | Stripe Price ID env var |
|---|---|---|---|---|
| Starter | Monthly | **399.00 CZK** | Monthly (1 mo) | `STRIPE_PRICE_ID_STARTER_MONTHLY` |
| Starter | Yearly | **3 830.40 CZK** | Yearly (1 yr) | `STRIPE_PRICE_ID_STARTER_YEARLY` |
| Pro | Monthly | **499.00 CZK** | Monthly (1 mo) | `STRIPE_PRICE_ID_PRO_MONTHLY` |
| Pro | Yearly | **4 790.00 CZK** | Yearly (1 yr) | `STRIPE_PRICE_ID_PRO_YEARLY` |

**Důležité:**
- Částka v Dashboardu se zadává v **majoritní jednotce** (399.00 CZK), Stripe API ji interně drží v haléřích (39 900). Náš kód v `_shared/stripeHelpers.ts:24` má pricing v haléřích jako sanity check pro audit, ale **skutečnou částku účtuje Stripe podle Price ID** — Dashboard hodnota je zdroj pravdy. Když nastavíš 399.00 CZK, sedí to.
- Yearly ceny mají **20 % slevu** (3 830.40 = 12 × 399 × 0.80, 4 790 = 12 × 499 × 0.80). Pokud chceš jiný discount, uprav i `PLAN_PRICES` v `stripeHelpers.ts` (kvůli audit logice).
- **Per-seat billing pro org variantu** je řešen přes `quantity` v Checkout Session (viz `stripe-create-org-payment`). Žádný separátní org produkt — používá se ten samý Price ID, jen s `quantity: seats`. Proto **NEsmí** být tiered/volume pricing — flat per-seat.
- Po vytvoření klikni na cenu, zkopíruj `price_…` ID. Bude to vypadat jako `price_1QXXXXXXXXXXXXXX`.

### 1.3 Volitelné nastavení

- **Tax / DPH:** Stripe Tax umí spočítat DPH automaticky. Dnes ho neaktivujeme (faktury vystavuje Tender Flow / účetní mimo Stripe). Pokud aktivuješ, ověř, že `automatic_tax` flag se propaguje do Checkout Session — náš kód ho zatím nezapíná.
- **Customer Portal:** `Settings → Customer portal → Activate` umožní uživatelům spravovat platební metodu / kartu. Aktuálně nemáme v UI tlačítko, které portal otevře (otevřená otázka 2 v plánu). Lze přidat později — žádné migrace, jen nový endpoint, který volá `POST /v1/billing_portal/sessions`.
- **Automatické faktury:** `Settings → Tax & invoicing → Invoices` → zapni `Send invoices for completed subscriptions`. Stripe pošle PDF na email; my je nikam neukládáme.

---

## 2. Webhook endpoints

V `Developers → Webhooks → Add endpoint` vytvoř **dva separátní endpointy**:

### 2.1 User-level webhook

| Pole | Hodnota |
|---|---|
| Endpoint URL | `https://<SUPABASE_PROJECT_REF>.functions.supabase.co/stripe-webhook` |
| Description (volitelné) | `Tender Flow user subscriptions` |
| Events to send | `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed` |
| API version | nech default (`2026-04-22.dahlia` nebo novější — náš kód nezávisí na konkrétní verzi, pošle se přes `Stripe-Version` header z env) |

Po vytvoření klikni `Reveal` u **Signing secret** → zkopíruj `whsec_…` → uložíš ho jako `STRIPE_WEBHOOK_SECRET` (viz dále).

### 2.2 Org-level webhook

**Druhý endpoint, druhý secret.** Důvodem je oddělená rotace klíčů a defense-in-depth (viz security audit v `stripe-integration-plan.md`).

| Pole | Hodnota |
|---|---|
| Endpoint URL | `https://<SUPABASE_PROJECT_REF>.functions.supabase.co/stripe-org-webhook` |
| Description | `Tender Flow organization subscriptions` |
| Events to send | identické jako u user webhooku (5 eventů výše) |

Skopíruj `whsec_…` → bude to `STRIPE_ORG_WEBHOOK_SECRET`.

> **Pozn.:** Oba endpointy můžeš dočasně směrovat na stejné eventy a spoléhat na vnitřní routing podle `metadata.orgId`. Náš kód si poradí: `stripe-webhook` ignoruje eventy s `metadata.orgId`, `stripe-org-webhook` ignoruje eventy bez něj. Žádný event se nezpracuje dvakrát.

### 2.3 Lokální testování přes Stripe CLI (volitelné)

```bash
# Forward na Supabase functions emulator (běží přes `npx supabase functions serve`)
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-org-webhook
```

CLI vypíše dočasný `whsec_…` — použij ho jako `STRIPE_WEBHOOK_SECRET` v lokálním `.env` pro Supabase functions.

---

## 3. Env vars — kompletní matice

### 3.1 Server (Supabase Edge Functions)

Nastav přes Supabase Dashboard `Project settings → Edge Functions → Secrets`, nebo přes CLI:

```bash
npx supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_… \
  STRIPE_WEBHOOK_SECRET=whsec_… \
  STRIPE_ORG_WEBHOOK_SECRET=whsec_… \
  STRIPE_PRICE_ID_STARTER_MONTHLY=price_… \
  STRIPE_PRICE_ID_STARTER_YEARLY=price_… \
  STRIPE_PRICE_ID_PRO_MONTHLY=price_… \
  STRIPE_PRICE_ID_PRO_YEARLY=price_…
```

| Env var | Povinné? | Příklad | Zdroj |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | ✅ | `sk_test_51Qab…` / `sk_live_51Qab…` | `Developers → API keys → Secret key` |
| `STRIPE_WEBHOOK_SECRET` | ✅ | `whsec_abc…` | endpoint `stripe-webhook` (sekce 2.1) |
| `STRIPE_ORG_WEBHOOK_SECRET` | ✅ | `whsec_xyz…` | endpoint `stripe-org-webhook` (sekce 2.2) |
| `STRIPE_PRICE_ID_STARTER_MONTHLY` | ✅ | `price_1Q…` | sekce 1.2 |
| `STRIPE_PRICE_ID_STARTER_YEARLY` | ✅ | `price_1Q…` | sekce 1.2 |
| `STRIPE_PRICE_ID_PRO_MONTHLY` | ✅ | `price_1Q…` | sekce 1.2 |
| `STRIPE_PRICE_ID_PRO_YEARLY` | ✅ | `price_1Q…` | sekce 1.2 |
| `STRIPE_API_URL` | ⛔ | (default `https://api.stripe.com/v1`) | volitelné, jen pro testovací override |
| `STRIPE_API_VERSION` | ⛔ | (default `2026-04-22.dahlia`) | volitelné, jen pro pinning starší verze |
| `SITE_URL` | ✅ (sdílené s GoPay) | `https://app.tenderflow.cz` | redirect URL allowlist |
| `ALLOWED_CHECKOUT_ORIGINS` | volitelné (sdílené s GoPay) | `https://app.tenderflow.cz,https://staging.tenderflow.cz` | redirect URL allowlist |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | ✅ (existuje) | – | běžné Supabase secrets |

> **Pozor na `sk_` prefix.** `_shared/stripeBilling.ts:23` failuje při startu funkce, pokud klíč nezačíná `sk_`. Stripe ti v Dashboardu nabízí dva typy klíčů — Secret (`sk_…`) a Restricted (`rk_…`). Pro tuto integraci použij **Secret**: vytváření Checkout Session, retrieve Subscription a cancel vyžadují plný scope.

### 3.2 Client (Vite — Vercel + lokální `.env.local`)

| Env var | Hodnota | Účel |
|---|---|---|
| `VITE_BILLING_PROVIDER` | `gopay` (default) \| `stripe` | Globální přepínač provideru. **Bez explicitního `stripe` se nic nezmění** — výchozí chování je GoPay. |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | (existuje) | Beze změny. |

> **`VITE_BILLING_PROVIDER` musí být nastavený PŘED `npm run build`.** Vite ho inlinuje do bundle. V Vercelu to znamená re-deploy po změně env var. V Electron desktop buildu je to při buildu zazvonkováno — switch tedy bude až ve příští verzi.
> Default routing zůstává `gopay`, takže bez nastavení env varu si web bude chovat jako dnes (a všechny GoPay testy v CI procházejí).

### 3.3 Bezpečnostní kontrolní seznam

- [ ] `STRIPE_SECRET_KEY` **nikdy** v Vite/`VITE_*` env varu (frontend ho nepotřebuje, šel by do bundle).
- [ ] V `.gitignore` zkontroluj, že žádný lokální `.env*` s reálným klíčem necommituješ. (Repo má standardní `.env.local` ignored, ale ověř před prvním push.)
- [ ] V Stripe Dashboardu si v `Developers → API keys` všimni `Roll key` — pokud se klíč náhodně dostane do logu, rotuj okamžitě.
- [ ] Webhook endpointy v Dashboardu mají sekci `Failed events`. Po deployi zkontroluj, že tam nejsou žádné HTTP 5xx/401 (znamená, že máš špatný `whsec_…` v Supabase env).

---

## 4. Aplikace migrace (před prvním webhookem)

```bash
# Z kořene repa
npx supabase db push
```

Migrace, která se aplikuje: `supabase/migrations/20260427120000_stripe_audit_change_types.sql`

Co dělá:
- Rozšiřuje `subscription_audit_log_change_type_check` o `stripe_cancel_recurrence`, `stripe_sync`, `stripe_org_webhook`, `stripe_org_cancel_recurrence`.
- **Bonus fix:** doplňuje i chybějící `gopay_*` hodnoty (`gopay_webhook`, `gopay_cancel_recurrence`, `gopay_org_webhook`, `gopay_org_cancel_recurrence`, `manual_sync`), které GoPay edge funkce už používaly, ale constraint je neměl. Bez této opravy by **GoPay webhooky** padaly na CHECK violation v okamžiku, kdy se constraint poprvé re-evaluovalo (regression audit).

> Když migrace selže (např. existuje řádek s `change_type`, který je v novém constraintu, ale CHECK ho odmítá kvůli `OLD_VALUES`), ozvi se — prošetříme audit log před aplikací. Defaultně by ale měla projít čistě (jen rozšiřuje povolené hodnoty, žádnou neodebírá).

### 4.1 Deploy edge funkcí

```bash
npx supabase functions deploy stripe-create-payment
npx supabase functions deploy stripe-webhook
npx supabase functions deploy stripe-cancel-subscription
npx supabase functions deploy stripe-sync-subscription
npx supabase functions deploy stripe-create-org-payment
npx supabase functions deploy stripe-org-webhook
npx supabase functions deploy stripe-cancel-org-subscription
npx supabase functions deploy stripe-sync-org-subscription
```

Nebo všechny najednou: `npx supabase functions deploy` (deploye všechny funkce v `supabase/functions/`).

> Po deployi ověř `npx supabase functions list` — všech 8 stripe-* funkcí má `verify_jwt = true` u client-callable (`create-*`, `cancel-*`, `sync-*`) a `verify_jwt = false` u webhooků (Stripe není autentikovaný JWT-em, jen HMAC). Stripe webhook funkce **NEsmí** mít JWT verifikaci, jinak Supabase odmítne POST od Stripe a uvidíš 401 v Dashboardu. Tato konfigurace je řízená přes `supabase/config.toml` (zkontroluj/uprav před deployi, pokud Supabase v default módu zapnul JWT verify).

---

## 5. Phase E — manuální E2E v test módu

> Cíl: prošli se kompletní user-level + org-level flow s `4242 4242 4242 4242` a ověřit DB stav po každém kroku.
>
> **Předpoklady:**
> - Sekce 1, 2, 3, 4 hotové (test mode klíče, test Price IDs, oba webhooky aktivní, migrace aplikovaná, edge funkce nasazené).
> - `VITE_BILLING_PROVIDER=stripe` v `.env.local` (lokálně) nebo ve Vercel preview env.
> - Test card: `4242 4242 4242 4242` (Visa, success), libovolný budoucí `MM/YY`, libovolné CVC, ZIP `12345`. Další test karty: viz https://docs.stripe.com/testing#cards.

### 5.1 User-level happy path (starter monthly)

1. Lokálně: `npm run dev` → přihlásit se jako test user (free tier).
2. UI → Settings/Billing → vybrat `Starter monthly` → klik na CTA „Předplatit / Upgrade".
3. **Očekáváno:** redirect na `https://checkout.stripe.com/c/pay/cs_test_…` v new tabu.
4. Vyplnit `4242 4242 4242 4242`, expiry `12/30`, CVC `123`, ZIP `12345`. Submit.
5. **Očekáváno:** redirect na `success_url` (`/billing/success?…`).
6. **DB ověření** (`SELECT … FROM user_profiles WHERE user_id = '<test-user-id>'`):
   - `billing_provider = 'stripe'`
   - `billing_customer_id` začíná `cus_`
   - `billing_subscription_id` začíná `sub_`
   - `subscription_status = 'active'`
   - `subscription_tier = 'starter'`
   - `billing_period = 'monthly'`
   - `subscription_expires_at` ≈ `now() + 30d`
7. **Audit log** (`SELECT … FROM subscription_audit_log WHERE user_id = '<id>' ORDER BY created_at DESC LIMIT 5`):
   - 1 záznam s `change_type = 'stripe_webhook'`, notes obsahuje `eventType: checkout.session.completed`.
8. **Webhook events** (`SELECT … FROM billing_webhook_events ORDER BY received_at DESC LIMIT 5`):
   - Záznam s `event_id = 'stripe-evt_…'`, `source = 'stripe'`, `status = 'processed'`.
9. **Idempotence test:** ve Stripe Dashboardu `Developers → Webhooks → stripe-webhook → Send test webhook` znovu pošli stejný event ID (nebo přes CLI `stripe events resend evt_…`). DB nesmí přepsat existující záznam, log to dvakrát do `billing_webhook_events` ne — měl by být `(event_id) UNIQUE` violation handled jako "already processed" log line v Edge Function output.

### 5.2 User-level cancel flow

1. UI → Billing → klik „Zrušit obnovení".
2. **Očekáváno:** zelená hláška, `subscription_cancel_at_period_end = true`.
3. **DB:** `user_profiles.subscription_cancel_at_period_end = true`, status zůstává `'active'` (zruší se až na konci období).
4. **Audit log:** nový záznam s `change_type = 'stripe_cancel_recurrence'`.
5. **Stripe Dashboard:** subscription má `Cancels at <date>` badge.
6. **Stripe simulate end-of-period:** v Dashboardu `Subscriptions → <sub_id> → … → Cancel immediately` (nebo `stripe subscriptions cancel sub_…` přes CLI). Stripe pošle `customer.subscription.deleted`.
7. **Po webhooku:** `subscription_status = 'expired'`, `subscription_tier = 'free'`.

### 5.3 User-level sync (recovery flow)

> Smysl: pokud se webhook ztratí (v Dashboardu `Failed events`), je tlačítko „Synchronizovat předplatné" v UI.

1. UI → Billing → „Synchronizovat".
2. **Očekáváno:** stav v DB sedí s aktuálním Stripe subscription objektem.
3. **Audit log:** záznam s `change_type = 'stripe_sync'`.

### 5.4 User-level payment failure

1. Použij test kartu `4000 0000 0000 0341` (charge succeeds, ale recurring selže) NEBO v Dashboardu klikem `Subscriptions → Update default payment method → Use card 4000 0000 0000 0341` před prvním renewal.
2. **Očekáváno:** po dalším invoice cyklu Stripe pošle `invoice.payment_failed`.
3. **DB:** `subscription_status = 'pending'` (mapping z `past_due`), `subscription_expires_at` zachováno (grace period — nezruší přístup okamžitě).
4. **Audit log:** záznam s `change_type = 'stripe_webhook'`, notes obsahují `eventType: invoice.payment_failed`.

### 5.5 Org-level happy path (pro yearly, 5 seats)

1. Přepnout se do org kontextu (test org, role `owner`).
2. UI → Org Billing → `Pro yearly`, slider seats → 5.
3. Redirect na Stripe Checkout, na hostovaném checkoutu vidíš **5 × 4 790 CZK = 23 950 CZK / rok** (Stripe spočítá z `quantity` automaticky).
4. Test card 4242…, submit.
5. **DB** (`organizations WHERE id = '<org-id>'`):
   - `billing_customer_id` začíná `cus_`
   - `subscription_tier = 'pro'`, `subscription_status = 'active'`, `billing_period = 'yearly'`, `max_seats = 5`
   - `expires_at` ≈ `now() + 365d`
6. **`org_billing_history`:** nový záznam, `status = 'paid'`, `amount = 2395000` (haléře), `seats = 5`.
7. **Audit log:** `change_type = 'stripe_org_webhook'`, notes obsahují `orgId`, `tier: pro`, `seats: 5`, `billingPeriod: yearly`.

### 5.6 Org-level seat změna

> Per-seat price je `quantity × unit_price`. Stripe umí proration nativně (pokud `proration_behavior` zapnuto v subscription).

Aktuální implementace **neexponuje quantity update** v UI — uživatel musí dnes zrušit a znovu předplatit s novým počtem seatů. Pokud chceš live seat update, je to follow-up úkol (nový endpoint `stripe-update-org-seats`, volá `POST /v1/subscriptions/{id}` s `items[0].quantity = newSeats` a `proration_behavior = 'create_prorations'`).

### 5.7 Org-level cancel + sync

Identické s 5.2 a 5.3, jen na `organizations` tabulce a `change_type = 'stripe_org_cancel_recurrence'` / `'stripe_sync'`.

### 5.8 Negative cases (bezpečnostní validace)

| Test | Očekávaný response |
|---|---|
| POST `stripe-webhook` bez `Stripe-Signature` headeru | `401 Invalid signature` |
| POST `stripe-webhook` s upraveným payloadem (změň 1 znak) | `401 Invalid signature` |
| POST `stripe-webhook` s `t=…` starším než 5 min | `401 Invalid signature` |
| POST `stripe-create-payment` s `tier: 'enterprise'` | `400 Enterprise tier nemá self-checkout` |
| POST `stripe-create-payment` s `success_url: 'https://evil.com/...'` | `400 Invalid redirect URL` |
| POST `stripe-create-org-payment` jako member (ne owner/admin) | `403 Forbidden` |
| POST `stripe-cancel-org-subscription` jako admin (ne owner) | `403 Forbidden` |
| POST `stripe-create-org-payment` se `seats: 0` | `400 Invalid seats` |
| POST `stripe-create-org-payment` se `seats: 9999` | `400 Invalid seats` |

Pro tyhle testy buď použij `curl` s reálným Supabase JWT, nebo si v UI vyrob breakpointy. Stripe-Signature spoofing testy jdou nejjednodušeji přes `stripe trigger checkout.session.completed --override-signature whsec_FAKE`.

### 5.9 Po skončení E2E

1. `Stripe Dashboard → Subscriptions` smaž testovací subscriptions (lze hromadně označit a `Cancel immediately`).
2. `Customers` lze taky smazat — Stripe ID po smazání nepoužívej znovu (DB cache by měla špinavé stale ID).
3. V repu: smaž lokální `.env.local` se test klíči (nebo je ponechej pro CI). **Nikdy** necommituj.

---

## 6. Přepnutí do produkce (live mode)

1. V Stripe Dashboardu přepni `Test mode → Live mode` (toggle vlevo nahoře).
2. **Opakuj sekci 1 + 2** v live módu (produkty + ceny + webhooky musíš vytvořit znova — test mode a live mode mají oddělené ID prostory).
3. **Aktualizuj env vary** v Supabase a Vercelu — všechna `STRIPE_*` se mění na live hodnoty (`sk_live_…`, `whsec_…` z live endpointu, `price_…` z live produktů).
4. **Deploy** edge funkce znovu **NENÍ potřeba** — env vary se přečtou až za běhu, kód je shodný.
5. **Vercel** musí mít `VITE_BILLING_PROVIDER=stripe` v Production env varech a redeploy (kvůli Vite buildu).
6. **Smoke test:** projdi 5.1 v live módu s reálnou kartou (a poté v Stripe Dashboardu refunduj kvůli sanity). Stripe podporuje refund přes `Dashboard → Payments → Refund` v UI.

---

## 7. Rollback plán

Pokud se po launchi něco rozbije a chceš okamžitě zpátky na GoPay:

1. **Vercel:** přepni `VITE_BILLING_PROVIDER=gopay` → redeploy. Frontend okamžitě přestane volat Stripe.
2. **Supabase:** edge funkce nech nasazené — neškodí. (Stripe webhook bude dál chodit pro existující stripe subscriptions, ale žádný nový checkout přes Stripe nevznikne.)
3. **Existující Stripe předplatitelé:** musíš jim manuálně migrovat (cancel ve Stripe + pozvánka na GoPay), nebo jim **NECHAT Stripe běžet souběžně** (frontend volá GoPay, ale Stripe webhook stále zpracovává jejich obnovy/cancely). To druhé je možné, protože:
   - User-level: `billing_provider` v DB rozhoduje, který "domov" subscription má.
   - Stripe webhook ignoruje uživatele s `billing_provider != 'stripe'` (viz `stripe-webhook/index.ts` `resolveUserId` strategie).

---

## 8. Reference

- Plán a architektura: [`docs/stripe-integration-plan.md`](./stripe-integration-plan.md)
- GoPay paralela (kontext multi-provider DB schématu): [`docs/gopay-integration-audit.md`](./gopay-integration-audit.md)
- Stripe API: https://docs.stripe.com/api
- Stripe webhook signing: https://docs.stripe.com/webhooks/signatures
- Stripe test cards: https://docs.stripe.com/testing#cards
- Stripe CLI: https://docs.stripe.com/stripe-cli
- Supabase Edge Functions secrets: https://supabase.com/docs/guides/functions/secrets

---

*Konec runbooku. Pokud narazíš na nesoulad mezi tímhle dokumentem a kódem, zdrojem pravdy je kód — ozvi se a doplníme změny sem.*
