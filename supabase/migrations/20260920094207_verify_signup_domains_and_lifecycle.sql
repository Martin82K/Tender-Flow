-- Email ownership is not proof of company-domain ownership. No automatic backfill.
BEGIN;
CREATE TABLE private.verified_organization_domains (
  domain text PRIMARY KEY CHECK (domain = lower(btrim(domain)) AND length(domain) <= 253),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  verified_at timestamptz NOT NULL DEFAULT now(),
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  evidence text NOT NULL CHECK (length(btrim(evidence)) >= 10)
);
CREATE INDEX verified_organization_domains_org_idx ON private.verified_organization_domains(organization_id);
CREATE INDEX verified_organization_domains_verifier_idx ON private.verified_organization_domains(verified_by);
ALTER TABLE private.verified_organization_domains ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.verified_organization_domains FROM PUBLIC, anon, authenticated, tenderflow_mcp_client;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.verified_organization_domains TO service_role;
CREATE POLICY service_manage_verified_domains ON private.verified_organization_domains TO service_role USING (true) WITH CHECK (true);

-- The operator must first verify domain control externally (e.g. a DNS TXT challenge).
-- Ordinary organization owners cannot attest domains or move an attestation.
CREATE OR REPLACE FUNCTION public.admin_set_verified_org_domain(
  target_org_id uuid, domain_input text, verification_evidence text, enabled boolean DEFAULT true
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_domain text := lower(btrim(domain_input));
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT (
    public.is_platform_admin(auth.uid()) AND COALESCE(auth.jwt()->>'aal','')='aal2'
  ) THEN RAISE EXCEPTION 'Platform admin with MFA required' USING ERRCODE='42501'; END IF;
  IF v_domain IS NULL OR length(v_domain)>253 OR v_domain !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
     OR public.is_public_email_domain(v_domain) THEN RAISE EXCEPTION 'Invalid company domain'; END IF;
  IF enabled IS NULL THEN RAISE EXCEPTION 'Verification state is required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tenderflow.org-domain:'||v_domain,0));
  IF NOT enabled THEN
    DELETE FROM private.verified_organization_domains WHERE organization_id=target_org_id AND verified_organization_domains.domain=v_domain;
    RETURN true;
  END IF;
  IF verification_evidence IS NULL OR length(btrim(verification_evidence))<10 THEN RAISE EXCEPTION 'Domain control evidence is required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=target_org_id AND type='business') THEN RAISE EXCEPTION 'Business organization required'; END IF;
  IF EXISTS(SELECT 1 FROM private.verified_organization_domains d WHERE d.domain=v_domain AND d.organization_id<>target_org_id) THEN
    RAISE EXCEPTION 'Domain is already verified for another organization';
  END IF;
  INSERT INTO private.verified_organization_domains(domain,organization_id,verified_by,evidence)
  VALUES(v_domain,target_org_id,auth.uid(),btrim(verification_evidence))
  ON CONFLICT ON CONSTRAINT verified_organization_domains_pkey DO UPDATE
    SET verified_at=now(),verified_by=auth.uid(),evidence=EXCLUDED.evidence;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_verified_org_domain(uuid,text,text,boolean) FROM PUBLIC,anon,tenderflow_mcp_client;
