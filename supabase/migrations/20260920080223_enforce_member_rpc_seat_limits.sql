-- Preserve legacy RPC contracts while closing both unreserved billable-seat paths.
-- No backfill: existing memberships and entitlements remain unchanged.
CREATE OR REPLACE FUNCTION public.add_org_member(org_id_input uuid, user_id_input uuid, role_input text DEFAULT 'member')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_org_owner(org_id_input) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF role_input IS NULL OR role_input NOT IN ('owner', 'admin', 'member') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  -- Serialize the membership lookup with all other seat reservations.
  PERFORM 1 FROM public.organizations WHERE id = org_id_input FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id_input AND role = 'owner'
  ) THEN
    role_input := 'owner';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id_input AND user_id = user_id_input
  ) AND NOT public._org_billable_seats_available(org_id_input) THEN
    RAISE EXCEPTION 'Seat limit reached';
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role, seat_type, is_billable, is_active)
  VALUES (org_id_input, user_id_input, role_input, 'full', true, true)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_org_member(org_id_input uuid, user_id_input uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_role text;
  target_role text;
  target_active boolean;
  target_billable boolean;
BEGIN
  SELECT om.role INTO caller_role
  FROM public.organization_members om
  WHERE om.organization_id = org_id_input
    AND om.user_id = auth.uid()
    AND om.is_active = true;

  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Read the target state after the shared reservation lock is held.
  PERFORM 1 FROM public.organizations WHERE id = org_id_input FOR UPDATE;

  SELECT om.role, om.is_active, om.is_billable
  INTO target_role, target_active, target_billable
  FROM public.organization_members om
  WHERE om.organization_id = org_id_input AND om.user_id = user_id_input;

  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF (target_active IS DISTINCT FROM true OR target_billable IS DISTINCT FROM true)
     AND NOT public._org_billable_seats_available(org_id_input) THEN
    RAISE EXCEPTION 'Seat limit reached';
  END IF;

  UPDATE public.organization_members
  SET is_active = true, is_billable = true, seat_type = COALESCE(seat_type, 'full')
  WHERE organization_id = org_id_input AND user_id = user_id_input;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.add_org_member(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.activate_org_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_org_member(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.activate_org_member(uuid, uuid) TO authenticated, service_role;

-- Keep email and approval lookups inside the same reservation critical section.
CREATE OR REPLACE FUNCTION public.add_org_member_by_email(org_id_input UUID, email_input TEXT, role_input TEXT DEFAULT 'member')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_user UUID;
BEGIN
  IF NOT public.is_org_owner(org_id_input) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF role_input IS NULL OR role_input NOT IN ('owner', 'admin', 'member') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  SELECT id INTO target_user
  FROM auth.users
  WHERE lower(email) = lower(trim(email_input))
  LIMIT 1;

  IF target_user IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Lock before the existence test: a concurrent removal may replace this seat.
  PERFORM 1 FROM public.organizations WHERE id = org_id_input FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id_input AND role = 'owner'
  ) THEN
    role_input := 'owner';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id_input AND user_id = target_user
  ) AND NOT public._org_billable_seats_available(org_id_input) THEN
    RAISE EXCEPTION 'Seat limit reached';
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role, seat_type, is_billable, is_active)
  VALUES (org_id_input, target_user, role_input, 'full', true, true)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN TRUE;
END;
$$;

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
BEGIN
  SELECT r.organization_id, r.user_id, o.name
  INTO org_id, target_user, org_name
  FROM public.organization_join_requests r
  JOIN public.organizations o ON o.id = r.organization_id
  WHERE r.id = request_id_input;

  IF org_id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF NOT public.is_org_admin(org_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- An already-present member may be concurrently removed and replaced.
  PERFORM 1 FROM public.organizations WHERE id = org_id FOR UPDATE;

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

REVOKE ALL ON FUNCTION public.add_org_member_by_email(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_org_join_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_org_member_by_email(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_org_join_request(uuid) TO authenticated, service_role;
