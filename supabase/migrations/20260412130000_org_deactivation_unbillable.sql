-- Migration: org_deactivation_unbillable
-- Date: 2026-04-12
-- Description: Update deactivate/activate RPC to toggle is_billable alongside is_active,
--   so deactivated members don't consume paid seats.

-- deactivate_org_member: also set is_billable = false
CREATE OR REPLACE FUNCTION public.deactivate_org_member(org_id_input UUID, user_id_input UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  target_role TEXT;
BEGIN
  SELECT om.role INTO caller_role
  FROM public.organization_members om
  WHERE om.organization_id = org_id_input AND om.user_id = auth.uid();

  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT om.role INTO target_role
  FROM public.organization_members om
  WHERE om.organization_id = org_id_input AND om.user_id = user_id_input;

  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot deactivate owner. Transfer ownership first.';
  END IF;

  IF caller_role = 'admin' AND target_role = 'admin' THEN
    RAISE EXCEPTION 'Admin cannot deactivate another admin';
  END IF;

  IF user_id_input = auth.uid() THEN
    RAISE EXCEPTION 'Cannot deactivate yourself';
  END IF;

  UPDATE public.organization_members
  SET is_active = false, is_billable = false
  WHERE organization_id = org_id_input AND user_id = user_id_input;

  RETURN TRUE;
END;
$$;

-- activate_org_member: also set is_billable = true
CREATE OR REPLACE FUNCTION public.activate_org_member(org_id_input UUID, user_id_input UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  target_role TEXT;
BEGIN
  SELECT om.role INTO caller_role
  FROM public.organization_members om
  WHERE om.organization_id = org_id_input AND om.user_id = auth.uid();

  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT om.role INTO target_role
  FROM public.organization_members om
  WHERE om.organization_id = org_id_input AND om.user_id = user_id_input;

  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  UPDATE public.organization_members
  SET is_active = true, is_billable = true
  WHERE organization_id = org_id_input AND user_id = user_id_input;

  RETURN TRUE;
END;
$$;
