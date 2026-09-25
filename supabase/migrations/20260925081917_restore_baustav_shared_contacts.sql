-- One-off, approved repair of legacy contacts from inactive Baustav members.
-- Other owners (including the separately investigated two records) are excluded.
-- Keep the existing tenant policies, subscription checks and duplicate guard.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS private.baustav_contact_scope_repair_20260925 (
  subcontractor_id VARCHAR PRIMARY KEY,
  previous_organization_id UUID,
  previous_owner_id UUID,
  previous_updated_at TIMESTAMP,
  target_organization_id UUID NOT NULL,
  content_hash TEXT NOT NULL,
  repaired_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Deliberately no FK to contacts/users: this minimal scope history must not block
-- account deletion or recreate contact content. No contact payload is stored.
ALTER TABLE private.baustav_contact_scope_repair_20260925 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.baustav_contact_scope_repair_20260925
  FROM PUBLIC, anon, authenticated, service_role;

DO $$
DECLARE
  target_org UUID;
  target_count INTEGER;
  candidate_count INTEGER;
  repaired_count INTEGER;
BEGIN
  LOCK TABLE public.organizations, public.organization_members, public.projects,
    public.demand_categories, public.bids, public.contracts IN SHARE MODE;
  LOCK TABLE public.subcontractors IN SHARE ROW EXCLUSIVE MODE;

  SELECT COUNT(*), MIN(id::TEXT)::UUID INTO target_count, target_org
  FROM public.organizations WHERE name = 'Baustav' AND type = 'business';
  IF target_count = 0 THEN RETURN; END IF;
  IF target_count <> 1 THEN
    RAISE EXCEPTION 'Ambiguous Baustav organization';
  END IF;

  SELECT COUNT(*) INTO repaired_count FROM private.baustav_contact_scope_repair_20260925;
  IF repaired_count > 0 THEN
    IF repaired_count <> 20 OR EXISTS (
      SELECT 1 FROM private.baustav_contact_scope_repair_20260925
      WHERE target_organization_id <> target_org
    ) THEN
      RAISE EXCEPTION 'Unexpected previous contact repair history';
    END IF;
    -- Completed repair: never replay against later edits, deletions or new data.
    RETURN;
  END IF;

  CREATE TEMP TABLE baustav_contact_scope_candidates ON COMMIT DROP AS
  WITH contact_references AS (
    SELECT b.subcontractor_id::TEXT AS contact_id, p.organization_id
    FROM public.bids b
    JOIN public.demand_categories d ON d.id::TEXT = b.demand_category_id::TEXT
    JOIN public.projects p ON p.id::TEXT = d.project_id::TEXT
    UNION ALL
    SELECT c.vendor_id::TEXT, c.organization_id FROM public.contracts c
    WHERE c.vendor_id IS NOT NULL
  )
  SELECT s.id FROM public.subcontractors s
  WHERE s.organization_id IS NULL
    AND s.created_at < TIMESTAMP '2026-08-20 00:00:00'
    AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.user_id = s.owner_id AND m.organization_id = target_org
        AND m.is_active = false
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.user_id = s.owner_id AND COALESCE(m.is_active, true)
    )
    AND EXISTS (
      SELECT 1 FROM contact_references r
      WHERE r.contact_id = s.id::TEXT AND r.organization_id = target_org
    )
    AND NOT EXISTS (
      SELECT 1 FROM contact_references r
      WHERE r.contact_id = s.id::TEXT AND r.organization_id IS DISTINCT FROM target_org
    );

  SELECT COUNT(*) INTO candidate_count FROM baustav_contact_scope_candidates;
  IF candidate_count <> 20 THEN
    RAISE EXCEPTION 'Expected 20 reviewed legacy contacts, found %', candidate_count;
  END IF;

  INSERT INTO private.baustav_contact_scope_repair_20260925 (
    subcontractor_id, previous_organization_id, previous_owner_id,
    previous_updated_at, target_organization_id, content_hash
  )
  SELECT s.id, s.organization_id, s.owner_id, s.updated_at, target_org,
    md5((to_jsonb(s) - 'organization_id' - 'owner_id' - 'updated_at')::TEXT)
  FROM public.subcontractors s JOIN baustav_contact_scope_candidates c ON c.id = s.id;

  -- Tenant-owned contacts remain editable by active members and do not grant
  -- a former author personal access after leaving the organization.
  UPDATE public.subcontractors s
  SET organization_id = target_org, owner_id = NULL, updated_at = NOW()
  FROM baustav_contact_scope_candidates c WHERE c.id = s.id;
  GET DIAGNOSTICS repaired_count = ROW_COUNT;
  IF repaired_count <> candidate_count OR EXISTS (
    SELECT 1 FROM private.baustav_contact_scope_repair_20260925 h
    LEFT JOIN public.subcontractors s ON s.id = h.subcontractor_id
    WHERE s.id IS NULL OR s.organization_id IS DISTINCT FROM target_org
      OR s.owner_id IS NOT NULL
      OR md5((to_jsonb(s) - 'organization_id' - 'owner_id' - 'updated_at')::TEXT)
        IS DISTINCT FROM h.content_hash
  ) THEN
    RAISE EXCEPTION 'Contact scope repair verification failed';
  END IF;
END;
$$;
