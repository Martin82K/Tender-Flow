-- Migration: fix_subscription_constraint
-- Date: 2026-02-06
-- Description: Updates the check constraint on user_profiles.subscription_tier_override to include 'starter'.

DO $$
DECLARE
    con_name text;
BEGIN
    -- Find the constraint name dynamically to be safe
    -- Looks for a check constraint on user_profiles that involves the subscription_tier_override column
    SELECT con.conname INTO con_name
    FROM pg_catalog.pg_constraint con
    INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
    INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = connamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'user_profiles'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%subscription_tier_override%';

    IF con_name IS NOT NULL THEN
        RAISE NOTICE 'Dropping constraint: %', con_name;
        EXECUTE 'ALTER TABLE public.user_profiles DROP CONSTRAINT ' || quote_ident(con_name);
    END IF;
END $$;

-- Add the new constraint with 'starter' included
ALTER TABLE public.user_profiles
ADD CONSTRAINT user_profiles_subscription_tier_override_check
CHECK (subscription_tier_override IN ('free', 'starter', 'pro', 'enterprise', 'admin'));
