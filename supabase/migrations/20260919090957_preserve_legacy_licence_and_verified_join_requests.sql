-- Preserve trusted cross-user licence evaluation without exposing its details.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE OR REPLACE FUNCTION private.effective_user_tier_internal(target_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  result_tier text;
  result_source text;
  result_end timestamptz;
  result_status text;
BEGIN
  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object('tier', 'free', 'source', 'default', 'status', 'expired');
  END IF;
  IF public.is_platform_admin(target_user_id) THEN
    RETURN jsonb_build_object('tier', 'admin', 'source', 'platform_admin', 'status', 'active');
  END IF;

  SELECT e.tier, e.source, e.valid_until, e.status INTO result_tier, result_source, result_end, result_status
  FROM (
    SELECT
      CASE WHEN o.override_tier IS NOT NULL AND (o.override_expires_at IS NULL OR o.override_expires_at > now())
        THEN o.override_tier ELSE o.subscription_tier END AS tier,
      CASE WHEN o.override_tier IS NOT NULL AND (o.override_expires_at IS NULL OR o.override_expires_at > now())
        THEN 'org_override' ELSE 'org_subscription' END AS source,
      CASE WHEN o.override_tier IS NOT NULL AND (o.override_expires_at IS NULL OR o.override_expires_at > now())
        THEN o.override_expires_at ELSE o.access_end END AS valid_until,
      CASE WHEN o.override_tier IS NOT NULL AND (o.override_expires_at IS NULL OR o.override_expires_at > now())
        THEN 'active' ELSE o.subscription_status END AS status
    FROM (SELECT org.*, CASE WHEN left(org.billing_customer_id, 4) = 'cus_' THEN org.expires_at
      ELSE COALESCE(org.billing_period_end, org.expires_at) END AS access_end
      FROM public.organizations org) o
    JOIN public.organization_members om ON om.organization_id = o.id
    WHERE om.user_id = target_user_id AND om.is_active = true
      AND (
        o.type IS DISTINCT FROM 'personal'
        OR o.subscription_status IS DISTINCT FROM 'trial'
        OR (
          o.override_tier IS NOT NULL
          AND (o.override_expires_at IS NULL OR o.override_expires_at > now())
        )
        OR NOT EXISTS (
          SELECT 1
          FROM public.organization_members bm
          JOIN public.organizations bo ON bo.id = bm.organization_id
          WHERE bm.user_id = target_user_id
            AND bm.is_active = true
            AND bo.type = 'business'
        )
      )
      AND (
        (o.override_tier IS NOT NULL AND (o.override_expires_at IS NULL OR o.override_expires_at > now()))
        OR (o.subscription_status = 'active' AND (o.access_end IS NULL OR o.access_end > now()))
        OR (o.subscription_status IN ('trial', 'cancelled', 'canceled', 'pending', 'past_due') AND o.access_end > now())
      )
  ) e
  WHERE e.tier IN ('starter', 'pro', 'enterprise')
  ORDER BY public._tier_rank(e.tier) DESC, e.valid_until DESC NULLS FIRST
  LIMIT 1;

  IF result_tier IS NOT NULL THEN
    RETURN jsonb_build_object('tier', result_tier, 'source', result_source, 'validUntil', result_end, 'status', result_status);
  END IF;

  SELECT COALESCE(up.subscription_tier_override, up.stripe_subscription_tier),
    CASE WHEN up.subscription_status = 'trial' THEN least(up.trial_ends_at, up.subscription_expires_at)
      ELSE up.subscription_expires_at END,
    up.subscription_status
  INTO result_tier, result_end, result_status
  FROM public.user_profiles up
  WHERE up.user_id = target_user_id
    AND (
      (up.subscription_status = 'active' AND (up.subscription_expires_at IS NULL OR up.subscription_expires_at > now()))
      OR (
        up.subscription_status = 'trial'
        AND up.trial_ends_at > now()
        AND (up.subscription_expires_at IS NULL OR up.subscription_expires_at > now())
        AND NOT EXISTS (
          SELECT 1
          FROM public.organization_members om
          JOIN public.organizations o ON o.id = om.organization_id
          WHERE om.user_id = target_user_id
            AND om.is_active = true
            AND o.type = 'business'
        )
      )
      OR (up.subscription_status IN ('cancelled', 'canceled') AND up.subscription_expires_at > now())
    );
  IF result_tier IN ('starter', 'pro', 'enterprise') THEN
    RETURN jsonb_build_object('tier', result_tier, 'source', 'user_legacy', 'validUntil', result_end, 'status', result_status);
  END IF;
  RETURN jsonb_build_object('tier', 'free', 'source', 'default', 'status', 'expired');
END;
$$;

REVOKE ALL ON FUNCTION private.effective_user_tier_internal(uuid) FROM PUBLIC, anon, authenticated, tenderflow_mcp_client, service_role;
CREATE OR REPLACE FUNCTION public.get_effective_user_tier(target_user_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- PostgREST callers may inspect themselves; platform admins and trusted
  -- server/database roles retain cross-user operational access.
  IF (
    auth.role() = 'service_role'
    OR (auth.role() IS NULL AND current_setting('role', true) IN ('none', 'postgres', 'supabase_admin', 'service_role'))
    OR (auth.uid() IS NOT NULL AND (target_user_id = auth.uid() OR public.is_platform_admin(auth.uid())))
  ) IS NOT TRUE THEN
    RAISE EXCEPTION 'Not authorized to inspect this subscription' USING ERRCODE = '42501';
  END IF;
  RETURN private.effective_user_tier_internal(target_user_id);
END $$;
CREATE OR REPLACE FUNCTION private.resource_subscription_tier(org_id uuid, owner_id uuid, actor_id uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE o public.organizations%ROWTYPE; access_end timestamptz; tier text;
BEGIN
  IF actor_id IS NULL THEN RETURN 'free'; END IF;
  IF public.is_platform_admin(actor_id) THEN RETURN 'admin'; END IF;
  -- Legacy rows without an organization belong to the recorded owner's account.
  -- Never infer a different organization from the viewer's memberships.
  IF org_id IS NULL THEN RETURN COALESCE(private.effective_user_tier_internal(COALESCE(owner_id,actor_id))->>'tier','free'); END IF;
  SELECT * INTO o FROM public.organizations WHERE id=org_id;
  IF NOT FOUND THEN RETURN 'free'; END IF;
  access_end := CASE WHEN left(o.billing_customer_id,4)='cus_' THEN o.expires_at ELSE COALESCE(o.billing_period_end,o.expires_at) END;
  IF o.override_tier IS NOT NULL AND (o.override_expires_at IS NULL OR o.override_expires_at > now()) THEN
    tier := o.override_tier;
  ELSIF (o.subscription_status='active' AND (access_end IS NULL OR access_end > now()))
    OR (o.subscription_status IN ('trial','cancelled','canceled','pending','past_due') AND access_end > now()) THEN
    tier := o.subscription_tier;
  END IF;
  IF tier IN ('starter','pro','enterprise') THEN RETURN tier; END IF;
  -- A historical personal subscription can license its owner's personal space,
  -- but must never license a business organization or a different personal org.
  IF o.type='personal' THEN
    SELECT COALESCE(up.subscription_tier_override,up.stripe_subscription_tier) INTO tier
    FROM public.user_profiles up WHERE up.user_id=o.owner_user_id AND (
      (up.subscription_status='active' AND (up.subscription_expires_at IS NULL OR up.subscription_expires_at > now()))
      OR (up.subscription_status='trial' AND up.trial_ends_at > now() AND (up.subscription_expires_at IS NULL OR up.subscription_expires_at > now()))
      OR (up.subscription_status IN ('cancelled','canceled') AND up.subscription_expires_at > now())
    );
    IF tier IN ('starter','pro','enterprise') THEN RETURN tier; END IF;
  END IF;
  RETURN 'free';
END $$;

CREATE OR REPLACE FUNCTION public.maybe_create_org_join_request(user_id_input UUID, email_input TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  domain TEXT;
  target_org UUID;
  normalized_email TEXT;
  auth_user_email TEXT;
BEGIN
  -- This helper is intended for auth.users trigger execution or trusted backend code.
  -- Direct client calls must use request_org_join_by_email(), which derives identity from auth.uid().
  IF COALESCE(auth.role(), '') <> 'service_role' AND pg_trigger_depth() = 0 THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  normalized_email := lower(trim(email_input));
  IF user_id_input IS NULL OR normalized_email IS NULL OR normalized_email = '' THEN
    RETURN;
  END IF;

  SELECT lower(trim(u.email))
  INTO auth_user_email
  FROM auth.users u
  WHERE u.id = user_id_input AND u.email_confirmed_at IS NOT NULL;

  IF auth_user_email IS NULL OR auth_user_email <> normalized_email THEN
    RETURN;
  END IF;

  domain := public.normalize_email_domain(normalized_email);
  IF domain IS NULL OR public.is_public_email_domain(domain) THEN
    RETURN;
  END IF;

  SELECT id INTO target_org
  FROM public.organizations
  WHERE domain = ANY(domain_whitelist)
  ORDER BY id
  LIMIT 1;

  IF target_org IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = target_org
      AND om.user_id = user_id_input
      AND COALESCE(om.is_active, true) = true
  ) THEN
    UPDATE public.organization_join_requests SET status='approved', decided_at=now(), decided_by=NULL
    WHERE organization_id=target_org AND user_id=user_id_input AND status='pending';
    RETURN;
  END IF;

  INSERT INTO public.organization_join_requests (organization_id, user_id, email)
  VALUES (target_org, user_id_input, normalized_email)
  ON CONFLICT (organization_id, user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.maybe_create_org_join_request(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.maybe_create_org_join_request(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.maybe_create_org_join_request(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.maybe_create_org_join_request(UUID, TEXT) TO service_role;


-- Keep the legacy email-update path, but validate ownership and reserve seats
-- under the same locks as initial provisioning.
CREATE OR REPLACE FUNCTION public.assign_org_membership_by_domain(user_id_input uuid, email_input text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE domain text; target_org uuid; next_role text;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' AND pg_trigger_depth() = 0 THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=user_id_input AND u.email_confirmed_at IS NOT NULL AND lower(trim(u.email))=lower(trim(email_input))) THEN RETURN; END IF;
  domain := public.normalize_email_domain(email_input);
  IF domain IS NULL OR public.is_public_email_domain(domain) THEN RETURN; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tenderflow.org-domain:' || domain,0));
  SELECT id INTO target_org FROM public.organizations WHERE domain=ANY(domain_whitelist) ORDER BY id LIMIT 1 FOR UPDATE;
  IF target_org IS NULL THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id=target_org AND user_id=user_id_input) THEN RETURN; END IF;
  IF NOT public._org_billable_seats_available(target_org) THEN
    PERFORM public.maybe_create_org_join_request(user_id_input,email_input);
    RETURN;
  END IF;
  next_role := CASE WHEN EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id=target_org) THEN 'member' ELSE 'owner' END;
  INSERT INTO public.organization_members(organization_id,user_id,role) VALUES(target_org,user_id_input,next_role) ON CONFLICT(organization_id,user_id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.assign_org_membership_by_domain(uuid,text) FROM PUBLIC,anon,authenticated,tenderflow_mcp_client;
GRANT EXECUTE ON FUNCTION public.assign_org_membership_by_domain(uuid,text) TO service_role;

-- Runs after on_auth_user_email_confirmed_org, so an automatic join closes an
-- old pending request while a full company gets one request only after proof.
DROP TRIGGER IF EXISTS tr_org_join_request_confirmed ON auth.users;
CREATE TRIGGER tr_org_join_request_confirmed AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.handle_new_auth_user_org_request();

CREATE OR REPLACE FUNCTION private.guard_verified_join_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status='approved' AND NOT EXISTS(SELECT 1 FROM auth.users WHERE id=NEW.user_id AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Email must be verified before organization approval' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_verified_join_approval() FROM PUBLIC,anon,authenticated,tenderflow_mcp_client,service_role;
CREATE TRIGGER verified_org_join_approval BEFORE INSERT OR UPDATE ON public.organization_join_requests
FOR EACH ROW EXECUTE FUNCTION private.guard_verified_join_approval();
COMMIT;
