-- Keep authorization and bounded-input checks ahead of the privileged
-- subcontractor payload preparation introduced for legacy duplicate restores.

CREATE OR REPLACE FUNCTION public.restore_user_backup(
  backup_json JSONB,
  target_org_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  manifest_version TEXT;
BEGIN
  IF NOT public.is_org_member(target_org_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this organization';
  END IF;

  manifest_version := backup_json->>'version';
  IF manifest_version IS NULL OR manifest_version != '1.0' THEN
    RAISE EXCEPTION 'Unsupported backup version: %', COALESCE(manifest_version, 'null');
  END IF;

  IF octet_length(backup_json::TEXT) > 52428800 THEN
    RAISE EXCEPTION 'Backup payload exceeds 50 MB limit';
  END IF;

  RETURN public.restore_user_backup_without_identity_dedup_20260819(
    private.prepare_subcontractor_restore_payload(backup_json, target_org_id),
    target_org_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.restore_user_backup(JSONB, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_user_backup(JSONB, UUID)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.restore_tenant_backup(
  backup_json JSONB,
  target_org_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  manifest_version TEXT;
BEGIN
  IF NOT public.is_org_admin(target_org_id) THEN
    RAISE EXCEPTION 'Access denied: organization admin role required';
  END IF;

  manifest_version := backup_json->>'version';
  IF manifest_version IS NULL OR manifest_version != '1.0' THEN
    RAISE EXCEPTION 'Unsupported backup version: %', COALESCE(manifest_version, 'null');
  END IF;

  IF octet_length(backup_json::TEXT) > 52428800 THEN
    RAISE EXCEPTION 'Backup payload exceeds 50 MB limit';
  END IF;

  RETURN public.restore_tenant_backup_without_identity_dedup_20260819(
    private.prepare_subcontractor_restore_payload(backup_json, target_org_id),
    target_org_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.restore_tenant_backup(JSONB, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_tenant_backup(JSONB, UUID)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
