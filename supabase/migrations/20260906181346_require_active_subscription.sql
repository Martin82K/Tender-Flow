-- No Free account: 'free' remains only a backwards-compatible no-access sentinel.
-- Resolve both RPC generations from the same, read-only entitlement rules.
CREATE OR REPLACE FUNCTION public.get_effective_user_tier(target_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  result_tier text;
  result_source text;
  result_end timestamptz;
BEGIN
  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object('tier', 'free', 'source', 'default');
  END IF;
  IF public.is_platform_admin(target_user_id) THEN
    RETURN jsonb_build_object('tier', 'admin', 'source', 'platform_admin');
  END IF;

  SELECT e.tier, e.source, e.valid_until INTO result_tier, result_source, result_end
  FROM (
    SELECT
      CASE WHEN o.override_tier IS NOT NULL AND (o.override_expires_at IS NULL OR o.override_expires_at > now())
        THEN o.override_tier ELSE o.subscription_tier END AS tier,
      CASE WHEN o.override_tier IS NOT NULL AND (o.override_expires_at IS NULL OR o.override_expires_at > now())
        THEN 'org_override' ELSE 'org_subscription' END AS source,
      CASE WHEN o.override_tier IS NOT NULL AND (o.override_expires_at IS NULL OR o.override_expires_at > now())
        THEN o.override_expires_at ELSE COALESCE(o.billing_period_end, o.expires_at) END AS valid_until
    FROM public.organizations o
    JOIN public.organization_members om ON om.organization_id = o.id
    WHERE om.user_id = target_user_id AND om.is_active = true
      AND (
        (o.override_tier IS NOT NULL AND (o.override_expires_at IS NULL OR o.override_expires_at > now()))
        OR (o.subscription_status = 'active' AND (COALESCE(o.billing_period_end, o.expires_at) IS NULL OR COALESCE(o.billing_period_end, o.expires_at) > now()))
        OR (o.subscription_status IN ('trial', 'cancelled', 'canceled') AND COALESCE(o.billing_period_end, o.expires_at) > now())
      )
  ) e
  WHERE e.tier IN ('starter', 'pro', 'enterprise')
  ORDER BY public._tier_rank(e.tier) DESC, e.valid_until DESC NULLS FIRST
  LIMIT 1;

  IF result_tier IS NOT NULL THEN
    RETURN jsonb_build_object('tier', result_tier, 'source', result_source, 'validUntil', result_end);
  END IF;

  -- Legacy personal subscriptions remain valid only for their actual paid/trial period.
  -- Never fall back to an unchecked organization's tier (the old v1 RPC did so).
  SELECT COALESCE(up.subscription_tier_override, up.stripe_subscription_tier),
    CASE WHEN up.subscription_status = 'trial' THEN least(up.trial_ends_at, up.subscription_expires_at)
      ELSE up.subscription_expires_at END
  INTO result_tier, result_end
  FROM public.user_profiles up
  WHERE up.user_id = target_user_id
    AND (
      (up.subscription_status = 'active' AND (up.subscription_expires_at IS NULL OR up.subscription_expires_at > now()))
      OR (up.subscription_status = 'trial' AND up.trial_ends_at > now() AND (up.subscription_expires_at IS NULL OR up.subscription_expires_at > now()))
      OR (up.subscription_status IN ('cancelled', 'canceled') AND up.subscription_expires_at > now())
    );
  IF result_tier IN ('starter', 'pro', 'enterprise') THEN
    RETURN jsonb_build_object('tier', result_tier, 'source', 'user_legacy', 'validUntil', result_end);
  END IF;
  RETURN jsonb_build_object('tier', 'free', 'source', 'default');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_subscription_tier(target_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.get_effective_user_tier(target_user_id)->>'tier';
$$;

CREATE OR REPLACE FUNCTION public.has_active_subscription()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(public.get_effective_user_tier(auth.uid())->>'tier' IN ('starter', 'pro', 'enterprise', 'admin'), false);
$$;
REVOKE ALL ON FUNCTION public.has_active_subscription() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_subscription() TO authenticated, tenderflow_mcp_client, service_role;

CREATE OR REPLACE FUNCTION public.user_has_feature(feature_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tier text := public.get_user_subscription_tier(auth.uid());
BEGIN
  IF v_tier = 'admin' THEN RETURN true; END IF;
  IF v_tier NOT IN ('starter', 'pro', 'enterprise') THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM public.subscription_tier_features stf WHERE stf.tier = v_tier AND stf.feature_key = $1 AND stf.enabled);
END;
$$;

CREATE OR REPLACE FUNCTION public.user_id_has_feature(target_user_id uuid, feature_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tier text := public.get_user_subscription_tier(target_user_id);
BEGIN
  IF v_tier = 'admin' THEN RETURN true; END IF;
  IF v_tier NOT IN ('starter', 'pro', 'enterprise') THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM public.subscription_tier_features stf WHERE stf.tier = v_tier AND stf.feature_key = $2 AND stf.enabled);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_enabled_features_v2()
RETURNS TABLE(feature_key text, feature_name text, feature_description text, feature_category text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tier text := public.get_user_subscription_tier(auth.uid());
BEGIN
  IF v_tier NOT IN ('starter', 'pro', 'enterprise', 'admin') THEN RETURN; END IF;
  RETURN QUERY SELECT sf.key, sf.name, sf.description, sf.category
  FROM public.subscription_features sf
  WHERE v_tier = 'admin' OR EXISTS (
    SELECT 1 FROM public.subscription_tier_features stf WHERE stf.feature_key = sf.key AND stf.tier = v_tier AND stf.enabled
  ) OR EXISTS (
    SELECT 1 FROM public.user_feature_overrides ufo WHERE ufo.feature_key = sf.key AND ufo.user_id = auth.uid()
      AND (ufo.expires_at IS NULL OR ufo.expires_at > now())
  ) ORDER BY sf.sort_order, sf.key;
END;
$$;

-- The v1 shape must remain compatible with older web and desktop clients.
CREATE OR REPLACE FUNCTION public.get_user_enabled_features()
RETURNS TABLE(feature_key text, feature_name text, feature_description text, feature_category text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT * FROM public.get_user_enabled_features_v2();
$$;

-- Compose with the MCP proof boundary; never replace its checks.
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
    '/rpc/revoke_my_auth_device', '/rpc/log_app_incident'
  ]) THEN RETURN; END IF;
  RAISE SQLSTATE 'PT402' USING MESSAGE = 'Active subscription required', DETAIL = 'subscription_required';
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_subscription_boundary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_subscription_boundary() TO anon, authenticated, tenderflow_mcp_client, service_role;
ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.enforce_subscription_boundary';

-- RLS also protects Storage and Realtime, which do not run the REST pre-request hook.
-- Restrictive policies intersect with existing tenant/role policies; they never grant access.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'projects', 'project_shares', 'user_hidden_projects', 'demand_categories', 'bids', 'bid_tags',
    'contracts', 'contract_amendments', 'contract_drawdowns', 'contract_invoices',
    'contract_markdown_versions', 'contract_markdown_access_audit', 'project_amendments',
    'project_contracts', 'project_internal_amendments', 'project_investor_financials',
    'project_investor_invoices', 'project_budget_categories', 'project_budget_items',
    'project_budget_measurements', 'project_budget_sheets', 'project_budgets',
    'project_template_selections', 'tender_plans', 'subcontractors', 'contact_statuses',
    'subcontractor_statuses', 'tasks', 'task_projects', 'templates', 'default_templates',
    'excel_indexer_entries', 'dochub_autocreate_runs', 'dochub_project_folders',
    'backup_history', 'notifications', 'notification_preferences', 'short_urls',
    'mcp_change_proposals', 'microsoft_todo_list_mappings'
  ] LOOP
    EXECUTE format('CREATE POLICY subscription_required ON public.%I AS RESTRICTIVE FOR ALL TO authenticated, tenderflow_mcp_client USING ((SELECT public.has_active_subscription())) WITH CHECK ((SELECT public.has_active_subscription()))', table_name);
  END LOOP;
END;
$$;
CREATE POLICY subscription_required ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated, tenderflow_mcp_client
USING ((SELECT public.has_active_subscription())) WITH CHECK ((SELECT public.has_active_subscription()));

-- Bootstrap is not a purchase. Existing manual paid organizations are unchanged.
ALTER TABLE public.organizations ALTER COLUMN subscription_tier SET DEFAULT 'free';
ALTER TABLE public.organizations ALTER COLUMN subscription_status SET DEFAULT 'expired';

CREATE OR REPLACE FUNCTION public.get_or_create_user_organization(p_user_id uuid, p_email text, p_display_name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_org_id UUID;
    v_domain TEXT;
    v_org_name TEXT;
    v_caller_uid UUID;
    v_verified_email TEXT;
    v_effective_email TEXT;
BEGIN
    IF p_user_id IS NULL OR p_email IS NULL OR p_email = '' THEN
        RAISE EXCEPTION 'user_id and email are required';
    END IF;

    -- Pokud je volání z user contextu, user smí volat jen sám za sebe.
    v_caller_uid := auth.uid();
    IF v_caller_uid IS NOT NULL AND v_caller_uid <> p_user_id THEN
        RAISE EXCEPTION 'unauthorized user context';
    END IF;

    -- Ověření e-mailu proti auth.users.
    SELECT email INTO v_verified_email
    FROM auth.users
    WHERE id = p_user_id;

    IF v_verified_email IS NULL THEN
        RAISE EXCEPTION 'user email not found';
    END IF;

    IF lower(v_verified_email) <> lower(p_email) THEN
        RAISE EXCEPTION 'email mismatch for user';
    END IF;

    v_effective_email := lower(v_verified_email);
    v_domain := split_part(v_effective_email, '@', 2);

    -- Už existující členství.
    SELECT organization_id INTO v_org_id
    FROM public.organization_members
    WHERE user_id = p_user_id
    LIMIT 1;

    IF v_org_id IS NOT NULL THEN
        RETURN v_org_id;
    END IF;

    -- Personal org pro free mail.
    IF public.is_free_email_provider(v_effective_email) THEN
        v_org_name := COALESCE(NULLIF(TRIM(p_display_name), ''), split_part(v_effective_email, '@', 1));

        INSERT INTO public.organizations (name, type, owner_user_id, subscription_tier, subscription_status)
        VALUES (v_org_name, 'personal', p_user_id, 'free', 'expired')
        RETURNING id INTO v_org_id;

        INSERT INTO public.organization_members (organization_id, user_id, role)
        VALUES (v_org_id, p_user_id, 'owner')
        ON CONFLICT (organization_id, user_id) DO NOTHING;

        RETURN v_org_id;
    END IF;

    -- Business org podle domény.
    SELECT id INTO v_org_id
    FROM public.organizations
    WHERE v_domain = ANY(domain_whitelist)
    LIMIT 1;

    IF v_org_id IS NOT NULL THEN
        INSERT INTO public.organization_members (organization_id, user_id, role)
        VALUES (v_org_id, p_user_id, 'member')
        ON CONFLICT (organization_id, user_id) DO NOTHING;

        RETURN v_org_id;
    END IF;

    v_org_name := initcap(split_part(v_domain, '.', 1));

    INSERT INTO public.organizations (name, type, domain_whitelist, owner_user_id, subscription_tier, subscription_status)
    VALUES (v_org_name, 'business', ARRAY[v_domain], p_user_id, 'free', 'expired')
    RETURNING id INTO v_org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (v_org_id, p_user_id, 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    RETURN v_org_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_or_create_user_organization_internal(p_user_id uuid, p_email text, p_display_name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_org_id UUID;
    v_domain TEXT;
    v_org_name TEXT;
BEGIN
    IF p_user_id IS NULL OR p_email IS NULL OR p_email = '' THEN
        RAISE EXCEPTION 'user_id and email are required';
    END IF;

    v_domain := lower(split_part(p_email, '@', 2));

    SELECT organization_id INTO v_org_id
    FROM public.organization_members
    WHERE user_id = p_user_id
    LIMIT 1;

    IF v_org_id IS NOT NULL THEN
        RETURN v_org_id;
    END IF;

    IF public.is_free_email_provider(p_email) THEN
        v_org_name := COALESCE(NULLIF(TRIM(p_display_name), ''), split_part(p_email, '@', 1));

        INSERT INTO public.organizations (name, type, owner_user_id, subscription_tier, subscription_status)
        VALUES (v_org_name, 'personal', p_user_id, 'free', 'expired')
        RETURNING id INTO v_org_id;

        INSERT INTO public.organization_members (organization_id, user_id, role)
        VALUES (v_org_id, p_user_id, 'owner')
        ON CONFLICT (organization_id, user_id) DO NOTHING;

        RETURN v_org_id;
    END IF;

    SELECT id INTO v_org_id
    FROM public.organizations
    WHERE v_domain = ANY(domain_whitelist)
    LIMIT 1;

    IF v_org_id IS NOT NULL THEN
        INSERT INTO public.organization_members (organization_id, user_id, role)
        VALUES (v_org_id, p_user_id, 'member')
        ON CONFLICT (organization_id, user_id) DO NOTHING;

        RETURN v_org_id;
    END IF;

    v_org_name := initcap(split_part(v_domain, '.', 1));

    INSERT INTO public.organizations (name, type, domain_whitelist, owner_user_id, subscription_tier, subscription_status)
    VALUES (v_org_name, 'business', ARRAY[v_domain], p_user_id, 'free', 'expired')
    RETURNING id INTO v_org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (v_org_id, p_user_id, 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    RETURN v_org_id;
END;
$function$
;

-- Historical free flags must not be presented as an available plan by older clients.
UPDATE public.subscription_plans SET is_visible = false WHERE tier = 'free' AND is_visible;
UPDATE public.subscription_tier_features SET enabled = false WHERE tier = 'free' AND enabled;
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
