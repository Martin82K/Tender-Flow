-- Filter out users who belong to a real organization (>1 active member)
-- from the admin users list. Those users are managed via the Organizations panel.

CREATE OR REPLACE FUNCTION public.get_all_users_admin()
RETURNS TABLE (
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
        au.id::UUID AS user_id,
        au.email::TEXT,
        up.display_name::TEXT,
        up.role_id::TEXT,
        ur.label::TEXT AS role_label,
        au.created_at::TIMESTAMPTZ,
        au.last_sign_in_at::TIMESTAMPTZ AS last_sign_in,
        COALESCE(
            NULLIF(au.raw_app_meta_data->>'provider', ''),
            NULLIF(au.raw_app_meta_data->'providers'->>0, ''),
            'email'
        )::TEXT AS auth_provider,
        up.login_type::TEXT,
        org.subscription_tier::TEXT AS org_subscription_tier,
        up.subscription_tier_override::TEXT,
        COALESCE(up.subscription_tier_override::TEXT, org.subscription_tier::TEXT, 'free')::TEXT AS effective_subscription_tier
    FROM auth.users au
    LEFT JOIN public.user_profiles up ON up.user_id = au.id
    LEFT JOIN public.user_roles ur ON ur.id = up.role_id
    LEFT JOIN LATERAL (
        SELECT o.subscription_tier::TEXT AS subscription_tier
        FROM public.organization_members om
        JOIN public.organizations o ON o.id = om.organization_id
        WHERE om.user_id = au.id
        ORDER BY om.created_at ASC
        LIMIT 1
    ) org ON true
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.organization_members om2
        JOIN public.organizations o2 ON o2.id = om2.organization_id
        WHERE om2.user_id = au.id
          AND om2.is_active = true
          AND (
            SELECT COUNT(*)
            FROM public.organization_members om3
            WHERE om3.organization_id = o2.id
              AND om3.is_active = true
          ) > 1
    )
    ORDER BY au.created_at DESC;
END;
$$;
