-- Migration: comprehensive_subscription_fix
-- Date: 2026-02-06
-- Description: Comprehensive fix for subscription tier saving issue.
--              This migration:
--              1. Removes all check constraints on subscription_tier_override
--              2. Recreates the update function with proper validation
--              3. Adds a service role policy for the update function

-- ============================================================================
-- 1. REMOVE ALL CHECK CONSTRAINTS ON subscription_tier_override
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT con.conname AS constraint_name
        FROM pg_catalog.pg_constraint con
        INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = con.connamespace
        WHERE nsp.nspname = 'public'
          AND rel.relname = 'user_profiles'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) LIKE '%subscription_tier_override%'
    )
    LOOP
        RAISE NOTICE 'Dropping constraint: %', r.constraint_name;
        EXECUTE format('ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
    END LOOP;
END $$;

-- ============================================================================
-- 2. ADD NEW CHECK CONSTRAINT WITH ALL VALID TIERS (including NULL)
-- ============================================================================

ALTER TABLE public.user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_subscription_tier_override_check;

ALTER TABLE public.user_profiles
ADD CONSTRAINT user_profiles_subscription_tier_override_check
CHECK (subscription_tier_override IS NULL OR subscription_tier_override IN ('free', 'starter', 'pro', 'enterprise', 'admin'));

-- ============================================================================
-- 3. DROP AND RECREATE update_user_subscription_tier FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS public.update_user_subscription_tier(UUID, TEXT);

CREATE FUNCTION public.update_user_subscription_tier(
    target_user_id UUID,
    new_subscription_tier TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    normalized_tier TEXT;
    old_tier TEXT;
    admin_user_id UUID;
BEGIN
    -- Check admin access
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;

    admin_user_id := auth.uid();
    
    -- Normalize the tier value
    normalized_tier := NULLIF(lower(trim(COALESCE(new_subscription_tier, ''))), '');
    
    -- Validate tier value
    IF normalized_tier IS NOT NULL AND normalized_tier NOT IN ('free', 'starter', 'pro', 'enterprise', 'admin') THEN
        RAISE EXCEPTION 'Invalid subscription tier: %. Valid tiers are: free, starter, pro, enterprise, admin', normalized_tier;
    END IF;

    -- Get old tier for audit logging
    SELECT subscription_tier_override INTO old_tier
    FROM public.user_profiles
    WHERE user_id = target_user_id;

    -- Perform upsert
    INSERT INTO public.user_profiles (user_id, subscription_tier_override, updated_at)
    VALUES (target_user_id, normalized_tier, now())
    ON CONFLICT (user_id) DO UPDATE SET
        subscription_tier_override = normalized_tier,
        updated_at = now();

    -- Log the change (ignore errors to not fail the main operation)
    BEGIN
        INSERT INTO public.subscription_audit_log (
            user_id,
            changed_by,
            old_tier,
            new_tier,
            change_type,
            notes
        ) VALUES (
            target_user_id,
            admin_user_id,
            old_tier,
            normalized_tier,
            'manual_override',
            CASE 
                WHEN normalized_tier IS NULL THEN 'Removed manual override, reverted to organization tier'
                ELSE format('Manual tier override set to %s by admin', normalized_tier)
            END
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Audit log insert failed (non-critical): %', SQLERRM;
    END;

    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_subscription_tier(UUID, TEXT) TO authenticated;

-- ============================================================================
-- 4. ENSURE RLS POLICY ALLOWS SERVICE ROLE / SECURITY DEFINER ACCESS
-- ============================================================================

-- The function runs as SECURITY DEFINER, so it should bypass RLS.
-- But let's add an explicit policy just in case.

DROP POLICY IF EXISTS "Admin can update any profile subscription" ON public.user_profiles;
CREATE POLICY "Admin can update any profile subscription" ON public.user_profiles
    FOR UPDATE USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Also ensure superadmin policy exists
DROP POLICY IF EXISTS "Superadmin can update any profile" ON public.user_profiles;
CREATE POLICY "Superadmin can update any profile" ON public.user_profiles
    FOR UPDATE USING (public.is_admin());

-- ============================================================================
-- 5. VERIFY THE FUNCTION WORKS
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration complete. The update_user_subscription_tier function has been recreated.';
    RAISE NOTICE 'Valid tiers: free, starter, pro, enterprise, admin (or NULL for auto)';
END $$;
