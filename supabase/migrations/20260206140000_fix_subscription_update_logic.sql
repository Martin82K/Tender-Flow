-- Migration: fix_subscription_update_logic
-- Date: 2026-02-06
-- Description: Fixes update_user_subscription_tier to accept 'starter' tier.
--              Ensures subscription_audit_log table exists.

-- 1. Create subscription_audit_log table if missing
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_user_id ON public.subscription_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_created_at ON public.subscription_audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.subscription_audit_log ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT ON public.subscription_audit_log TO authenticated;
GRANT ALL ON public.subscription_audit_log TO service_role;

-- RLS Policies
DROP POLICY IF EXISTS "subscription_audit_log_admin_select" ON public.subscription_audit_log;
CREATE POLICY "subscription_audit_log_admin_select" ON public.subscription_audit_log
    FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "subscription_audit_log_service_insert" ON public.subscription_audit_log;
CREATE POLICY "subscription_audit_log_service_insert" ON public.subscription_audit_log
    FOR INSERT WITH CHECK (true);

-- 2. Redefine update_user_subscription_tier
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
    
    -- VALIDATION FIX: Added 'starter' to the allowed list (and ensured others are present)
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

    -- Log to audit
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
        -- Safely ignore audit log errors to ensure the update succeeds
        RAISE NOTICE 'Audit log insert failed: %', SQLERRM;
    END;

    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_subscription_tier TO authenticated;
