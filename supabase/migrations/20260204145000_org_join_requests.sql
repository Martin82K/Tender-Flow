-- Migration: org_join_requests
-- Date: 2026-02-04
-- Description: Organization join requests + admin approvals

-- 1) Helper: normalize domain
CREATE OR REPLACE FUNCTION public.normalize_email_domain(email_input TEXT)
RETURNS TEXT AS $$
DECLARE
  domain TEXT;
BEGIN
  IF email_input IS NULL THEN
    RETURN NULL;
  END IF;
  domain := split_part(lower(trim(email_input)), '@', 2);
  IF domain = '' THEN
    RETURN NULL;
  END IF;
  RETURN domain;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2) Helper: public email domain list (not auto-requested)
CREATE OR REPLACE FUNCTION public.is_public_email_domain(domain_input TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF domain_input IS NULL THEN
    RETURN TRUE;
  END IF;

  RETURN domain_input = ANY(ARRAY[
    'gmail.com',
    'googlemail.com',
    'seznam.cz',
    'seznam.sk',
    'centrum.cz',
    'volny.cz',
    'atlas.cz',
    'email.cz',
    'icloud.com',
    'me.com',
    'mac.com',
    'outlook.com',
    'hotmail.com',
    'live.com',
    'msn.com',
    'yahoo.com',
    'yahoo.co.uk',
    'proton.me',
    'protonmail.com',
    'zoho.com'
  ]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3) Helper: is org admin/owner
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id_input UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = org_id_input
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_org_owner(org_id_input UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = org_id_input
      AND om.user_id = auth.uid()
      AND om.role = 'owner'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Join requests table
CREATE TABLE IF NOT EXISTS public.organization_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_join_requests_unique
  ON public.organization_join_requests(organization_id, user_id);

ALTER TABLE public.organization_join_requests ENABLE ROW LEVEL SECURITY;

-- User can see own requests, org admins can see all in org
DROP POLICY IF EXISTS "org_join_requests_select" ON public.organization_join_requests;
CREATE POLICY "org_join_requests_select"
ON public.organization_join_requests FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_org_admin(organization_id)
);

-- User can create own request
DROP POLICY IF EXISTS "org_join_requests_insert" ON public.organization_join_requests;
CREATE POLICY "org_join_requests_insert"
ON public.organization_join_requests FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
);

-- Only org admins can update status
DROP POLICY IF EXISTS "org_join_requests_update" ON public.organization_join_requests;
CREATE POLICY "org_join_requests_update"
ON public.organization_join_requests FOR UPDATE
TO authenticated
USING (
  public.is_org_admin(organization_id)
);

-- User can delete own pending request; admin can delete any
DROP POLICY IF EXISTS "org_join_requests_delete" ON public.organization_join_requests;
CREATE POLICY "org_join_requests_delete"
ON public.organization_join_requests FOR DELETE
TO authenticated
USING (
  (user_id = auth.uid() AND status = 'pending')
  OR public.is_org_admin(organization_id)
);

