-- Legacy migration slot retained for existing migration history.
-- Active billing providers are constrained to Stripe-compatible values only.

DO $$
BEGIN
  ALTER TABLE user_profiles
    DROP CONSTRAINT IF EXISTS billing_provider_check;

  ALTER TABLE user_profiles
    ADD CONSTRAINT billing_provider_check
    CHECK (billing_provider IN ('stripe', 'paddle', 'manual'));

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'billing_provider constraint update skipped: %', SQLERRM;
END $$;
