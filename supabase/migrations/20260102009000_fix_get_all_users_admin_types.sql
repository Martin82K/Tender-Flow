-- Migration: fix_get_all_users_admin_types
-- Date: 2026-01-02
-- Description: Fixes get_all_users_admin() return type mismatches (varchar vs text).

CREATE OR REPLACE FUNCTION public.get_all_users_admin()
RETURNS TABLE (
  user_id UUID,
  email VARCHAR(255),
  display_name VARCHAR(255),
  role_id VARCHAR(50),
  role_label VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE,
  last_sign_in TIMESTAMP WITH TIME ZONE,
  auth_provider TEXT,
  login_type TEXT,
  org_subscription_tier TEXT,
  subscription_tier_override TEXT,
  effective_subscription_tier TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  RETURN QUERY
  SELECT
    au.id as user_id,
    au.email::VARCHAR(255),
    COALESCE(up.display_name, '')::VARCHAR(255) as display_name,
    up.role_id,
    ur.label as role_label,
    au.created_at,
    au.last_sign_in_at as last_sign_in,
    COALESCE(
      NULLIF(au.raw_app_meta_data->>'provider', ''),
      NULLIF(au.raw_app_meta_data->'providers'->>0, ''),
      'email'
    )::text as auth_provider,
    up.login_type::text as login_type,
    org.subscription_tier::text as org_subscription_tier,
    up.subscription_tier_override::text as subscription_tier_override,
    COALESCE(up.subscription_tier_override, org.subscription_tier::text, 'free')::text as effective_subscription_tier
  FROM auth.users au
  LEFT JOIN public.user_profiles up ON au.id = up.user_id
  LEFT JOIN public.user_roles ur ON up.role_id = ur.id
  LEFT JOIN LATERAL (
    SELECT o.subscription_tier
    FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = au.id
    ORDER BY om.created_at ASC
    LIMIT 1
  ) org ON true
  ORDER BY au.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_users_admin TO authenticated;

