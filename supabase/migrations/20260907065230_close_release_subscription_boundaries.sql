-- Restore authenticated self-service provisioning; signup keeps its trusted internal path.
CREATE OR REPLACE FUNCTION public.get_or_create_user_organization(
    p_user_id UUID DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_display_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_auth_user_id UUID;
    v_auth_email TEXT;
BEGIN
    v_auth_user_id := auth.uid();
    IF v_auth_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT email
    INTO v_auth_email
    FROM auth.users
    WHERE id = v_auth_user_id;

    IF v_auth_email IS NULL OR v_auth_email = '' THEN
        RAISE EXCEPTION 'Authenticated user email not available' USING ERRCODE = '42501';
    END IF;

    IF p_user_id IS NOT NULL AND p_user_id <> v_auth_user_id THEN
        RAISE EXCEPTION 'user_id must match auth.uid()' USING ERRCODE = '42501';
    END IF;

    IF p_email IS NOT NULL AND lower(trim(p_email)) <> lower(trim(v_auth_email)) THEN
        RAISE EXCEPTION 'email must match authenticated user' USING ERRCODE = '42501';
    END IF;

    RETURN public.get_or_create_user_organization_internal(
        v_auth_user_id,
        v_auth_email,
        p_display_name
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_user_organization(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_user_organization(uuid, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_or_create_user_organization_internal(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_user_organization_internal(uuid, text, text) TO service_role;

-- Preserve MCP enforcement and allow only the existing public short-code resolver.
CREATE OR REPLACE FUNCTION public.enforce_subscription_boundary()
RETURNS void LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE request_path text := current_setting('request.path', true);
BEGIN
  PERFORM public.enforce_mcp_backend_boundary();
  IF current_user NOT IN ('authenticated', 'tenderflow_mcp_client') THEN RETURN; END IF;
  IF public.has_active_subscription() THEN RETURN; END IF;

  -- Authentication/bootstrap, subscription recovery and legal consent only.
  -- Existing RLS/privilege checks still apply to these routes.
  IF request_path = ANY (ARRAY[
    '/user_profiles', '/profiles', '/user_settings', '/organizations', '/organization_members',
    '/organization_join_requests', '/platform_admins', '/user_roles', '/role_permissions',
    '/permission_definitions', '/organization_role_permissions', '/organization_member_permissions',
    '/org_billing_history', '/subscription_plans', '/subscription_history', '/app_settings',
    '/rpc/get_effective_user_tier', '/rpc/get_user_subscription_tier', '/rpc/has_active_subscription',
    '/rpc/get_user_enabled_features', '/rpc/get_user_enabled_features_v2', '/rpc/check_feature_access',
    '/rpc/get_user_subscription_status', '/rpc/get_user_subscription_details', '/rpc/get_subscription_plans',
    '/rpc/is_platform_admin', '/rpc/is_admin', '/rpc/get_or_create_profile',
    '/rpc/get_or_create_user_organization', '/rpc/get_my_organizations', '/rpc/get_my_org_ids',
    '/rpc/get_my_org_request_status', '/rpc/request_org_join_by_email', '/rpc/check_email_whitelist',
    '/rpc/accept_current_legal_documents', '/rpc/list_my_auth_devices', '/rpc/upsert_current_auth_device',
    '/rpc/revoke_my_auth_device', '/rpc/log_app_incident', '/rpc/get_short_url_target'
  ]) THEN RETURN; END IF;
  RAISE SQLSTATE 'PT402' USING MESSAGE = 'Active subscription required', DETAIL = 'subscription_required';
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_subscription_boundary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_subscription_boundary() TO anon, authenticated, tenderflow_mcp_client, service_role;
ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.enforce_subscription_boundary';

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
