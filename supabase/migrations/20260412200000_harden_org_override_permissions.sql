-- Migration: harden_org_override_permissions
-- Date: 2026-04-12
-- Description: Restrict org/user override management to platform admins and service role.

-- =============================================================================
-- 1. Lock down user_feature_overrides direct table access
-- =============================================================================

DROP POLICY IF EXISTS "Service role manages feature overrides" ON public.user_feature_overrides;
CREATE POLICY "Service role manages feature overrides" ON public.user_feature_overrides
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON public.user_feature_overrides FROM authenticated;
GRANT SELECT ON public.user_feature_overrides TO authenticated;

-- =============================================================================
-- 2. Enforce admin check in SECURITY DEFINER override RPCs
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
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only platform admins can set organization overrides';
  END IF;

  UPDATE public.organizations SET
    override_tier = new_tier,
    override_expires_at = p_expires,
    override_reason = p_reason,
    override_granted_by = auth.uid()
  WHERE id = target_org_id;
END;
$$;

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
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only platform admins can grant user features';
  END IF;

  INSERT INTO public.user_feature_overrides (user_id, feature_key, granted_by, reason, expires_at)
  VALUES (target_user, p_feature, auth.uid(), p_reason, p_expires)
  ON CONFLICT (user_id, feature_key) DO UPDATE SET
    granted_by = auth.uid(),
    reason = EXCLUDED.reason,
    expires_at = EXCLUDED.expires_at;
END;
$$;
