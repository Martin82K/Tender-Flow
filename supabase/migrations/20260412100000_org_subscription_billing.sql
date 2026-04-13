-- Migration: org_subscription_billing
-- Date: 2026-04-12
-- Description: Move subscription billing from user-level to organization-level (seat-based model).
--   Adds billing columns to organizations, seat tracking to organization_members,
--   creates user_feature_overrides and org_billing_history tables,
--   and new RPC functions for effective tier resolution with override support.

-- =============================================================================
-- 1. ALTER organizations — add billing & override columns
-- =============================================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS max_seats INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS billing_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_period TEXT DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS override_tier TEXT,
  ADD COLUMN IF NOT EXISTS override_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS override_reason TEXT,
  ADD COLUMN IF NOT EXISTS override_granted_by UUID REFERENCES auth.users(id);

-- =============================================================================
-- 2. ALTER organization_members — seat tracking
-- =============================================================================

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS seat_type TEXT DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS is_billable BOOLEAN DEFAULT true;

-- =============================================================================
-- 3. CREATE TABLE user_feature_overrides
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_feature_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, feature_key)
);

ALTER TABLE public.user_feature_overrides ENABLE ROW LEVEL SECURITY;

-- Users can read their own overrides
DROP POLICY IF EXISTS "Users can read own feature overrides" ON public.user_feature_overrides;
CREATE POLICY "Users can read own feature overrides" ON public.user_feature_overrides
  FOR SELECT USING (user_id = auth.uid());

-- Admin (via service_role or user with admin role) can manage all
DROP POLICY IF EXISTS "Service role manages feature overrides" ON public.user_feature_overrides;
CREATE POLICY "Service role manages feature overrides" ON public.user_feature_overrides
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.user_feature_overrides TO authenticated;
GRANT ALL ON public.user_feature_overrides TO service_role;

-- =============================================================================
-- 4. CREATE TABLE org_billing_history
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.org_billing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'CZK',
  seats_count INTEGER,
  tier TEXT,
  gopay_payment_id TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.org_billing_history ENABLE ROW LEVEL SECURITY;

-- Org members can view billing history
DROP POLICY IF EXISTS "Org members can view billing history" ON public.org_billing_history;
CREATE POLICY "Org members can view billing history" ON public.org_billing_history
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- Service role can insert (Edge Functions)
DROP POLICY IF EXISTS "Service role manages billing history" ON public.org_billing_history;
CREATE POLICY "Service role manages billing history" ON public.org_billing_history
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.org_billing_history TO authenticated;
GRANT ALL ON public.org_billing_history TO service_role;

-- =============================================================================
-- 5. HELPER FUNCTIONS: _tier_rank, _best_tier
-- =============================================================================

CREATE OR REPLACE FUNCTION public._tier_rank(t TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE t
    WHEN 'admin' THEN 99
    WHEN 'enterprise' THEN 4
    WHEN 'pro' THEN 3
    WHEN 'starter' THEN 2
    WHEN 'free' THEN 1
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public._best_tier(a TEXT, b TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN a IS NULL THEN b
    WHEN b IS NULL THEN a
    WHEN public._tier_rank(a) >= public._tier_rank(b) THEN a
    ELSE b
  END;
$$;

-- =============================================================================
-- 6. get_effective_user_tier(target_user_id) → JSONB
--    Priority chain:
--      1) Per-user feature overrides (handled in check_feature_access_v2, not here)
--      2) Org override_tier (non-expired)
--      3) Org subscription_tier (active)
--      4) User-level legacy (user_profiles via existing get_user_subscription_tier)
--      5) Default: 'free'
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_effective_user_tier(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_tier TEXT;
  result_source TEXT;
  r RECORD;
  v_user_tier TEXT;
BEGIN
  -- Check all organizations the user belongs to, pick the best tier
  FOR r IN
    SELECT
      o.subscription_tier,
      o.subscription_status,
      o.override_tier,
      o.override_expires_at,
      o.expires_at AS org_expires_at
    FROM public.organizations o
    JOIN public.organization_members om ON om.organization_id = o.id
    WHERE om.user_id = target_user_id
  LOOP
    -- 1) Override tier (if set and not expired)
    IF r.override_tier IS NOT NULL
       AND (r.override_expires_at IS NULL OR r.override_expires_at > now())
    THEN
      IF result_tier IS NULL OR public._tier_rank(r.override_tier) > public._tier_rank(result_tier) THEN
        result_tier := r.override_tier;
        result_source := 'org_override';
      END IF;
      CONTINUE;
    END IF;

    -- 2) Standard org subscription (if active and not expired)
    IF r.subscription_status = 'active'
       AND (r.org_expires_at IS NULL OR r.org_expires_at > now())
       AND r.subscription_tier IS NOT NULL
       AND r.subscription_tier != 'free'
    THEN
      IF result_tier IS NULL OR public._tier_rank(r.subscription_tier) > public._tier_rank(result_tier) THEN
        result_tier := r.subscription_tier;
        result_source := 'org_subscription';
      END IF;
    END IF;
  END LOOP;

  -- If we found an org-level tier, return it
  IF result_tier IS NOT NULL THEN
    RETURN jsonb_build_object('tier', result_tier, 'source', result_source);
  END IF;

  -- 3) Legacy fallback: user-level tier via existing function
  v_user_tier := public.get_user_subscription_tier(target_user_id);
  IF v_user_tier IS NOT NULL AND v_user_tier != 'free' THEN
    RETURN jsonb_build_object('tier', v_user_tier, 'source', 'user_legacy');
  END IF;

  -- 4) Default: free
  RETURN jsonb_build_object('tier', 'free', 'source', 'default');
