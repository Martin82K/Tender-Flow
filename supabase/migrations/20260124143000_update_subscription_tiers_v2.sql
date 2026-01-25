-- Migration: Update Subscription Tier Structure
-- Purpose: Add 'starter' tier and remove 'demo' tier  
-- Date: 2026-01-24

-- ============================================================================
-- STEP 0: Clean up old data FIRST (before changing constraints)
-- ============================================================================

-- Convert any 'demo' users to 'free'
UPDATE public.user_profiles 
SET subscription_tier_override = 'free'
WHERE subscription_tier_override = 'demo';

UPDATE public.organizations 
SET subscription_tier = 'free'
WHERE subscription_tier = 'demo';

-- Remove demo tier features BEFORE changing constraint
DELETE FROM public.subscription_tier_features WHERE tier = 'demo';

-- ============================================================================
-- STEP 1: Update CHECK constraints (after data cleanup)
-- ============================================================================

-- Update subscription_tier_features constraint to allow 'starter'
ALTER TABLE public.subscription_tier_features 
DROP CONSTRAINT IF EXISTS subscription_tier_features_tier_check;

ALTER TABLE public.subscription_tier_features 
ADD CONSTRAINT subscription_tier_features_tier_check 
CHECK (tier IN ('free', 'starter', 'pro', 'enterprise', 'admin'));

-- Update user_profiles constraint
ALTER TABLE public.user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_subscription_tier_override_check;

ALTER TABLE public.user_profiles 
ADD CONSTRAINT user_profiles_subscription_tier_override_check 
CHECK (subscription_tier_override IN ('free', 'starter', 'pro', 'enterprise', 'admin'));

-- Update organizations constraint
DO $$
BEGIN
    EXECUTE 'ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_subscription_tier_check';
    EXECUTE 'ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS chk_subscription_tier';
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

ALTER TABLE public.organizations 
ADD CONSTRAINT organizations_subscription_tier_check 
CHECK (subscription_tier IN ('free', 'starter', 'pro', 'enterprise', 'admin'));

-- ============================================================================
-- STEP 2: Add starter tier features
-- ============================================================================

-- Insert features for starter tier (copy from free)
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
SELECT 'starter', feature_key, enabled
FROM public.subscription_tier_features
WHERE tier = 'free'
ON CONFLICT (tier, feature_key) DO NOTHING;

-- Enable additional features for starter (paid tier)
UPDATE public.subscription_tier_features
SET enabled = true
WHERE tier = 'starter' 
AND feature_key IN ('excel_unlocker', 'ai_reports', 'unlimited_projects');

-- ============================================================================
-- STEP 3: Update audit log constraint
-- ============================================================================

ALTER TABLE public.subscription_audit_log 
DROP CONSTRAINT IF EXISTS subscription_audit_log_change_type_check;

ALTER TABLE public.subscription_audit_log 
ADD CONSTRAINT subscription_audit_log_change_type_check 
CHECK (change_type IN (
    'manual_override', 
    'stripe_webhook', 
    'trial_start', 
    'trial_end', 
    'expiration', 
    'reactivation', 
    'organization_change',
    'upgrade',
    'downgrade'
));

-- ============================================================================
-- STEP 4: Update RPC function with new valid tiers
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