GRANT EXECUTE ON FUNCTION public.admin_set_verified_org_domain(uuid,text,text,boolean) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.get_or_create_user_organization_internal(
  p_user_id uuid,
  p_email text,
  p_display_name text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_domain text;
  v_org_name text;
  v_created_at timestamptz;
  v_trial_end timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'user_id and email are required';
  END IF;

  -- Unverified signups must not claim a company domain or reserve a seat.
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = p_user_id AND email_confirmed_at IS NOT NULL
  ) THEN
    RETURN NULL;
  END IF;

  v_domain := public.normalize_email_domain(p_email);

  SELECT om.organization_id INTO v_org_id
  FROM public.organization_members om JOIN public.organizations o ON o.id=om.organization_id
  WHERE om.user_id = p_user_id
  ORDER BY (om.is_active IS DISTINCT FROM false) DESC, (o.type='business') DESC, o.id
  LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    RETURN v_org_id;
  END IF;

  v_created_at := now();
  v_trial_end := public._org_signup_trial_deadline(v_created_at);

  IF v_domain IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tenderflow.org-domain:' || v_domain, 0));
  END IF;
  SELECT o.id INTO v_org_id FROM public.organizations o
  JOIN private.verified_organization_domains d ON d.organization_id=o.id
  WHERE d.domain=v_domain AND o.type='business' FOR UPDATE OF o;

  IF v_org_id IS NULL THEN
    v_org_name := left(COALESCE(NULLIF(TRIM(p_display_name), ''), split_part(p_email, '@', 1)),255);

    INSERT INTO public.organizations (
      name, type, owner_user_id, subscription_tier, subscription_status,
      created_at, billing_period_start, billing_period_end, expires_at
    ) VALUES (
      v_org_name, 'personal', p_user_id, 'enterprise', 'trial',
      v_created_at, v_created_at, v_trial_end, v_trial_end
    )
    RETURNING id INTO v_org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (v_org_id, p_user_id, 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    RETURN v_org_id;
  END IF;

  IF v_org_id IS NOT NULL THEN
    IF public._org_billable_seats_available(v_org_id) THEN
      INSERT INTO public.organization_members (organization_id, user_id, role)
      VALUES (v_org_id, p_user_id, 'member')
      ON CONFLICT (organization_id, user_id) DO NOTHING;

      -- Legacy profiles can still carry a personal Pro trial. Joining an
      -- existing organization inherits that org's entitlement, including the wall.
      -- Authenticated recovery cannot write protected profile columns; the
      -- resolver already ignores personal trials for org members.
      IF auth.role() IS DISTINCT FROM 'authenticated' OR auth.uid() IS NULL THEN
        UPDATE public.user_profiles
        SET
          subscription_status = 'expired',
          trial_ends_at = LEAST(COALESCE(trial_ends_at, now()), now() - interval '1 second'),
          updated_at = now()
        WHERE user_id = p_user_id
          AND subscription_status = 'trial'
          AND subscription_tier_override IS NULL;
      END IF;

      RETURN v_org_id;
    END IF;

    -- Seat limit reached: do not exceed licensed seats and do not clone the
    -- company tenant or mint another trial. Keep a personal workspace behind the licence wall.
    v_org_name := left(COALESCE(NULLIF(TRIM(p_display_name), ''), split_part(p_email, '@', 1)),255);

    INSERT INTO public.organizations (
      name, type, owner_user_id, subscription_tier, subscription_status,
      created_at, billing_period_start, billing_period_end, expires_at
    ) VALUES (
      v_org_name, 'personal', p_user_id, 'free', 'expired',
      v_created_at, v_created_at, v_created_at, v_created_at
    )
    RETURNING id INTO v_org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (v_org_id, p_user_id, 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    RETURN v_org_id;
  END IF;

END;
$$;

CREATE OR REPLACE FUNCTION public.maybe_create_org_join_request(user_id_input UUID, email_input TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_domain TEXT;
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

  v_domain := public.normalize_email_domain(normalized_email);
  IF v_domain IS NULL OR public.is_public_email_domain(v_domain) THEN
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tenderflow.org-domain:'||v_domain,0));
  SELECT o.id INTO target_org
  FROM public.organizations o JOIN private.verified_organization_domains d ON d.organization_id=o.id
  WHERE d.domain=v_domain AND o.type='business'
  FOR UPDATE OF o;

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
DECLARE v_domain text; target_org uuid; next_role text;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' AND pg_trigger_depth() = 0 THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=user_id_input AND u.email_confirmed_at IS NOT NULL AND lower(trim(u.email))=lower(trim(email_input))) THEN RETURN; END IF;
  v_domain := public.normalize_email_domain(email_input);
  IF v_domain IS NULL OR public.is_public_email_domain(v_domain) THEN RETURN; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tenderflow.org-domain:' || v_domain,0));
  SELECT o.id INTO target_org FROM public.organizations o JOIN private.verified_organization_domains d ON d.organization_id=o.id WHERE d.domain=v_domain AND o.type='business' FOR UPDATE OF o;
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

-- Version the existing production email-change hook for clean installations.
CREATE OR REPLACE FUNCTION public.handle_auth_user_email_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    PERFORM public.assign_org_membership_by_domain(NEW.id,NEW.email);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.handle_auth_user_email_update() FROM PUBLIC,anon,authenticated,tenderflow_mcp_client;
GRANT EXECUTE ON FUNCTION public.handle_auth_user_email_update() TO service_role;
DROP TRIGGER IF EXISTS tr_auto_org_membership_email_update ON auth.users;
CREATE TRIGGER tr_auto_org_membership_email_update AFTER UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_email_update();

CREATE OR REPLACE FUNCTION public.request_org_join_by_email(email_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_auth_email TEXT;
  v_domain TEXT;
  target_org UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT lower(trim(email))
  INTO v_auth_email
  FROM auth.users
  WHERE id = v_user_id AND email_confirmed_at IS NOT NULL;

  IF v_auth_email IS NULL OR v_auth_email = '' THEN
    RAISE EXCEPTION 'Authenticated user email not available';
  END IF;

  IF email_input IS NOT NULL AND lower(trim(email_input)) <> v_auth_email THEN
    RAISE EXCEPTION 'email must match authenticated user';
  END IF;

  v_domain := public.normalize_email_domain(v_auth_email);
  IF v_domain IS NULL OR public.is_public_email_domain(v_domain) THEN
    RAISE EXCEPTION 'Public or invalid domain';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tenderflow.org-domain:'||v_domain,0));
  SELECT o.id INTO target_org FROM public.organizations o
  JOIN private.verified_organization_domains d ON d.organization_id=o.id
  WHERE d.domain=v_domain AND o.type='business' FOR UPDATE OF o;

  IF target_org IS NULL THEN
    RAISE EXCEPTION 'Organization not found for domain';
  END IF;

  INSERT INTO public.organization_join_requests (organization_id, user_id, email)
  VALUES (target_org, v_user_id, v_auth_email)
  ON CONFLICT (organization_id, user_id) DO UPDATE SET
    email = EXCLUDED.email,
    status = 'pending',
    decided_at = NULL,
    decided_by = NULL;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_org_join_by_email(TEXT) TO authenticated;


CREATE OR REPLACE FUNCTION private.can_request_verified_org_join(target_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN private.verified_organization_domains d ON d.domain=public.normalize_email_domain(u.email)
    JOIN public.organizations o ON o.id=d.organization_id AND o.type='business'
    WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL AND d.organization_id=target_org_id
  );
$$;
REVOKE ALL ON FUNCTION private.can_request_verified_org_join(uuid) FROM PUBLIC,anon,tenderflow_mcp_client;
GRANT EXECUTE ON FUNCTION private.can_request_verified_org_join(uuid) TO authenticated;
DROP POLICY IF EXISTS org_join_requests_insert ON public.organization_join_requests;
CREATE POLICY org_join_requests_insert ON public.organization_join_requests FOR INSERT TO authenticated
WITH CHECK (user_id=(SELECT auth.uid())
  AND lower(trim(email))=lower(trim(COALESCE((SELECT auth.jwt())->>'email','')))
  AND private.can_request_verified_org_join(organization_id));
REVOKE ALL ON FUNCTION public.request_org_join_by_email(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_org_join_by_email(text) TO authenticated,service_role;

-- Preserve confirmed OAuth/admin inserts; only the first confirmation sends welcome.
-- Both historical INSERT triggers called the same mail handler.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_send_email ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_confirmed_send_email ON auth.users;
CREATE TRIGGER on_auth_user_created_send_email AFTER INSERT ON auth.users
FOR EACH ROW WHEN (NEW.email_confirmed_at IS NOT NULL) EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER on_auth_user_confirmed_send_email AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.admin_update_org_subscription(
  target_org_id UUID,
  new_tier TEXT DEFAULT NULL,
  new_max_seats INTEGER DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  new_status TEXT DEFAULT NULL,
  new_billing_period TEXT DEFAULT NULL,
  new_billing_period_start TIMESTAMPTZ DEFAULT NULL,
  new_billing_period_end TIMESTAMPTZ DEFAULT NULL,
  new_billing_contact TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_billable INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  IF new_tier IS NOT NULL AND new_tier NOT IN ('free', 'enterprise') THEN
    RAISE EXCEPTION 'Only free and enterprise plans are active';
  END IF;

  IF new_status IS NOT NULL AND new_status NOT IN ('trial', 'active', 'past_due', 'paused', 'canceled') THEN
    RAISE EXCEPTION 'Invalid subscription status';
  END IF;

  IF new_billing_period IS NOT NULL AND new_billing_period NOT IN ('monthly', 'yearly') THEN
    RAISE EXCEPTION 'Invalid billing period';
  END IF;

  PERFORM 1 FROM public.organizations WHERE id=target_org_id FOR UPDATE;

  IF new_max_seats IS NOT NULL THEN
    SELECT COUNT(*) INTO v_billable
    FROM public.organization_members
    WHERE organization_id = target_org_id
      AND is_billable = true
      AND is_active = true;

    IF new_max_seats < GREATEST(v_billable, 1) THEN
      RAISE EXCEPTION 'Cannot reduce seats below current billable members (%)', v_billable;
    END IF;
  END IF;

  UPDATE public.organizations SET
    subscription_tier = COALESCE(new_tier, subscription_tier, 'enterprise'),
    subscription_status = COALESCE(new_status, subscription_status, 'active'),
    max_seats = COALESCE(new_max_seats, max_seats, 1),
    billing_period = COALESCE(new_billing_period, billing_period, 'yearly'),
    billing_period_start = COALESCE(new_billing_period_start, billing_period_start),
    billing_period_end = COALESCE(new_billing_period_end, billing_period_end),
    billing_contact = COALESCE(new_billing_contact, billing_contact),
    expires_at = COALESCE(new_billing_period_end, expires_at),
    override_tier = COALESCE(new_tier, override_tier),
    override_reason = COALESCE(p_reason, override_reason),
    override_granted_by = auth.uid()
  WHERE id = target_org_id;
END;
$$;


COMMIT;
