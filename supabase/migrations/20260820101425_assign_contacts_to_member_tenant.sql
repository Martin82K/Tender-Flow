-- Keep contacts tenant-shared for organization members, while preserving
-- personal contacts for users without an active organization membership.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS private.authorized_subcontractor_tenant_repairs (
  subcontractor_id VARCHAR PRIMARY KEY,
  target_organization_id UUID NOT NULL,
  authorized_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE ALL ON TABLE private.authorized_subcontractor_tenant_repairs
  FROM PUBLIC, anon, authenticated, service_role;

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
        OR
        (
          OLD.organization_id IS NULL
          AND NEW.organization_id IS NOT NULL
          AND NEW.owner_id IS NOT DISTINCT FROM OLD.owner_id
          AND EXISTS (
            SELECT 1
            FROM private.authorized_subcontractor_tenant_repairs AS repair
            WHERE repair.subcontractor_id = NEW.id
              AND repair.target_organization_id = NEW.organization_id
          )
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

CREATE OR REPLACE FUNCTION private.assign_subcontractor_organization_from_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET row_security = off
AS $$
DECLARE
  active_organization_count INTEGER := 0;
  resolved_organization_id UUID := NULL;
BEGIN
  IF NEW.organization_id IS NOT NULL OR NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(DISTINCT active_membership.organization_id),
    MIN(active_membership.organization_id::TEXT)::UUID
  INTO active_organization_count, resolved_organization_id
  FROM public.organization_members AS active_membership
  WHERE active_membership.user_id = NEW.owner_id
    AND COALESCE(active_membership.is_active, true) = true;

  IF active_organization_count = 1 THEN
    NEW.organization_id := resolved_organization_id;
  ELSIF active_organization_count > 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'SUBCONTRACTOR_ORGANIZATION_REQUIRED',
      DETAIL = 'The contact owner has multiple active organizations.',
      CONSTRAINT = 'subcontractors_organization_required';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.assign_subcontractor_organization_from_owner()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS assign_subcontractor_tenant_scope
  ON public.subcontractors;
CREATE TRIGGER assign_subcontractor_tenant_scope
BEFORE INSERT OR UPDATE
ON public.subcontractors
FOR EACH ROW
EXECUTE FUNCTION private.assign_subcontractor_organization_from_owner();

CREATE OR REPLACE FUNCTION private.can_write_subcontractor_tenant(
  owner_id_input UUID,
  organization_id_input UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
SET row_security = off
AS $$
BEGIN
  IF organization_id_input IS NULL THEN
    RETURN owner_id_input = auth.uid()
      AND NOT EXISTS (
        SELECT 1
        FROM public.organization_members AS personal_member
        WHERE personal_member.user_id = owner_id_input
          AND COALESCE(personal_member.is_active, true) = true
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members AS caller
    WHERE caller.organization_id = organization_id_input
      AND caller.user_id = auth.uid()
      AND COALESCE(caller.is_active, true) = true
  ) THEN
    RETURN FALSE;
  END IF;

  IF owner_id_input IS NULL THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members AS owner_member
    WHERE owner_member.organization_id = organization_id_input
      AND owner_member.user_id = owner_id_input
      AND COALESCE(owner_member.is_active, true) = true
  );
END;
$$;

REVOKE ALL ON FUNCTION private.can_write_subcontractor_tenant(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_write_subcontractor_tenant(UUID, UUID)
  TO authenticated, service_role;

LOCK TABLE public.subcontractors IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  target_organization_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO target_organization_count
  FROM public.organizations AS organization
  WHERE organization.name = 'Baustav'
    AND organization.type = 'business';

  IF target_organization_count <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly one Baustav business organization, found %',
      target_organization_count;
  END IF;
END;
$$;

CREATE TEMP TABLE contact_tenant_repair_candidates
ON COMMIT DROP
AS
WITH target_organization AS (
  SELECT organization.id
  FROM public.organizations AS organization
  WHERE organization.name = 'Baustav'
    AND organization.type = 'business'
),
target_members AS (
  SELECT membership.user_id
  FROM public.organization_members AS membership
  JOIN target_organization AS target
    ON target.id = membership.organization_id
  WHERE COALESCE(membership.is_active, true) = true
),
member_organization_counts AS (
  SELECT
    target_member.user_id,
    COUNT(DISTINCT active_membership.organization_id) AS active_organization_count
  FROM target_members AS target_member
  JOIN public.organization_members AS active_membership
    ON active_membership.user_id = target_member.user_id
   AND COALESCE(active_membership.is_active, true) = true
  GROUP BY target_member.user_id
),
personal_contacts AS (
  SELECT
    subcontractor.id,
    target.id AS target_organization_id,
    organization_count.active_organization_count
  FROM public.subcontractors AS subcontractor
  JOIN member_organization_counts AS organization_count
    ON organization_count.user_id = subcontractor.owner_id
  CROSS JOIN target_organization AS target
  WHERE subcontractor.organization_id IS NULL
),
contact_reference_organizations AS (
  SELECT personal_contact.id, project.organization_id
  FROM personal_contacts AS personal_contact
  JOIN public.bids AS bid
    ON bid.subcontractor_id::TEXT = personal_contact.id::TEXT
  JOIN public.demand_categories AS category
    ON category.id::TEXT = bid.demand_category_id::TEXT
  JOIN public.projects AS project
    ON project.id::TEXT = category.project_id::TEXT

  UNION ALL

  SELECT personal_contact.id, contract.organization_id
  FROM personal_contacts AS personal_contact
  JOIN public.contracts AS contract
    ON contract.vendor_id::TEXT = personal_contact.id::TEXT
),
reference_counts AS (
  SELECT
    personal_contact.id,
    COUNT(reference.organization_id) FILTER (
      WHERE reference.organization_id = personal_contact.target_organization_id
    ) AS references_to_target_organization,
    COUNT(*) FILTER (
      WHERE reference.id IS NOT NULL
        AND reference.organization_id IS DISTINCT FROM personal_contact.target_organization_id
    ) AS references_to_other_organizations
  FROM personal_contacts AS personal_contact
  LEFT JOIN contact_reference_organizations AS reference
    ON reference.id = personal_contact.id
  GROUP BY personal_contact.id
)
SELECT
  personal_contact.id,
  personal_contact.target_organization_id,
  personal_contact.active_organization_count,
  reference_count.references_to_target_organization,
  reference_count.references_to_other_organizations,
  (
    personal_contact.active_organization_count = 1
    OR (
      personal_contact.active_organization_count > 1
      AND reference_count.references_to_target_organization > 0
      AND reference_count.references_to_other_organizations = 0
    )
  ) AS safe_to_assign
FROM personal_contacts AS personal_contact
JOIN reference_counts AS reference_count USING (id);

DO $$
DECLARE
  ambiguous_contact_count INTEGER;
  candidate_contact_count INTEGER;
  repaired_contact_count INTEGER;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE NOT safe_to_assign),
    COUNT(*) FILTER (WHERE safe_to_assign)
  INTO ambiguous_contact_count, candidate_contact_count
  FROM contact_tenant_repair_candidates;

  IF ambiguous_contact_count > 0 THEN
    RAISE EXCEPTION
      'Refusing ambiguous tenant assignment for % subcontractor contacts',
      ambiguous_contact_count;
  END IF;

  DELETE FROM private.authorized_subcontractor_tenant_repairs;

  INSERT INTO private.authorized_subcontractor_tenant_repairs (
    subcontractor_id,
    target_organization_id
  )
  SELECT candidate.id, candidate.target_organization_id
  FROM contact_tenant_repair_candidates AS candidate
  WHERE candidate.safe_to_assign;

  UPDATE public.subcontractors AS subcontractor
  SET
    organization_id = candidate.target_organization_id,
    updated_at = NOW()
  FROM contact_tenant_repair_candidates AS candidate
  WHERE subcontractor.id = candidate.id
    AND candidate.safe_to_assign
    AND subcontractor.organization_id IS NULL;

  GET DIAGNOSTICS repaired_contact_count = ROW_COUNT;

  IF repaired_contact_count <> candidate_contact_count THEN
    RAISE EXCEPTION
      'Expected to repair % subcontractor contacts, repaired %',
      candidate_contact_count,
      repaired_contact_count;
  END IF;

  DELETE FROM private.authorized_subcontractor_tenant_repairs;

  RAISE NOTICE 'Assigned % subcontractor contacts to Baustav', repaired_contact_count;
END;
$$;

DO $$
DECLARE
  unrepaired_contact_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO unrepaired_contact_count
  FROM public.subcontractors AS subcontractor
  JOIN contact_tenant_repair_candidates AS candidate
    ON candidate.id = subcontractor.id
  WHERE subcontractor.organization_id IS DISTINCT FROM candidate.target_organization_id;

  IF unrepaired_contact_count > 0 THEN
    RAISE EXCEPTION
      'Tenant repair verification failed for % subcontractor contacts',
      unrepaired_contact_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM private.authorized_subcontractor_tenant_repairs
  ) THEN
    RAISE EXCEPTION 'Tenant repair authorization cleanup failed';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
