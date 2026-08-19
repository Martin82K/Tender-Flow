-- Existing normalized duplicates predate the conflict guard. Allow ordinary
-- edits of those rows when neither their normalized company identity nor
-- tenant scope changes, while preserving the guard for inserts, renames and
-- tenant transfers.

CREATE OR REPLACE FUNCTION private.guard_subcontractor_company_name_conflict()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET row_security = off
AS $$
DECLARE
  normalized_company_name TEXT;
BEGIN
  normalized_company_name := public.normalize_subcontractor_company_identity(NEW.company_name);

  IF TG_OP = 'UPDATE' THEN
    IF normalized_company_name = public.normalize_subcontractor_company_identity(OLD.company_name)
      AND (
        (
          NEW.organization_id IS NOT NULL
          AND NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id
        )
        OR
        (
          NEW.organization_id IS NULL
          AND OLD.organization_id IS NULL
          AND NEW.owner_id IS NOT DISTINCT FROM OLD.owner_id
        )
      )
    THEN
      RETURN NEW;
    END IF;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      CASE
        WHEN NEW.organization_id IS NOT NULL
          THEN 'organization:' || NEW.organization_id::TEXT
        ELSE 'owner:' || COALESCE(NEW.owner_id::TEXT, '<null>')
      END || E'\x1f' || normalized_company_name,
      0
    )
  );

  IF EXISTS (
    SELECT 1
    FROM public.subcontractors AS existing
    WHERE existing.id <> NEW.id
      AND public.normalize_subcontractor_company_identity(existing.company_name) = normalized_company_name
      AND (
        (
          NEW.organization_id IS NOT NULL
          AND existing.organization_id = NEW.organization_id
        )
        OR
        (
          NEW.organization_id IS NULL
          AND existing.organization_id IS NULL
          AND existing.owner_id IS NOT DISTINCT FROM NEW.owner_id
        )
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'SUBCONTRACTOR_NAME_CONFLICT',
      CONSTRAINT = 'subcontractors_tenant_company_name_key';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_subcontractor_company_name_conflict()
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION private.guard_subcontractor_company_name_conflict() IS
  'Rejects new tenant-scoped company-name conflicts while allowing unchanged identities on legacy duplicate rows.';
