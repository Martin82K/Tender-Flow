# Stripe Billing Runbook (Apple Pay / Google Pay)

## Konfigurace
- Zapněte `Apple Pay` a `Google Pay` ve Stripe Dashboard (`Payment methods`).
- V `Payment method domains` registrujte produkční domény aplikace.
- Nastavte Edge Function secrets:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRICE_ID_STARTER_MONTHLY`
  - `STRIPE_PRICE_ID_STARTER_YEARLY`
  - `STRIPE_PRICE_ID_PRO_MONTHLY`
  - `STRIPE_PRICE_ID_PRO_YEARLY`
  - `STRIPE_PRICE_ID_ENTERPRISE_MONTHLY`
  - `STRIPE_PRICE_ID_ENTERPRISE_YEARLY`
  - `SITE_URL`
  - `ALLOWED_CHECKOUT_ORIGINS` (comma-separated allowlist originů)
- Frontend env:
  - `VITE_STRIPE_PUBLISHABLE_KEY`

## Incident: nepropisuje se tier po platbě
1. Zkontrolujte `billing_webhook_events`:
   - jestli event přišel (`status=received/processed`),
   - jestli nepadá na `failed`.
2. Ověřte `stripe-signature` validaci (`STRIPE_WEBHOOK_SECRET`).
3. Ověřte přiřazení subscription k uživateli (`billing_subscription_id`, `billing_customer_id`, `stripe_customer_id`).
4. Spusťte ruční sync přes endpoint `stripe-sync-subscription`.

## Incident: webhook duplicity / replay
1. Ověřte záznam v `billing_webhook_events` podle `event_id`.
2. Pokud je event duplicitní, handler vrací `duplicate=true` a nemá měnit stav předplatného.

## Incident: checkout se neotevře
1. Ověřte chybu z UI:
   - `Redirect URL is not allowed` -> upravit `ALLOWED_CHECKOUT_ORIGINS`.
   - `price ID not configured` -> doplnit příslušné Stripe price IDs.
   - `Unauthorized` -> expirace session, nutné znovu přihlášení.
2. Ověřte, že `successUrl` a `cancelUrl` míří na povolenou doménu.

## Incident: wallet checkout duplicate request
1. Ověřte `billing_subscription_requests` podle `user_id + idempotency_key`.
2. Stav `processing` znamená, že první request ještě běží.
3. Stav `failed` vyžaduje nový `idempotency key` pro retry.
