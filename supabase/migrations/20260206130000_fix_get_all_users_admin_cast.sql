-- Migration: fix_get_all_users_admin_cast
-- Date: 2026-02-06
-- Description: Fixes a bug in get_all_users_admin where role_id was incorrectly cast to UUID.
--              The user_roles.id is VARCHAR, so no cast is needed.

CREATE OR REPLACE FUNCTION public.get_all_users_admin()
RETURNS TABLE(
    user_id UUID,
    email TEXT,
    display_name TEXT,
    role_id TEXT,
    role_label TEXT,
    created_at TIMESTAMPTZ,
    last_sign_in TIMESTAMPTZ,
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
        au.id AS user_id,
        au.email::TEXT,
        up.display_name::TEXT,
        up.role_id::TEXT,
        ur.label::TEXT AS role_label,
        au.created_at,
        au.last_sign_in_at AS last_sign_in,
        (au.raw_app_meta_data->>'provider')::TEXT AS auth_provider,
        up.login_type::TEXT,
        o.subscription_tier::TEXT AS org_subscription_tier,
        up.subscription_tier_override::TEXT,
        COALESCE(up.subscription_tier_override, o.subscription_tier, 'free')::TEXT AS effective_subscription_tier
    FROM auth.users au
    LEFT JOIN public.user_profiles up ON up.user_id = au.id
    LEFT JOIN public.user_roles ur ON ur.id = up.role_id -- Removed incorrect ::UUID cast here
    LEFT JOIN public.organization_members om ON om.user_id = au.id
    LEFT JOIN public.organizations o ON o.id = om.organization_id
    ORDER BY au.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_users_admin() TO authenticated;
