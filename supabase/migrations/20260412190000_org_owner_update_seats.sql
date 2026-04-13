-- Migration: org_owner_update_seats
-- Date: 2026-04-12
-- Description: Allow org owners to update max_seats for their organization.

CREATE OR REPLACE FUNCTION public.org_owner_update_seats(
  target_org_id UUID,
  new_max_seats INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_billable INTEGER;
BEGIN
  -- Check caller is owner of the org
  SELECT role INTO v_role
  FROM public.organization_members
  WHERE organization_id = target_org_id
    AND user_id = auth.uid()
    AND is_active = true;

  IF v_role IS NULL OR v_role != 'owner' THEN
    RAISE EXCEPTION 'Only the organization owner can update seats';
  END IF;

  -- Validate new seat count
  IF new_max_seats < 1 THEN
    RAISE EXCEPTION 'Minimum seat count is 1';
  END IF;

  -- Cannot go below current billable members
  SELECT COUNT(*) INTO v_billable
  FROM public.organization_members
  WHERE organization_id = target_org_id
    AND is_billable = true
    AND is_active = true;

  IF new_max_seats < v_billable THEN
    RAISE EXCEPTION 'Cannot reduce seats below current billable members (%)' , v_billable;
  END IF;

  UPDATE public.organizations
  SET max_seats = new_max_seats
  WHERE id = target_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.org_owner_update_seats(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_owner_update_seats(UUID, INTEGER) TO service_role;
