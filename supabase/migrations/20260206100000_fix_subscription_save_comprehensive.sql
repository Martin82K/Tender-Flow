-- Migration: fix_subscription_save_comprehensive
-- Date: 2026-02-06
-- Description: Comprehensive fix for subscription save issue in admin panel.
--              Ensures subscription_audit_log table exists and all functions work.
-- Issue: Admin cannot save subscription tier changes - table/function may be missing.

-- ============================================================================
-- 1. CREATE subscription_audit_log TABLE IF MISSING
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    old_tier TEXT,
    new_tier TEXT,
    change_type TEXT NOT NULL CHECK (change_type IN (
        'manual_override', 
        'stripe_webhook', 
        'trial_start', 
        'trial_end', 
        'expiration', 
        'reactivation', 
        'organization_change',
        'upgrade',
        'downgrade'
    )),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_user_id 
    ON public.subscription_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_created_at 
    ON public.subscription_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_change_type 
    ON public.subscription_audit_log(change_type);

-- Enable RLS
ALTER TABLE public.subscription_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "subscription_audit_log_admin_select" ON public.subscription_audit_log;
CREATE POLICY "subscription_audit_log_admin_select" ON public.subscription_audit_log
    FOR SELECT USING (
        public.is_admin()
    );

DROP POLICY IF EXISTS "subscription_audit_log_service_insert" ON public.subscription_audit_log;
CREATE POLICY "subscription_audit_log_service_insert" ON public.subscription_audit_log
    FOR INSERT WITH CHECK (true);  -- Functions run as SECURITY DEFINER

DROP POLICY IF EXISTS "subscription_audit_log_admin_insert" ON public.subscription_audit_log;
CREATE POLICY "subscription_audit_log_admin_insert" ON public.subscription_audit_log
    FOR INSERT WITH CHECK (
        public.is_admin()
    );

-- Grants
GRANT SELECT ON public.subscription_audit_log TO authenticated;
GRANT ALL ON public.subscription_audit_log TO service_role;

-- ============================================================================
-- 2. FIX update_user_subscription_tier FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS public.update_user_subscription_tier(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.update_user_subscription_tier(
    target_user_id UUID,
    new_subscription_tier TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    normalized TEXT;
    old_tier TEXT;
    admin_user_id UUID;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;

    admin_user_id := auth.uid();
    normalized := NULLIF(lower(trim(COALESCE(new_subscription_tier, ''))), '');
    
    IF normalized IS NOT NULL AND normalized NOT IN ('free', 'starter', 'pro', 'enterprise', 'admin') THEN
        RAISE EXCEPTION 'Invalid subscription tier: %', normalized;
    END IF;

    SELECT subscription_tier_override INTO old_tier
    FROM public.user_profiles
    WHERE user_id = target_user_id;

    INSERT INTO public.user_profiles (user_id, subscription_tier_override, updated_at)
    VALUES (target_user_id, normalized, now())
    ON CONFLICT (user_id) DO UPDATE SET
        subscription_tier_override = EXCLUDED.subscription_tier_override,
        updated_at = now();

    -- Log to audit (only if table exists - graceful fallback)
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
            normalized,
            'manual_override',
            CASE 
                WHEN normalized IS NULL THEN 'Removed manual override, reverted to organization tier'
                ELSE 'Manual tier override set by admin'
            END
        );
    EXCEPTION WHEN OTHERS THEN
        -- Ignore audit log errors, don't fail the main operation
        RAISE NOTICE 'Audit log insert failed: %', SQLERRM;
    END;

    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_subscription_tier TO authenticated;

-- ============================================================================
-- 3. VERIFY is_admin FUNCTION EXISTS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_user_tier TEXT;
    v_email TEXT;
BEGIN
    -- Get user email
    SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
    
    -- Check known admin emails
    IF v_email IN ('martinkalkus82@gmail.com', 'kalkus@baustav.cz') THEN
        RETURN true;
    END IF;
    
    -- Check subscription tier override for admin
    SELECT subscription_tier_override INTO v_user_tier
    FROM public.user_profiles
    WHERE user_id = auth.uid();
    
    IF v_user_tier = 'admin' THEN
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================================
-- 4. FIX get_all_users_admin TO RETURN CORRECT DATA
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_all_users_admin();
CREATE OR REPLACE FUNCTION public.get_all_users_admin()
RETURNS TABLE(
    user_id UUID,
    email TEXT,
    display_name TEXT,
    role_id TEXT,
    role_label TEXT,
    created_at TIMESTAMPTZ,
    last_sign_in TIMESTAMPTZ,
    auth_provider TEXT,
    login_type TEXT,
    org_subscription_tier TEXT,
    subscription_tier_override TEXT,
    effective_subscription_tier TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;

    RETURN QUERY
    SELECT 
        au.id AS user_id,
        au.email::TEXT,
        up.display_name::TEXT,
        up.role_id::TEXT,
        ur.label::TEXT AS role_label,
        au.created_at,
        au.last_sign_in_at AS last_sign_in,
        (au.raw_app_meta_data->>'provider')::TEXT AS auth_provider,
        up.login_type::TEXT,
        o.subscription_tier::TEXT AS org_subscription_tier,
        up.subscription_tier_override::TEXT,
        COALESCE(up.subscription_tier_override, o.subscription_tier, 'free')::TEXT AS effective_subscription_tier
    FROM auth.users au
    LEFT JOIN public.user_profiles up ON up.user_id = au.id
    LEFT JOIN public.user_roles ur ON ur.id = up.role_id::UUID
    LEFT JOIN public.organization_members om ON om.user_id = au.id
    LEFT JOIN public.organizations o ON o.id = om.organization_id
    ORDER BY au.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_users_admin() TO authenticated;

-- ============================================================================
-- 5. SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration complete: subscription_audit_log table created, update_user_subscription_tier fixed';
END $$;
