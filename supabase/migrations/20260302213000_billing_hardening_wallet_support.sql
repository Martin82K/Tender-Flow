-- Billing hardening for Stripe subscriptions:
-- 1) webhook idempotency + replay visibility
-- 2) request idempotency for wallet-based subscription creation
-- 3) keep legacy and new customer ID columns in sync

BEGIN;

CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
  source TEXT NOT NULL DEFAULT 'stripe',
  payload_summary JSONB NULL,
  error_message TEXT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_status
  ON public.billing_webhook_events (status, received_at DESC);

CREATE TABLE IF NOT EXISTS public.billing_subscription_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  tier TEXT NOT NULL,
  billing_period TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'success', 'failed')),
  stripe_subscription_id TEXT NULL,
  response JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_billing_subscription_requests_user_created
  ON public.billing_subscription_requests (user_id, created_at DESC);

-- Ensure both customer columns exist and align values for backward compatibility.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_customer_id TEXT;

UPDATE public.user_profiles
SET
  billing_customer_id = COALESCE(billing_customer_id, stripe_customer_id),
  stripe_customer_id = COALESCE(stripe_customer_id, billing_customer_id)
WHERE
  billing_customer_id IS DISTINCT FROM COALESCE(billing_customer_id, stripe_customer_id)
  OR stripe_customer_id IS DISTINCT FROM COALESCE(stripe_customer_id, billing_customer_id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer_id
  ON public.user_profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMIT;
