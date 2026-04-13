-- Fix: cast VARCHAR columns to TEXT in get_all_organizations_admin return

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
