-- Migration: delete_org_member_account
-- Date: 2026-04-16
-- Description: Owner-only hard deletion of an organization member's account.
--   Transfers ownership of business data (projects, subcontractors, contracts, short_urls)
--   to the organization owner, anonymizes audit trails, then removes the membership.
--   The auth.users row itself is deleted by the companion Edge Function
--   (delete-user-account) using the service role, AFTER this RPC succeeds.
--
-- Security:
--   - Only organization owner may invoke
--   - Cannot delete owner (including self)
--   - Cannot delete across organizations
--   - Runs in a single transaction (function body is atomic)

-- =============================================================================
-- 1. delete_org_member_account — owner-only hard deletion with ownership transfer
-- =============================================================================

CREATE OR REPLACE FUNCTION public.delete_org_member_account(
  org_id_input UUID,
  user_id_input UUID,
  confirmation_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  target_role TEXT;
  target_email TEXT;
  new_owner_id UUID;
  transferred JSONB := '{}'::JSONB;
  v_count INTEGER;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Authorization & validation
  -- ---------------------------------------------------------------------------

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF org_id_input IS NULL OR user_id_input IS NULL THEN
    RAISE EXCEPTION 'Invalid parameters';
  END IF;

  -- Caller must be org owner
  SELECT om.role INTO caller_role
  FROM public.organization_members om
  WHERE om.organization_id = org_id_input
    AND om.user_id = auth.uid()
    AND om.is_active = true;

  IF caller_role IS NULL OR caller_role <> 'owner' THEN
    RAISE EXCEPTION 'Only organization owner can delete user accounts';
  END IF;

  -- Cannot delete self
  IF user_id_input = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

  -- Target must be a member of this organization
  SELECT om.role INTO target_role
  FROM public.organization_members om
  WHERE om.organization_id = org_id_input
    AND om.user_id = user_id_input;

  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Member not found in this organization';
  END IF;

  -- Hard-delete is allowed only when the target account belongs exclusively
  -- to this organization. Otherwise auth.users deletion would impact other
  -- tenants via ON DELETE CASCADE on organization_members.
  IF EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = user_id_input
      AND om.organization_id <> org_id_input
  ) THEN
    RAISE EXCEPTION 'Cannot delete account: user belongs to another organization';
  END IF;

  -- Extra explicit guard for owners in any other organization.
  IF EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = user_id_input
      AND om.organization_id <> org_id_input
      AND om.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Cannot delete account: user is owner in another organization';
  END IF;

  -- Cannot delete another owner
  IF target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot delete an owner. Transfer ownership first.';
  END IF;

  -- Double-confirmation: email must match
  SELECT u.email INTO target_email FROM auth.users u WHERE u.id = user_id_input;
  IF target_email IS NULL THEN
    RAISE EXCEPTION 'Target auth user not found';
  END IF;
  IF LOWER(COALESCE(confirmation_email, '')) <> LOWER(target_email) THEN
    RAISE EXCEPTION 'Confirmation email does not match member email';
  END IF;

  -- The organization owner (destination of ownership transfer)
  new_owner_id := auth.uid();

  -- ---------------------------------------------------------------------------
  -- 2. Transfer ownership of business-critical tables to the org owner
  --    Wrapped in IF EXISTS checks to stay portable across environments.
  -- ---------------------------------------------------------------------------

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'projects'
               AND column_name = 'owner_id') THEN
    UPDATE public.projects
      SET owner_id = new_owner_id
      WHERE owner_id = user_id_input
        AND organization_id = org_id_input;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    transferred := transferred || jsonb_build_object('projects', v_count);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'subcontractors'
               AND column_name = 'owner_id') THEN
    UPDATE public.subcontractors
      SET owner_id = new_owner_id
      WHERE owner_id = user_id_input
        AND organization_id = org_id_input;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    transferred := transferred || jsonb_build_object('subcontractors', v_count);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'contracts') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'contracts'
                 AND column_name = 'owner_id') THEN
      UPDATE public.contracts
        SET owner_id = new_owner_id
        WHERE owner_id = user_id_input
          AND organization_id = org_id_input;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      transferred := transferred || jsonb_build_object('contracts_owner', v_count);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'contracts'
                 AND column_name = 'created_by') THEN
      UPDATE public.contracts
        SET created_by = new_owner_id
        WHERE created_by = user_id_input
          AND organization_id = org_id_input;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      transferred := transferred || jsonb_build_object('contracts_created_by', v_count);
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'short_urls'
               AND column_name = 'created_by') THEN
    UPDATE public.short_urls
      SET created_by = new_owner_id
      WHERE created_by = user_id_input;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    transferred := transferred || jsonb_build_object('short_urls', v_count);
  END IF;

  -- ---------------------------------------------------------------------------
  -- 3. Anonymize audit / usage trails scoped to this organization
  --    (Keep the row for audit-history integrity; drop the user link.)
  -- ---------------------------------------------------------------------------

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'feature_usage_events'
               AND column_name = 'user_id') THEN
    UPDATE public.feature_usage_events
      SET user_id = NULL
      WHERE user_id = user_id_input
        AND organization_id = org_id_input;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'ai_voice_usage_events'
               AND column_name = 'user_id') THEN
    UPDATE public.ai_voice_usage_events
      SET user_id = NULL
      WHERE user_id = user_id_input
        AND organization_id = org_id_input;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'ai_agent_usage_events'
               AND column_name = 'user_id') THEN
    UPDATE public.ai_agent_usage_events
      SET user_id = NULL
      WHERE user_id = user_id_input
        AND organization_id = org_id_input;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 4. Remove membership (cleanup join requests too)
  -- ---------------------------------------------------------------------------

  DELETE FROM public.organization_members
    WHERE organization_id = org_id_input AND user_id = user_id_input;

  DELETE FROM public.organization_join_requests
    WHERE organization_id = org_id_input AND user_id = user_id_input;

  -- ---------------------------------------------------------------------------
  -- 5. Audit log entry
  -- ---------------------------------------------------------------------------

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'admin_audit_events') THEN
    BEGIN
      INSERT INTO public.admin_audit_events (actor, event_type, payload)
      VALUES (
        (SELECT email FROM auth.users WHERE id = auth.uid()),
        'org_member_account_deleted',
        jsonb_build_object(
          'organization_id', org_id_input,
          'deleted_user_id', user_id_input,
          'deleted_user_email', target_email,
          'transferred_to', new_owner_id,
          'transferred', transferred,
          'deleted_at', now()
        )
      );
    EXCEPTION WHEN OTHERS THEN
      -- Schema mismatch on admin_audit_events must not block the delete.
      NULL;
    END;
  END IF;

  -- Return payload so the Edge Function can proceed with auth.users deletion.
  RETURN jsonb_build_object(
    'success', true,
    'user_id', user_id_input,
    'email', target_email,
    'transferred', transferred
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_org_member_account(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_org_member_account(UUID, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.delete_org_member_account(UUID, UUID, TEXT) IS
  'Owner-only: transfers business data to org owner, anonymizes audit logs, '
  'removes org membership. The companion Edge Function (delete-user-account) '
  'must then delete the auth.users row using the service role.';
