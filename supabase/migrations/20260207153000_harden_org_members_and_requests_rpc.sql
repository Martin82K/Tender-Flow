-- Harden organization RPCs against strict return-type mismatches and duplicate rows.

DROP FUNCTION IF EXISTS public.get_org_members(UUID);

CREATE OR REPLACE FUNCTION public.get_org_members(org_id_input UUID)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  role TEXT,
  joined_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = org_id_input
      AND om.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT q.user_id, q.email, q.display_name, q.role, q.joined_at
  FROM (
    SELECT DISTINCT ON (om.user_id)
      om.user_id::UUID AS user_id,
      u.email::TEXT AS email,
      up.display_name::TEXT AS display_name,
      om.role::TEXT AS role,
      om.created_at::TIMESTAMPTZ AS joined_at
    FROM public.organization_members om
    JOIN auth.users u ON u.id = om.user_id
    LEFT JOIN public.user_profiles up ON up.user_id = om.user_id
    WHERE om.organization_id = org_id_input
    ORDER BY om.user_id, om.created_at ASC
  ) AS q
  ORDER BY q.joined_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_org_members(UUID) TO authenticated;

DROP FUNCTION IF EXISTS public.get_org_join_requests(UUID);

CREATE OR REPLACE FUNCTION public.get_org_join_requests(org_id_input UUID)
RETURNS TABLE (
  request_id UUID,
  user_id UUID,
  email TEXT,
  display_name TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_owner(org_id_input) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT q.request_id, q.user_id, q.email, q.display_name, q.status, q.created_at
  FROM (
    SELECT DISTINCT ON (r.id)
      r.id::UUID AS request_id,
      r.user_id::UUID AS user_id,
      r.email::TEXT AS email,
      up.display_name::TEXT AS display_name,
      r.status::TEXT AS status,
      r.created_at::TIMESTAMPTZ AS created_at
    FROM public.organization_join_requests r
    LEFT JOIN public.user_profiles up ON up.user_id = r.user_id
    WHERE r.organization_id = org_id_input
    ORDER BY r.id, r.created_at DESC
  ) AS q
  ORDER BY q.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_org_join_requests(UUID) TO authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;
