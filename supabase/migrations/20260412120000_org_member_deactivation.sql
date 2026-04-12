-- Migration: org_member_deactivation
-- Date: 2026-04-12
-- Description: Add member deactivation (soft-disable) and removal from organization.
--   Adds is_active column to organization_members, updates get_org_members to include it,
--   and creates RPC functions for deactivate, activate, and remove member.

-- =============================================================================
-- 1. ALTER organization_members — add is_active column
-- =============================================================================

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- =============================================================================
-- 2. UPDATE get_org_members to include is_active
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_org_members(UUID);

CREATE OR REPLACE FUNCTION public.get_org_members(org_id_input UUID)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  role TEXT,
  joined_at TIMESTAMPTZ,
  is_active BOOLEAN
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
  SELECT q.user_id, q.email, q.display_name, q.role, q.joined_at, q.is_active
  FROM (
    SELECT DISTINCT ON (om.user_id)
      om.user_id::UUID AS user_id,
      u.email::TEXT AS email,
      up.display_name::TEXT AS display_name,
      om.role::TEXT AS role,
      om.created_at::TIMESTAMPTZ AS joined_at,
      om.is_active::BOOLEAN AS is_active
    FROM public.organization_members om
    JOIN auth.users u ON u.id = om.user_id
    LEFT JOIN public.user_profiles up ON up.user_id = om.user_id
    WHERE om.organization_id = org_id_input
    ORDER BY om.user_id, om.created_at ASC
  ) AS q
  ORDER BY q.joined_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_org_members(UUID) TO authenticated;

-- =============================================================================
-- 3. deactivate_org_member — soft-disable (owner/admin only, cannot deactivate owner)
-- =============================================================================

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
  -- Get caller's role
  SELECT om.role INTO caller_role
  FROM public.organization_members om
  WHERE om.organization_id = org_id_input AND om.user_id = auth.uid();

  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Only owner and admin can deactivate
  IF caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Get target's role
  SELECT om.role INTO target_role
  FROM public.organization_members om
  WHERE om.organization_id = org_id_input AND om.user_id = user_id_input;

  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  -- Cannot deactivate owner
  IF target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot deactivate owner. Transfer ownership first.';
  END IF;

  -- Admin cannot deactivate another admin (only owner can)
  IF caller_role = 'admin' AND target_role = 'admin' THEN
    RAISE EXCEPTION 'Admin cannot deactivate another admin';
  END IF;

  -- Cannot deactivate yourself
  IF user_id_input = auth.uid() THEN
    RAISE EXCEPTION 'Cannot deactivate yourself';
  END IF;

  UPDATE public.organization_members
  SET is_active = false
  WHERE organization_id = org_id_input AND user_id = user_id_input;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deactivate_org_member(UUID, UUID) TO authenticated;

-- =============================================================================
-- 4. activate_org_member — re-enable a deactivated member (owner/admin only)
-- =============================================================================

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
  -- Get caller's role
  SELECT om.role INTO caller_role
  FROM public.organization_members om
  WHERE om.organization_id = org_id_input AND om.user_id = auth.uid();

  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Verify target exists
  SELECT om.role INTO target_role
  FROM public.organization_members om
  WHERE om.organization_id = org_id_input AND om.user_id = user_id_input;

  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  UPDATE public.organization_members
  SET is_active = true
  WHERE organization_id = org_id_input AND user_id = user_id_input;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_org_member(UUID, UUID) TO authenticated;

-- =============================================================================
-- 5. remove_org_member — hard remove from organization (owner/admin only)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.remove_org_member(org_id_input UUID, user_id_input UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  target_role TEXT;
BEGIN
  -- Get caller's role
  SELECT om.role INTO caller_role
  FROM public.organization_members om
  WHERE om.organization_id = org_id_input AND om.user_id = auth.uid();

  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Only owner and admin can remove
  IF caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Get target's role
  SELECT om.role INTO target_role
  FROM public.organization_members om
  WHERE om.organization_id = org_id_input AND om.user_id = user_id_input;

  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  -- Cannot remove owner
  IF target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot remove owner. Transfer ownership first.';
  END IF;

  -- Admin cannot remove another admin (only owner can)
  IF caller_role = 'admin' AND target_role = 'admin' THEN
    RAISE EXCEPTION 'Admin cannot remove another admin';
  END IF;

  -- Cannot remove yourself
  IF user_id_input = auth.uid() THEN
    RAISE EXCEPTION 'Cannot remove yourself';
  END IF;

  -- Delete the membership
  DELETE FROM public.organization_members
  WHERE organization_id = org_id_input AND user_id = user_id_input;

  -- Also clean up any join requests for this user in this org
  DELETE FROM public.organization_join_requests
  WHERE organization_id = org_id_input AND user_id = user_id_input;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_org_member(UUID, UUID) TO authenticated;

-- =============================================================================
-- 6. Update RLS: deactivated members should not see org data
--    Update is_org_admin and is_org_owner to check is_active
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_org_admin(org_id_input UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = org_id_input
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
      AND om.is_active = true
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
      AND om.is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 7. Update get_effective_user_tier to skip deactivated memberships
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_effective_user_tier(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_tier TEXT;
  result_source TEXT;
  r RECORD;
  v_user_tier TEXT;
BEGIN
  -- Check all ACTIVE organizations the user belongs to, pick the best tier
  FOR r IN
    SELECT
      o.subscription_tier,
      o.subscription_status,
      o.override_tier,
      o.override_expires_at,
      o.expires_at AS org_expires_at
    FROM public.organizations o
    JOIN public.organization_members om ON om.organization_id = o.id
    WHERE om.user_id = target_user_id
      AND om.is_active = true
  LOOP
    -- 1) Override tier (if set and not expired)
    IF r.override_tier IS NOT NULL
       AND (r.override_expires_at IS NULL OR r.override_expires_at > now())
    THEN
      IF result_tier IS NULL OR public._tier_rank(r.override_tier) > public._tier_rank(result_tier) THEN
        result_tier := r.override_tier;
        result_source := 'org_override';
      END IF;
      CONTINUE;
    END IF;

    -- 2) Standard org subscription (if active and not expired)
    IF r.subscription_status = 'active'
       AND (r.org_expires_at IS NULL OR r.org_expires_at > now())
       AND r.subscription_tier IS NOT NULL
       AND r.subscription_tier != 'free'
    THEN
      IF result_tier IS NULL OR public._tier_rank(r.subscription_tier) > public._tier_rank(result_tier) THEN
        result_tier := r.subscription_tier;
        result_source := 'org_subscription';
      END IF;
    END IF;
  END LOOP;

  -- If we found an org-level tier, return it
  IF result_tier IS NOT NULL THEN
    RETURN jsonb_build_object('tier', result_tier, 'source', result_source);
  END IF;

  -- 3) Legacy fallback: user-level tier via existing function
  v_user_tier := public.get_user_subscription_tier(target_user_id);
  IF v_user_tier IS NOT NULL AND v_user_tier != 'free' THEN
    RETURN jsonb_build_object('tier', v_user_tier, 'source', 'user_legacy');
  END IF;

  -- 4) Default: free
  RETURN jsonb_build_object('tier', 'free', 'source', 'default');
END;
$$;
