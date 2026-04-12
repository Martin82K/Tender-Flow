-- Migration: Add 'gopay' to billing_provider constraint
-- Replaces Stripe with GoPay as the payment gateway

-- Drop existing constraint if it exists and re-create with gopay
DO $$
BEGIN
  -- Try to drop existing constraint
  ALTER TABLE user_profiles
    DROP CONSTRAINT IF EXISTS billing_provider_check;

  -- Add updated constraint including gopay
  ALTER TABLE user_profiles
    ADD CONSTRAINT billing_provider_check
    CHECK (billing_provider IN ('stripe', 'gopay', 'paddle', 'manual'));

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'billing_provider constraint update skipped: %', SQLERRM;
END $$;
