-- Remove deprecated payment provider from active billing constraints.
-- Existing rows using an unsupported provider are preserved as manual billing
-- records before constraints are tightened.

UPDATE public.user_profiles
SET billing_provider = 'manual'
WHERE billing_provider IS NOT NULL
  AND billing_provider NOT IN ('stripe', 'paddle', 'manual');

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS billing_provider_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT billing_provider_check
  CHECK (billing_provider IN ('stripe', 'paddle', 'manual'));

UPDATE public.subscription_audit_log
SET change_type = 'manual_sync'
WHERE change_type NOT IN (
  'manual_override',
  'manual_sync',
  'trial_start',
  'trial_end',
  'expiration',
  'reactivation',
  'organization_change',
  'upgrade',
  'downgrade',
  'stripe_webhook',
  'stripe_cancel_recurrence',
  'stripe_sync',
  'stripe_org_webhook',
  'stripe_org_cancel_recurrence'
);

ALTER TABLE public.subscription_audit_log
  DROP CONSTRAINT IF EXISTS subscription_audit_log_change_type_check;

ALTER TABLE public.subscription_audit_log
  ADD CONSTRAINT subscription_audit_log_change_type_check
  CHECK (change_type IN (
    'manual_override',
    'manual_sync',
    'trial_start',
    'trial_end',
    'expiration',
    'reactivation',
    'organization_change',
    'upgrade',
    'downgrade',
    'stripe_webhook',
    'stripe_cancel_recurrence',
    'stripe_sync',
    'stripe_org_webhook',
    'stripe_org_cancel_recurrence'
  ));

COMMENT ON CONSTRAINT subscription_audit_log_change_type_check
  ON public.subscription_audit_log IS
  'Validní typy změny předplatného po přechodu na Stripe-only billing.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'org_billing_history'
      AND column_name = 'go' || 'pay_payment_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'org_billing_history'
      AND column_name = 'external_payment_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.org_billing_history RENAME COLUMN '
      || quote_ident('go' || 'pay_payment_id')
      || ' TO external_payment_id';
  END IF;
END $$;