-- 5) RPCs for admin UI
CREATE OR REPLACE FUNCTION public.get_my_organizations()
RETURNS TABLE (
  organization_id UUID,
  organization_name VARCHAR(255),
  member_role VARCHAR(50),
  domain_whitelist TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.name, om.role, o.domain_whitelist
  FROM public.organizations o
  JOIN public.organization_members om ON om.organization_id = o.id
  WHERE om.user_id = auth.uid()
  ORDER BY o.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_org_members(org_id_input UUID)
RETURNS TABLE (
  user_id UUID,
  email VARCHAR(255),
  display_name TEXT,
  role VARCHAR(50),
  joined_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = org_id_input AND om.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT om.user_id, u.email, up.display_name, om.role, om.created_at
  FROM public.organization_members om
  JOIN auth.users u ON u.id = om.user_id
  LEFT JOIN public.user_profiles up ON up.user_id = om.user_id
  WHERE om.organization_id = org_id_input
  ORDER BY om.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_org_join_requests(org_id_input UUID)
RETURNS TABLE (
  request_id UUID,
  user_id UUID,
  email TEXT,
  display_name TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_owner(org_id_input) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT r.id, r.user_id, r.email, up.display_name, r.status, r.created_at
  FROM public.organization_join_requests r
  LEFT JOIN public.user_profiles up ON up.user_id = r.user_id
  WHERE r.organization_id = org_id_input
  ORDER BY r.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_org_join_request(request_id_input UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id UUID;
  target_user UUID;
BEGIN
  SELECT organization_id, user_id INTO org_id, target_user
  FROM public.organization_join_requests
  WHERE id = request_id_input;

  IF org_id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF NOT public.is_org_owner(org_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.organization_join_requests
  SET status = 'approved', decided_at = NOW(), decided_by = auth.uid()
  WHERE id = request_id_input;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id AND role = 'owner'
  ) THEN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (org_id, target_user, 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  ELSE
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (org_id, target_user, 'member')
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  END IF;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_org_join_request(request_id_input UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id UUID;
BEGIN
  SELECT organization_id INTO org_id
  FROM public.organization_join_requests
  WHERE id = request_id_input;

  IF org_id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF NOT public.is_org_owner(org_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.organization_join_requests
  SET status = 'rejected', decided_at = NOW(), decided_by = auth.uid()
  WHERE id = request_id_input;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_organizations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_members(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_join_requests(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_org_join_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_org_join_request(UUID) TO authenticated;

-- 5b) User-facing helpers
CREATE OR REPLACE FUNCTION public.get_my_org_request_status()
RETURNS TABLE (
  organization_id UUID,
  organization_name VARCHAR(255),
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.name, r.status
  FROM public.organization_join_requests r
  JOIN public.organizations o ON o.id = r.organization_id
  WHERE r.user_id = auth.uid()
  ORDER BY r.created_at DESC
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_org_join_by_email(email_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  domain TEXT;
  target_org UUID;
BEGIN
  domain := public.normalize_email_domain(email_input);
  IF domain IS NULL OR public.is_public_email_domain(domain) THEN
    RAISE EXCEPTION 'Public or invalid domain';
  END IF;

  SELECT id INTO target_org
  FROM public.organizations
  WHERE domain = ANY(domain_whitelist)
  LIMIT 1;

  IF target_org IS NULL THEN
    RAISE EXCEPTION 'Organization not found for domain';
  END IF;

  INSERT INTO public.organization_join_requests (organization_id, user_id, email)
  VALUES (target_org, auth.uid(), email_input)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_org_request_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_org_join_by_email(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_org_member(org_id_input UUID, user_id_input UUID, role_input TEXT DEFAULT 'member')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_owner(org_id_input) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF role_input NOT IN ('owner', 'admin', 'member') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id_input AND role = 'owner'
  ) THEN
    role_input := 'owner';
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (org_id_input, user_id_input, role_input)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_org_member(UUID, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_org_member_by_email(org_id_input UUID, email_input TEXT, role_input TEXT DEFAULT 'member')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user UUID;
BEGIN
  IF NOT public.is_org_owner(org_id_input) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF role_input NOT IN ('owner', 'admin', 'member') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  SELECT id INTO target_user
  FROM auth.users
  WHERE lower(email) = lower(trim(email_input))
  LIMIT 1;

  IF target_user IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id_input AND role = 'owner'
  ) THEN
    role_input := 'owner';
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (org_id_input, target_user, role_input)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_org_member_by_email(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_org_member_role(org_id_input UUID, user_id_input UUID, role_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_owner(org_id_input) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF role_input NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  UPDATE public.organization_members
  SET role = role_input
  WHERE organization_id = org_id_input AND user_id = user_id_input;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_org_ownership(org_id_input UUID, new_owner_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_owner(org_id_input) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Demote all owners to admin
  UPDATE public.organization_members
  SET role = 'admin'
  WHERE organization_id = org_id_input
    AND role = 'owner';

  -- Promote target to owner (must exist)
  UPDATE public.organization_members
  SET role = 'owner'
  WHERE organization_id = org_id_input
    AND user_id = new_owner_user_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_org_member_role(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_org_ownership(UUID, UUID) TO authenticated;

-- 6) Auto-create join request on registration (non-public domains only)
CREATE OR REPLACE FUNCTION public.maybe_create_org_join_request(user_id_input UUID, email_input TEXT)
RETURNS VOID AS $$
DECLARE
  domain TEXT;
  target_org UUID;
BEGIN
  domain := public.normalize_email_domain(email_input);
  IF domain IS NULL OR public.is_public_email_domain(domain) THEN
    RETURN;
  END IF;

  SELECT id INTO target_org
  FROM public.organizations
  WHERE domain = ANY(domain_whitelist)
  LIMIT 1;

  IF target_org IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = target_org AND user_id = user_id_input
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.organization_join_requests (organization_id, user_id, email)
  VALUES (target_org, user_id_input, email_input)
  ON CONFLICT (organization_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user_org_request()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.maybe_create_org_join_request(NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_org_join_request ON auth.users;
CREATE TRIGGER tr_org_join_request
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user_org_request();
