-- Keep separately named company centers independent while preventing an exact
-- normalized company-name duplicate inside the same tenant. Existing rows are
-- neither merged nor deleted; the guard applies to future inserts and renames.

CREATE OR REPLACE FUNCTION public.normalize_subcontractor_company_identity(
  company_name_input TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT LOWER(
    REGEXP_REPLACE(
      NORMALIZE(BTRIM(company_name_input), NFKC),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );
$$;

REVOKE ALL ON FUNCTION public.normalize_subcontractor_company_identity(TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_subcontractor_company_identity(TEXT)
  TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_subcontractors_org_company_identity
  ON public.subcontractors (
    organization_id,
    public.normalize_subcontractor_company_identity(company_name)
  )
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subcontractors_owner_company_identity
  ON public.subcontractors (
    owner_id,
    public.normalize_subcontractor_company_identity(company_name)
  )
  WHERE organization_id IS NULL;

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

  -- Serialize equal tenant/name candidates so two concurrent inserts cannot
  -- both pass the existence check before either transaction commits.
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

DROP TRIGGER IF EXISTS guard_subcontractor_company_name_conflict
  ON public.subcontractors;
CREATE TRIGGER guard_subcontractor_company_name_conflict
BEFORE INSERT OR UPDATE OF company_name, owner_id, organization_id
ON public.subcontractors
FOR EACH ROW
EXECUTE FUNCTION private.guard_subcontractor_company_name_conflict();

COMMENT ON FUNCTION public.normalize_subcontractor_company_identity(TEXT) IS
  'Canonical company identity: Unicode NFKC, trimmed/collapsed whitespace and case-insensitive comparison.';
COMMENT ON TRIGGER guard_subcontractor_company_name_conflict ON public.subcontractors IS
  'Rejects normalized duplicate company names within one organization or personal owner scope.';
