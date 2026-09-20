BEGIN;

-- Revalidate every approval path, including direct owner UPDATE and automatic closure.
CREATE OR REPLACE FUNCTION private.guard_verified_join_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  current_email text;
  confirmed_at timestamptz;
  request_domain text;
BEGIN
  IF NEW.status <> 'approved' THEN RETURN NEW; END IF;

  -- Direct UPDATE already holds a request row, so it must not wait for earlier
  -- locks held by Auth/RPC. A lock conflict is retryable, never a stale approval.
  SELECT lower(btrim(u.email)),u.email_confirmed_at INTO current_email,confirmed_at
  FROM auth.users u WHERE u.id=NEW.user_id FOR NO KEY UPDATE NOWAIT;
  IF NOT FOUND OR confirmed_at IS NULL OR current_email IS DISTINCT FROM lower(btrim(NEW.email)) THEN
    RAISE EXCEPTION 'Join request email is no longer verified; submit a new request' USING ERRCODE='42501';
  END IF;
  request_domain:=public.normalize_email_domain(current_email);
  IF request_domain IS NULL OR public.is_public_email_domain(request_domain) THEN
    RAISE EXCEPTION 'Company domain is no longer verified' USING ERRCODE='42501';
  END IF;
  IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('tenderflow.org-domain:'||request_domain,0)) THEN
    RAISE EXCEPTION 'Company domain is changing; retry approval' USING ERRCODE='55P03';
  END IF;
  -- Lock the attestation itself too: trusted service-role CRUD may omit advisory locks.
  PERFORM 1 FROM private.verified_organization_domains d
  JOIN public.organizations o ON o.id=d.organization_id
  WHERE d.domain=request_domain AND d.organization_id=NEW.organization_id AND o.type='business'
  FOR SHARE OF d,o NOWAIT;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company domain is no longer verified' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_verified_join_approval() FROM PUBLIC,anon,authenticated,tenderflow_mcp_client,service_role;

CREATE OR REPLACE FUNCTION public.approve_org_join_request(request_id_input UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  org_id UUID;
  target_user UUID;
  org_name TEXT;
  request_email text;
  locked_request public.organization_join_requests%ROWTYPE;
BEGIN
  SELECT r.organization_id, r.user_id, o.name, r.email
  INTO org_id, target_user, org_name, request_email
  FROM public.organization_join_requests r
  JOIN public.organizations o ON o.id = r.organization_id
  WHERE r.id = request_id_input;

  IF org_id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF NOT public.is_org_admin(org_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Match Auth email-change ordering: identity -> domain -> organization -> request.
  -- NO KEY UPDATE blocks email changes but permits membership FK KEY SHARE.
  -- Never hold the organization while waiting on the user's Auth row.
  PERFORM 1 FROM auth.users WHERE id=target_user FOR NO KEY UPDATE;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'tenderflow.org-domain:' || public.normalize_email_domain(request_email),0));
  PERFORM 1 FROM public.organizations WHERE id = org_id FOR UPDATE;
  SELECT * INTO locked_request FROM public.organization_join_requests
  WHERE id=request_id_input FOR UPDATE;
  IF NOT FOUND OR locked_request.organization_id IS DISTINCT FROM org_id
      OR locked_request.user_id IS DISTINCT FROM target_user
      OR locked_request.email IS DISTINCT FROM request_email THEN
    RAISE EXCEPTION 'Join request changed; retry approval' USING ERRCODE='40001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id AND user_id = target_user AND is_active = true
  ) AND NOT public._org_billable_seats_available(org_id) THEN
    RAISE EXCEPTION 'Seat limit reached';
  END IF;

  UPDATE public.organization_join_requests
  SET status = 'approved', decided_at = now(), decided_by = auth.uid()
  WHERE id = request_id_input;

  INSERT INTO public.organization_members (organization_id, user_id, role, seat_type, is_billable, is_active)
  VALUES (org_id, target_user, 'member', 'full', true, true)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  INSERT INTO public.notifications (user_id, type, title, body)
  VALUES (target_user, 'success', 'Schválení v organizaci', 'Byli jste schváleni v organizaci ' || org_name || '.');

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_org_join_request(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.approve_org_join_request(uuid) TO authenticated,service_role;

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
    UPDATE public.organization_join_requests SET email=normalized_email, status='approved', decided_at=now(), decided_by=NULL
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


COMMIT;
