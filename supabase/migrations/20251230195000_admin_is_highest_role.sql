-- Migration: admin_is_highest_role
-- Date: 2025-12-30
-- Description: Removes the "superadmin" distinction in DB permissions; admin is the highest role.

-- 1) RLS policies: user_roles / role_permissions / permission_definitions
DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles;
CREATE POLICY "user_roles_admin_all" ON public.user_roles
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "role_permissions_admin_all" ON public.role_permissions;
CREATE POLICY "role_permissions_admin_all" ON public.role_permissions
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "permission_definitions_admin_all" ON public.permission_definitions;
CREATE POLICY "permission_definitions_admin_all" ON public.permission_definitions
  FOR ALL USING (public.is_admin());

-- 2) user_profiles: allow admin to update any profile
DROP POLICY IF EXISTS "Superadmin can update any profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin can update any profile" ON public.user_profiles;
CREATE POLICY "Admin can update any profile" ON public.user_profiles
  FOR UPDATE USING (public.is_admin());

-- 3) Admin-only RPCs: users + roles/permissions management
CREATE OR REPLACE FUNCTION public.get_all_users_admin()
RETURNS TABLE (
  user_id UUID,
  email VARCHAR(255),
  display_name VARCHAR(255),
  role_id VARCHAR(50),
  role_label VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE,
  last_sign_in TIMESTAMP WITH TIME ZONE
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
    au.last_sign_in_at as last_sign_in
  FROM auth.users au
  LEFT JOIN public.user_profiles up ON au.id = up.user_id
  LEFT JOIN public.user_roles ur ON up.role_id = ur.id
  ORDER BY au.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_role(
  target_user_id UUID,
  new_role_id VARCHAR(50)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  INSERT INTO public.user_profiles (user_id, role_id, updated_at)
  VALUES (target_user_id, new_role_id, now())
  ON CONFLICT (user_id) DO UPDATE SET
    role_id = EXCLUDED.role_id,
    updated_at = now();

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_role_permission(
  target_role_id VARCHAR(50),
  target_permission_key VARCHAR(100),
  new_enabled BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  INSERT INTO public.role_permissions (role_id, permission_key, enabled)
  VALUES (target_role_id, target_permission_key, new_enabled)
  ON CONFLICT (role_id, permission_key) DO UPDATE SET
    enabled = EXCLUDED.enabled;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_users_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_role_permission TO authenticated;

