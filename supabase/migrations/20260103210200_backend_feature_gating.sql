-- Migration: Backend feature gating
-- Date: 2026-01-03
-- Description: Creates helper functions to check user features at the database level,
--              enabling RLS policies to enforce subscription limits even if frontend is bypassed.

-- ============================================================================
-- 1) HELPER: Get effective subscription tier for a user
-- ============================================================================
-- Uses SECURITY DEFINER to bypass RLS and avoid recursion
DROP FUNCTION IF EXISTS public.get_user_subscription_tier(UUID);
CREATE OR REPLACE FUNCTION public.get_user_subscription_tier(target_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result_tier TEXT;
BEGIN
  -- Priority: 1) User override, 2) Organization tier, 3) Default 'free'
  SELECT COALESCE(up.subscription_tier_override, org.subscription_tier, 'free')
  INTO result_tier
  FROM auth.users au
  LEFT JOIN public.user_profiles up ON au.id = up.user_id
  LEFT JOIN LATERAL (
    SELECT o.subscription_tier
    FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = au.id
    ORDER BY om.created_at ASC
    LIMIT 1
  ) org ON true
  WHERE au.id = target_user_id;

  RETURN COALESCE(result_tier, 'free');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_subscription_tier(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_subscription_tier(UUID) TO service_role;

-- ============================================================================
-- 2) HELPER: Check if current user has a specific feature enabled
-- ============================================================================
DROP FUNCTION IF EXISTS public.user_has_feature(TEXT);
CREATE OR REPLACE FUNCTION public.user_has_feature(feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  user_tier TEXT;
  feature_enabled BOOLEAN;
BEGIN
  -- Get the current user's effective subscription tier
  user_tier := public.get_user_subscription_tier(auth.uid());
  
  -- Admin tier always has access to everything
  IF user_tier = 'admin' THEN
    RETURN true;
  END IF;

  -- Check if this tier has the feature enabled
  SELECT stf.enabled INTO feature_enabled
  FROM public.subscription_tier_features stf
  WHERE stf.tier = user_tier
    AND stf.feature_key = feature_key;

  RETURN COALESCE(feature_enabled, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_has_feature(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_feature(TEXT) TO service_role;

-- ============================================================================
-- 3) HELPER: Check if specific user has a feature (for admin/service use)
-- ============================================================================
DROP FUNCTION IF EXISTS public.user_id_has_feature(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.user_id_has_feature(target_user_id UUID, feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  user_tier TEXT;
  feature_enabled BOOLEAN;
BEGIN
  user_tier := public.get_user_subscription_tier(target_user_id);
  
  IF user_tier = 'admin' THEN
    RETURN true;
  END IF;

  SELECT stf.enabled INTO feature_enabled
  FROM public.subscription_tier_features stf
  WHERE stf.tier = user_tier
    AND stf.feature_key = feature_key;

  RETURN COALESCE(feature_enabled, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_id_has_feature(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_id_has_feature(UUID, TEXT) TO service_role;

-- ============================================================================
-- 4) HELPER: List all enabled features for current user
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_user_enabled_features();
CREATE OR REPLACE FUNCTION public.get_user_enabled_features()
RETURNS TABLE (
  feature_key TEXT,
  feature_name TEXT,
  feature_description TEXT,
  feature_category TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  user_tier TEXT;
BEGIN
  user_tier := public.get_user_subscription_tier(auth.uid());

  -- Admin gets all features
  IF user_tier = 'admin' THEN
    RETURN QUERY
    SELECT sf.key, sf.name, sf.description, sf.category
    FROM public.subscription_features sf
    ORDER BY sf.sort_order, sf.key;
  END IF;

  -- Regular users get only enabled features for their tier
  RETURN QUERY
  SELECT sf.key, sf.name, sf.description, sf.category
  FROM public.subscription_features sf
  JOIN public.subscription_tier_features stf ON stf.feature_key = sf.key
  WHERE stf.tier = user_tier AND stf.enabled = true
  ORDER BY sf.sort_order, sf.key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_enabled_features() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_enabled_features() TO service_role;

-- ============================================================================
-- 5) EXAMPLE RLS POLICIES FOR FEATURE-GATED TABLES
-- ============================================================================
-- These are examples - apply similar patterns to your actual tables

-- Example: Documents table (requires 'doc_hub' feature)
-- Uncomment and adapt for your actual table name:
/*
DROP POLICY IF EXISTS "doc_hub_feature_gate" ON public.project_documents;
CREATE POLICY "doc_hub_feature_gate" ON public.project_documents
  FOR ALL TO authenticated
  USING (public.user_has_feature('doc_hub'));
*/

-- Example: AI Insights access (requires 'ai_insights' feature)
/*
DROP POLICY IF EXISTS "ai_insights_feature_gate" ON public.ai_analysis_results;
CREATE POLICY "ai_insights_feature_gate" ON public.ai_analysis_results
  FOR SELECT TO authenticated
  USING (public.user_has_feature('ai_insights'));
*/

-- ============================================================================
-- 6) UPDATE CHECK CONSTRAINT FOR DEMO TIER
-- ============================================================================
-- Ensure the subscription_tier_override column accepts 'demo' tier
DO $$
BEGIN
  -- Drop and recreate the check constraint to include 'demo'
  ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_subscription_tier_override_check;
  ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_subscription_tier_override_check
    CHECK (subscription_tier_override IS NULL OR subscription_tier_override IN ('demo', 'free', 'pro', 'enterprise', 'admin'));
EXCEPTION
  WHEN undefined_column THEN
    -- Column doesn't exist yet, skip
    NULL;
END $$;

-- Also update organizations table if it has a subscription_tier column
DO $$
BEGIN
  ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_subscription_tier_check;
  ALTER TABLE public.organizations ADD CONSTRAINT organizations_subscription_tier_check
    CHECK (subscription_tier IS NULL OR subscription_tier IN ('demo', 'free', 'pro', 'enterprise', 'admin'));
EXCEPTION
  WHEN undefined_table THEN
    NULL;
  WHEN undefined_column THEN
    NULL;
END $$;

-- ============================================================================
-- 7) RPC TO CHECK FEATURE (for frontend/API use)
-- ============================================================================
-- This is useful for the frontend to verify access before showing UI
DROP FUNCTION IF EXISTS public.check_feature_access(TEXT);
CREATE OR REPLACE FUNCTION public.check_feature_access(feature_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  user_tier TEXT;
  has_access BOOLEAN;
BEGIN
  user_tier := public.get_user_subscription_tier(auth.uid());
  has_access := public.user_has_feature(feature_key);
  
  RETURN jsonb_build_object(
    'feature', feature_key,
    'tier', user_tier,
    'hasAccess', has_access
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_feature_access(TEXT) TO authenticated;
