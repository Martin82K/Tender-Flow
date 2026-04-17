-- Migration: admin_org_management
-- Date: 2026-04-12
-- Description: Admin-only RPC functions for managing organization subscriptions
--   and license counts (max_seats) at the tenant level.

-- =============================================================================
-- 1. get_all_organizations_admin — list all orgs with subscription & seat info
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_all_organizations_admin()
RETURNS TABLE (
  org_id UUID,
  org_name TEXT,
  subscription_tier TEXT,
  subscription_status TEXT,
  max_seats INTEGER,
  billable_seats BIGINT,
  total_members BIGINT,
  billing_period TEXT,
  expires_at TIMESTAMPTZ,
  override_tier TEXT,
  override_expires_at TIMESTAMPTZ,
  override_reason TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  RETURN QUERY
  SELECT
    o.id AS org_id,
    o.name AS org_name,
    o.subscription_tier,
    o.subscription_status,
    o.max_seats,
    COALESCE(seats.billable, 0) AS billable_seats,
    COALESCE(seats.total, 0) AS total_members,
    o.billing_period,
    o.expires_at,
    o.override_tier,
    o.override_expires_at,
    o.override_reason,
    o.created_at
  FROM public.organizations o
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE om.is_billable = true AND om.is_active = true) AS billable,
      COUNT(*) FILTER (WHERE om.is_active = true) AS total
    FROM public.organization_members om
    WHERE om.organization_id = o.id
  ) seats ON true
  ORDER BY o.name;
END;
$$;

-- =============================================================================
-- 2. admin_update_org_subscription — set tier + max_seats for an org
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_org_subscription(
  target_org_id UUID,
  new_tier TEXT DEFAULT NULL,
  new_max_seats INTEGER DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  UPDATE public.organizations SET
    subscription_tier = COALESCE(new_tier, subscription_tier),
    max_seats = COALESCE(new_max_seats, max_seats),
    override_tier = new_tier,
    override_reason = p_reason,
    override_granted_by = auth.uid()
  WHERE id = target_org_id;
END;
$$;

-- =============================================================================
-- 3. GRANT permissions
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.get_all_organizations_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_organizations_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_org_subscription(UUID, TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_org_subscription(UUID, TEXT, INTEGER, TEXT) TO service_role;
