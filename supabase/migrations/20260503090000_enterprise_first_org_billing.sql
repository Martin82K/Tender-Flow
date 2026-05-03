-- Migration: enterprise_first_org_billing
-- Date: 2026-05-03
-- Description: Enterprise-first organization billing metadata and seat-limit enforcement.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_contact TEXT;

UPDATE public.organizations
SET
  subscription_tier = 'enterprise',
  subscription_status = COALESCE(subscription_status, 'trial'),
  billing_period = COALESCE(billing_period, 'yearly')
WHERE subscription_tier IS NULL OR subscription_tier IN ('starter', 'pro');

CREATE OR REPLACE FUNCTION public._org_billable_seats_available(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(o.max_seats IS NULL OR COUNT(om.user_id) < o.max_seats, true)
  FROM public.organizations o
  LEFT JOIN public.organization_members om
    ON om.organization_id = o.id
   AND om.is_active = true
   AND om.is_billable = true
  WHERE o.id = target_org_id
  GROUP BY o.max_seats;
$$;

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
  FOR r IN
    SELECT
      o.subscription_tier,
      o.subscription_status,
      o.override_tier,
      o.override_expires_at,
      COALESCE(o.billing_period_end, o.expires_at) AS org_expires_at
    FROM public.organizations o
    JOIN public.organization_members om ON om.organization_id = o.id
    WHERE om.user_id = target_user_id
      AND om.is_active = true
  LOOP
    IF r.override_tier IS NOT NULL
       AND (r.override_expires_at IS NULL OR r.override_expires_at > now())
    THEN
      IF result_tier IS NULL OR public._tier_rank(r.override_tier) > public._tier_rank(result_tier) THEN
        result_tier := r.override_tier;
        result_source := 'org_override';
      END IF;
      CONTINUE;
    END IF;

    IF r.subscription_status IN ('active', 'trial')
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

  IF result_tier IS NOT NULL THEN
    RETURN jsonb_build_object('tier', result_tier, 'source', result_source);
  END IF;

  v_user_tier := public.get_user_subscription_tier(target_user_id);
  IF v_user_tier IS NOT NULL AND v_user_tier != 'free' THEN
    RETURN jsonb_build_object('tier', v_user_tier, 'source', 'user_legacy');
  END IF;

  RETURN jsonb_build_object('tier', 'free', 'source', 'default');
END;
$$;

CREATE OR REPLACE FUNCTION public.add_org_member_by_email(org_id_input UUID, email_input TEXT, role_input TEXT DEFAULT 'member')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user UUID;
BEGIN
  IF NOT public.is_org_owner(org_id_input) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF role_input NOT IN ('owner', 'admin', 'member') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  SELECT id INTO target_user
  FROM auth.users
  WHERE lower(email) = lower(trim(email_input))
  LIMIT 1;

  IF target_user IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id_input AND role = 'owner'
  ) THEN
    role_input := 'owner';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id_input AND user_id = target_user
  ) AND NOT public._org_billable_seats_available(org_id_input) THEN
    RAISE EXCEPTION 'Seat limit reached';
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role, seat_type, is_billable, is_active)
  VALUES (org_id_input, target_user, role_input, 'full', true, true)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_org_join_request(request_id_input UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id UUID;
  target_user UUID;
  org_name TEXT;
BEGIN
  SELECT r.organization_id, r.user_id, o.name
  INTO org_id, target_user, org_name
  FROM public.organization_join_requests r
  JOIN public.organizations o ON o.id = r.organization_id
  WHERE r.id = request_id_input;

  IF org_id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF NOT public.is_org_admin(org_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id AND user_id = target_user AND is_active = true
  ) AND NOT public._org_billable_seats_available(org_id) THEN
    RAISE EXCEPTION 'Seat limit reached';
  END IF;

  UPDATE public.organization_join_requests
  SET status = 'approved', decided_at = now(), decided_by = auth.uid()
  WHERE id = request_id_input;

  INSERT INTO public.organization_members (organization_id, user_id, role, seat_type, is_billable, is_active)
  VALUES (org_id, target_user, 'member', 'full', true, true)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  INSERT INTO public.notifications (user_id, type, title, body)
  VALUES (target_user, 'success', 'Schválení v organizaci', 'Byli jste schváleni v organizaci ' || org_name || '.');

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_org_member(org_id_input UUID, user_id_input UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  target_role TEXT;
  target_active BOOLEAN;
BEGIN
  SELECT om.role INTO caller_role
  FROM public.organization_members om
  WHERE om.organization_id = org_id_input
    AND om.user_id = auth.uid()
    AND om.is_active = true;

  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT om.role, om.is_active
  INTO target_role, target_active
  FROM public.organization_members om
  WHERE om.organization_id = org_id_input AND om.user_id = user_id_input;

  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF target_active IS DISTINCT FROM true AND NOT public._org_billable_seats_available(org_id_input) THEN
    RAISE EXCEPTION 'Seat limit reached';
  END IF;

  UPDATE public.organization_members
  SET is_active = true, is_billable = true, seat_type = COALESCE(seat_type, 'full')
  WHERE organization_id = org_id_input AND user_id = user_id_input;

  RETURN TRUE;
END;
$$;

DROP FUNCTION IF EXISTS public.get_all_organizations_admin();

CREATE FUNCTION public.get_all_organizations_admin()
RETURNS TABLE (
  org_id UUID,
  org_name TEXT,
  subscription_tier TEXT,
  subscription_status TEXT,
  max_seats INTEGER,
  billable_seats BIGINT,
  total_members BIGINT,
  billing_period TEXT,
  billing_period_start TIMESTAMPTZ,
  billing_period_end TIMESTAMPTZ,
  billing_contact TEXT,
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
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.name::TEXT,
    o.subscription_tier::TEXT,
    o.subscription_status::TEXT,
    o.max_seats,
    COALESCE(seats.billable, 0),
    COALESCE(seats.total, 0),
    o.billing_period::TEXT,
    o.billing_period_start,
    o.billing_period_end,
    o.billing_contact::TEXT,
    o.expires_at,
    o.override_tier::TEXT,
    o.override_expires_at,
    o.override_reason::TEXT,
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

DROP FUNCTION IF EXISTS public.admin_update_org_subscription(UUID, TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.admin_update_org_subscription(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);

CREATE FUNCTION public.admin_update_org_subscription(
  target_org_id UUID,
  new_tier TEXT DEFAULT NULL,
  new_max_seats INTEGER DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  new_status TEXT DEFAULT NULL,
  new_billing_period TEXT DEFAULT NULL,
  new_billing_period_start TIMESTAMPTZ DEFAULT NULL,
  new_billing_period_end TIMESTAMPTZ DEFAULT NULL,
  new_billing_contact TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_billable INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  IF new_tier IS NOT NULL AND new_tier NOT IN ('free', 'enterprise') THEN
    RAISE EXCEPTION 'Only free and enterprise plans are active';
  END IF;

  IF new_status IS NOT NULL AND new_status NOT IN ('trial', 'active', 'past_due', 'paused', 'canceled') THEN
    RAISE EXCEPTION 'Invalid subscription status';
  END IF;

  IF new_billing_period IS NOT NULL AND new_billing_period NOT IN ('monthly', 'yearly') THEN
    RAISE EXCEPTION 'Invalid billing period';
  END IF;

  IF new_max_seats IS NOT NULL THEN
    SELECT COUNT(*) INTO v_billable
    FROM public.organization_members
    WHERE organization_id = target_org_id
      AND is_billable = true
      AND is_active = true;

    IF new_max_seats < GREATEST(v_billable, 1) THEN
      RAISE EXCEPTION 'Cannot reduce seats below current billable members (%)', v_billable;
    END IF;
  END IF;

  UPDATE public.organizations SET
    subscription_tier = COALESCE(new_tier, subscription_tier, 'enterprise'),
    subscription_status = COALESCE(new_status, subscription_status, 'active'),
    max_seats = COALESCE(new_max_seats, max_seats, 1),
    billing_period = COALESCE(new_billing_period, billing_period, 'yearly'),
    billing_period_start = COALESCE(new_billing_period_start, billing_period_start),
    billing_period_end = COALESCE(new_billing_period_end, billing_period_end),
    billing_contact = COALESCE(new_billing_contact, billing_contact),
    expires_at = COALESCE(new_billing_period_end, expires_at),
    override_tier = COALESCE(new_tier, override_tier),
    override_reason = COALESCE(p_reason, override_reason),
    override_granted_by = auth.uid()
  WHERE id = target_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public._org_billable_seats_available(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_org_member_by_email(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_org_join_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_org_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_organizations_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_organizations_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_org_subscription(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_org_subscription(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO service_role;
