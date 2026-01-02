-- Migration: user_login_type + harden admin checks
-- Date: 2026-01-02
-- Description: Adds editable login type to user management and fixes is_admin/is_superadmin NULL bypass.

-- 0) Harden admin helpers (avoid NULL -> bypass in PL/pgSQL IF checks)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE((auth.jwt() ->> 'email') IN ('martinkalkus82@gmail.com', 'kalkus@baustav.cz'), false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE((auth.jwt() ->> 'email') = 'martinkalkus82@gmail.com', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin TO authenticated;

-- 1) Add login_type to user_profiles (admin-editable label for UI/ops)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'login_type'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD COLUMN login_type TEXT;
  END IF;
END $$;

-- 2) Extend admin user list RPC with auth provider + login_type override
DROP FUNCTION IF EXISTS public.get_all_users_admin();
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
  login_type TEXT
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
    ) as auth_provider,
    up.login_type
  FROM auth.users au
  LEFT JOIN public.user_profiles up ON au.id = up.user_id
  LEFT JOIN public.user_roles ur ON up.role_id = ur.id
  ORDER BY au.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_users_admin TO authenticated;

-- 3) Admin-only RPC to update login type (NULL = auto/from Supabase)
DROP FUNCTION IF EXISTS public.update_user_login_type(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.update_user_login_type(
  target_user_id UUID,
  new_login_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  normalized := NULLIF(lower(trim(COALESCE(new_login_type, ''))), '');

  INSERT INTO public.user_profiles (user_id, login_type, updated_at)
  VALUES (target_user_id, normalized, now())
  ON CONFLICT (user_id) DO UPDATE SET
    login_type = EXCLUDED.login_type,
    updated_at = now();

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_login_type TO authenticated;
