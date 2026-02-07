-- Fix runtime type mismatch in get_org_members result shape.
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
  SELECT om.user_id, u.email, up.display_name, om.role::TEXT, om.created_at
  FROM public.organization_members om
  JOIN auth.users u ON u.id = om.user_id
  LEFT JOIN public.user_profiles up ON up.user_id = om.user_id
  WHERE om.organization_id = org_id_input
  ORDER BY om.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_org_members(UUID) TO authenticated;
