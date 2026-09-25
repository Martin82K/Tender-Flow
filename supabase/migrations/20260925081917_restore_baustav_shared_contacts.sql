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
  unresolved_bid_count INTEGER NOT NULL,
  repaired_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Deliberately no FK to contacts/users: this minimal scope history must not block
-- account deletion or recreate contact content. No contact payload is stored.
ALTER TABLE private.baustav_contact_scope_repair_20260925 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.baustav_contact_scope_repair_20260925
  FROM PUBLIC, anon, authenticated, service_role;

DO $$
DECLARE
  -- SHA-256 of the reviewed IDs, original scope and destination, in ID order.
  -- Pin identity without committing production UUIDs or contact data.
  expected_scope_hash CONSTANT TEXT := '79f7f5f6305dfc733139b593fc996d8367611fabe4d0a4c1b796ec6a982b74cc';
  expected_orphan_hash CONSTANT TEXT := '62de1ca9b6880aa01f4b84f9434700ec41d47639051962e76afa4af9b40f4ad0';
  reviewed_scope_hash TEXT;
  target_org UUID;
  target_count INTEGER;
  candidate_count INTEGER;
  repaired_count INTEGER;
  unresolved_count INTEGER;
  unresolved_contacts INTEGER;
BEGIN
  LOCK TABLE public.organizations, public.organization_members, public.projects,
    public.demand_categories, public.bids, public.contracts IN SHARE MODE;
  LOCK TABLE public.subcontractors IN SHARE ROW EXCLUSIVE MODE;

  SELECT COUNT(*), MIN(id::TEXT)::UUID INTO target_count, target_org
  FROM public.organizations WHERE name = 'Baustav' AND type = 'business';
  IF target_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one Baustav organization, found %', target_count;
  END IF;

  SELECT COUNT(*) INTO repaired_count FROM private.baustav_contact_scope_repair_20260925;
  IF repaired_count > 0 THEN
    SELECT encode(sha256(convert_to(string_agg(jsonb_build_array(
      subcontractor_id, previous_owner_id, previous_organization_id, target_organization_id
    )::TEXT, '|' ORDER BY subcontractor_id), 'UTF8')), 'hex') INTO reviewed_scope_hash
    FROM private.baustav_contact_scope_repair_20260925;
    IF repaired_count <> 20 OR reviewed_scope_hash IS DISTINCT FROM expected_scope_hash OR EXISTS (
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
    SELECT b.subcontractor_id::TEXT AS contact_id, p.organization_id,
      p.id IS NOT NULL AS must_match_tenant
    FROM public.bids b
    LEFT JOIN public.demand_categories d ON d.id::TEXT = b.demand_category_id::TEXT
    LEFT JOIN public.projects p ON p.id::TEXT = d.project_id::TEXT
    UNION ALL
    -- Contract access is scoped by its project, not the optional legacy column
    -- contracts.organization_id. Missing contract projects must also fail closed.
    SELECT c.vendor_id::TEXT, p.organization_id, true FROM public.contracts c
    LEFT JOIN public.projects p ON p.id::TEXT = c.project_id::TEXT
    WHERE c.vendor_id IS NOT NULL
  )
  SELECT s.id, (SELECT COUNT(*)::INTEGER FROM contact_references r
    WHERE r.contact_id = s.id::TEXT AND NOT r.must_match_tenant) AS unresolved_bid_count
  FROM public.subcontractors s
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
      WHERE r.contact_id = s.id::TEXT AND r.must_match_tenant
        AND r.organization_id IS DISTINCT FROM target_org
    );

  SELECT COUNT(*) INTO candidate_count FROM baustav_contact_scope_candidates;
  IF candidate_count <> 20 THEN
    RAISE EXCEPTION 'Expected 20 reviewed legacy contacts, found %', candidate_count;
  END IF;

  SELECT encode(sha256(convert_to(string_agg(jsonb_build_array(
    s.id, s.owner_id, s.organization_id, target_org
  )::TEXT, '|' ORDER BY s.id), 'UTF8')), 'hex') INTO reviewed_scope_hash
  FROM public.subcontractors s JOIN baustav_contact_scope_candidates c ON c.id = s.id;
  IF reviewed_scope_hash IS DISTINCT FROM expected_scope_hash THEN
    RAISE EXCEPTION 'Reviewed contact identity or ownership changed';
  END IF;

  -- Reviewed legacy anomaly: six bids on two of these contacts refer to missing
  -- categories/projects. Both contacts have resolved Baustav references and a
  -- former Baustav owner with no other active membership. Keep those bid IDs
  -- intact, record the anomaly, and reject any additional unresolved references.
  SELECT COALESCE(SUM(unresolved_bid_count), 0), COUNT(*) FILTER (WHERE unresolved_bid_count > 0)
    INTO unresolved_count, unresolved_contacts FROM baustav_contact_scope_candidates;
  IF unresolved_count <> 6 OR unresolved_contacts <> 2 THEN
    RAISE EXCEPTION 'Unexpected unresolved references: % bids on % contacts', unresolved_count, unresolved_contacts;
  END IF;
  -- Pin the exact reviewed anomalies as well, not just their cardinality.
  SELECT encode(sha256(convert_to(string_agg(jsonb_build_array(
    b.id, b.subcontractor_id, b.demand_category_id
  )::TEXT, '|' ORDER BY b.id), 'UTF8')), 'hex') INTO reviewed_scope_hash
  FROM public.bids b
  JOIN baustav_contact_scope_candidates c ON c.id::TEXT = b.subcontractor_id::TEXT
  LEFT JOIN public.demand_categories d ON d.id::TEXT = b.demand_category_id::TEXT
  LEFT JOIN public.projects p ON p.id::TEXT = d.project_id::TEXT
  WHERE p.id IS NULL;
  IF reviewed_scope_hash IS DISTINCT FROM expected_orphan_hash THEN
    RAISE EXCEPTION 'Reviewed unresolved bid references changed';
  END IF;

  INSERT INTO private.baustav_contact_scope_repair_20260925 (
    subcontractor_id, previous_organization_id, previous_owner_id,
    previous_updated_at, target_organization_id, content_hash, unresolved_bid_count
  )
  SELECT s.id, s.organization_id, s.owner_id, s.updated_at, target_org,
    md5((to_jsonb(s) - 'organization_id' - 'owner_id' - 'updated_at')::TEXT), c.unresolved_bid_count
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
