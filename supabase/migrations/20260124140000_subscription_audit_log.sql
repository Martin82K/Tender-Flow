-- Migration: Subscription Audit Log
-- Purpose: Track all subscription tier changes for admin visibility
-- Date: 2026-01-24

-- ============================================================================
-- 1) Create audit log table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    old_tier TEXT,
    new_tier TEXT,
    change_type TEXT NOT NULL DEFAULT 'manual_override' 
        CHECK (change_type IN ('manual_override', 'stripe_webhook', 'trial_start', 'trial_end', 'expiration', 'reactivation', 'organization_change')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_user_id 
    ON public.subscription_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_created_at 
    ON public.subscription_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_change_type 
    ON public.subscription_audit_log(change_type);

-- ============================================================================
-- 2) Enable RLS
-- ============================================================================

ALTER TABLE public.subscription_audit_log ENABLE ROW LEVEL SECURITY;

-- Admin can read all audit logs
DROP POLICY IF EXISTS "subscription_audit_log_admin_select" ON public.subscription_audit_log;
CREATE POLICY "subscription_audit_log_admin_select" ON public.subscription_audit_log
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- Service role can insert (for triggers and webhooks)
DROP POLICY IF EXISTS "subscription_audit_log_service_insert" ON public.subscription_audit_log;
CREATE POLICY "subscription_audit_log_service_insert" ON public.subscription_audit_log
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Admin can also insert (for manual changes)
DROP POLICY IF EXISTS "subscription_audit_log_admin_insert" ON public.subscription_audit_log;
CREATE POLICY "subscription_audit_log_admin_insert" ON public.subscription_audit_log
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

-- ============================================================================
-- 3) Update the subscription tier change function to log changes
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
    
    IF normalized IS NOT NULL AND normalized NOT IN ('free', 'pro', 'enterprise', 'admin') THEN
        RAISE EXCEPTION 'Invalid subscription tier: %', normalized;
    END IF;

    -- Get old tier for audit log
    SELECT subscription_tier_override INTO old_tier
    FROM public.user_profiles
    WHERE user_id = target_user_id;

    -- Update the tier
    INSERT INTO public.user_profiles (user_id, subscription_tier_override, updated_at)
    VALUES (target_user_id, normalized, now())
    ON CONFLICT (user_id) DO UPDATE SET
        subscription_tier_override = EXCLUDED.subscription_tier_override,
        updated_at = now();

    -- Log the change to audit table
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

    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_subscription_tier TO authenticated;

-- ============================================================================
-- 4) RPC function to get audit log for a user (admin only)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_subscription_audit_log(
    target_user_id UUID DEFAULT NULL,
    limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    user_email TEXT,
    changed_by UUID,
    changed_by_email TEXT,
    old_tier TEXT,
    new_tier TEXT,
    change_type TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;

    RETURN QUERY
    SELECT 
        sal.id,
        sal.user_id,
        u1.email::TEXT as user_email,
        sal.changed_by,
        u2.email::TEXT as changed_by_email,
        sal.old_tier,
        sal.new_tier,
        sal.change_type,
        sal.notes,
        sal.created_at
    FROM public.subscription_audit_log sal
    LEFT JOIN auth.users u1 ON u1.id = sal.user_id
    LEFT JOIN auth.users u2 ON u2.id = sal.changed_by
    WHERE (target_user_id IS NULL OR sal.user_id = target_user_id)
    ORDER BY sal.created_at DESC
    LIMIT limit_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subscription_audit_log TO authenticated;

-- ============================================================================
-- 5) Grant permissions
-- ============================================================================

GRANT SELECT ON public.subscription_audit_log TO authenticated;
GRANT ALL ON public.subscription_audit_log TO service_role;