END;
$$;

-- =============================================================================
-- 7. get_user_enabled_features_v2()
--    Uses get_effective_user_tier + user_feature_overrides
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_user_enabled_features_v2()
RETURNS TABLE (
  feature_key TEXT,
  feature_name TEXT,
  feature_description TEXT,
  feature_category TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier_info JSONB;
  v_tier TEXT;
BEGIN
  v_tier_info := public.get_effective_user_tier(auth.uid());
  v_tier := v_tier_info->>'tier';

  -- Admin gets all features
  IF v_tier = 'admin' THEN
    RETURN QUERY
    SELECT sf.key, sf.name, sf.description, sf.category
    FROM public.subscription_features sf
    ORDER BY sf.sort_order, sf.key;
    RETURN;
  END IF;

  -- Features from tier + per-user overrides (union, deduplicated)
  RETURN QUERY
  SELECT DISTINCT sf.key, sf.name, sf.description, sf.category
  FROM public.subscription_features sf
  LEFT JOIN public.subscription_tier_features stf ON stf.feature_key = sf.key
  LEFT JOIN public.user_feature_overrides ufo
    ON ufo.feature_key = sf.key
    AND ufo.user_id = auth.uid()
    AND (ufo.expires_at IS NULL OR ufo.expires_at > now())
  WHERE
    (stf.tier = v_tier AND stf.enabled = true)
    OR ufo.id IS NOT NULL
  ORDER BY sf.sort_order, sf.key;
END;
$$;

-- =============================================================================
-- 8. set_org_override — admin-only
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_org_override(
  target_org_id UUID,
  new_tier TEXT,
  p_reason TEXT DEFAULT NULL,
  p_expires TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.organizations SET
    override_tier = new_tier,
    override_expires_at = p_expires,
    override_reason = p_reason,
    override_granted_by = auth.uid()
  WHERE id = target_org_id;
END;
$$;

-- =============================================================================
-- 9. grant_user_feature — admin-only, per-user feature override
-- =============================================================================

CREATE OR REPLACE FUNCTION public.grant_user_feature(
  target_user UUID,
  p_feature TEXT,
  p_reason TEXT DEFAULT NULL,
  p_expires TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_feature_overrides (user_id, feature_key, granted_by, reason, expires_at)
  VALUES (target_user, p_feature, auth.uid(), p_reason, p_expires)
  ON CONFLICT (user_id, feature_key) DO UPDATE SET
    granted_by = auth.uid(),
    reason = EXCLUDED.reason,
    expires_at = EXCLUDED.expires_at;
END;
$$;

-- =============================================================================
-- 10. GRANT permissions
-- =============================================================================

GRANT EXECUTE ON FUNCTION public._tier_rank(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public._tier_rank(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public._best_tier(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public._best_tier(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_effective_user_tier(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_user_tier(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_enabled_features_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_enabled_features_v2() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_org_override(UUID, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_org_override(UUID, TEXT, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_user_feature(UUID, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_user_feature(UUID, TEXT, TEXT, TIMESTAMPTZ) TO service_role;
