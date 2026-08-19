-- Keep the tenant-scoped duplicate guard enabled during backup restore. Older
-- backups can legitimately contain duplicate normalized supplier names, so
-- deterministically disambiguate only the colliding restored rows instead of
-- dropping data or exposing a trigger bypass.

CREATE OR REPLACE FUNCTION private.prepare_subcontractor_restore_payload(
  backup_json JSONB,
  target_org_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET row_security = off
AS $$
DECLARE
  item JSONB;
  item_index BIGINT;
  original_name TEXT;
  candidate_name TEXT;
  suffix_seed TEXT;
  suffix_counter INTEGER;
  prepared_subcontractors JSONB := '[]'::JSONB;
BEGIN
  FOR item, item_index IN
    SELECT restored.value, restored.ordinality
    FROM pg_catalog.jsonb_array_elements(
      COALESCE(backup_json->'subcontractors', '[]'::JSONB)
    ) WITH ORDINALITY AS restored(value, ordinality)
  LOOP
    original_name := COALESCE(item->>'company_name', '');
    candidate_name := original_name;
    suffix_seed := LEFT(
      COALESCE(NULLIF(REPLACE(item->>'id', '-', ''), ''), item_index::TEXT),
      8
    );
    suffix_counter := 0;

    WHILE EXISTS (
      SELECT 1
      FROM public.subcontractors AS existing
      WHERE existing.organization_id = target_org_id
        AND existing.id::TEXT IS DISTINCT FROM item->>'id'
        AND public.normalize_subcontractor_company_identity(existing.company_name)
          = public.normalize_subcontractor_company_identity(candidate_name)
      UNION ALL
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(prepared_subcontractors) AS prepared(value)
      WHERE prepared.value->>'id' IS DISTINCT FROM item->>'id'
        AND public.normalize_subcontractor_company_identity(prepared.value->>'company_name')
          = public.normalize_subcontractor_company_identity(candidate_name)
    )
    LOOP
      suffix_counter := suffix_counter + 1;
      candidate_name := original_name || ' (obnoveno ' || suffix_seed
        || CASE WHEN suffix_counter > 1 THEN '-' || suffix_counter::TEXT ELSE '' END
        || ')';
    END LOOP;

    prepared_subcontractors := prepared_subcontractors || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_set(
        item,
        '{company_name}',
        pg_catalog.to_jsonb(candidate_name),
        TRUE
      )
    );
  END LOOP;

  RETURN pg_catalog.jsonb_set(
    backup_json,
    '{subcontractors}',
    prepared_subcontractors,
    TRUE
  );
END;
$$;

REVOKE ALL ON FUNCTION private.prepare_subcontractor_restore_payload(JSONB, UUID)
  FROM PUBLIC, anon, authenticated, service_role;

ALTER FUNCTION public.restore_user_backup(JSONB, UUID)
  RENAME TO restore_user_backup_without_identity_dedup_20260819;

REVOKE ALL ON FUNCTION public.restore_user_backup_without_identity_dedup_20260819(JSONB, UUID)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.restore_user_backup(
  backup_json JSONB,
  target_org_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
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

ALTER FUNCTION public.restore_tenant_backup(JSONB, UUID)
  RENAME TO restore_tenant_backup_without_identity_dedup_20260819;

REVOKE ALL ON FUNCTION public.restore_tenant_backup_without_identity_dedup_20260819(JSONB, UUID)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.restore_tenant_backup(
  backup_json JSONB,
  target_org_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
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

COMMENT ON FUNCTION private.prepare_subcontractor_restore_payload(JSONB, UUID) IS
  'Disambiguates restored supplier names that would conflict in the target tenant while preserving every backup row.';

NOTIFY pgrst, 'reload schema';
