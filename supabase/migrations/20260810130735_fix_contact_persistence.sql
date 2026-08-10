-- Restore writes for tenant-owned legacy contacts and align the legacy primary
-- contact columns with the first entry in the canonical contacts JSON array.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

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
    RETURN owner_id_input = auth.uid();
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

  -- Historical organization contacts are tenant-owned and intentionally have
  -- no individual owner. Active membership is the authorization boundary.
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

DROP POLICY IF EXISTS "Subcontractors insert restricted to owner or org"
  ON public.subcontractors;
DROP POLICY IF EXISTS "Manage own or org subcontractors"
  ON public.subcontractors;

CREATE POLICY "Subcontractors insert restricted to owner or org"
ON public.subcontractors
FOR INSERT
TO authenticated
WITH CHECK (
  private.can_write_subcontractor_tenant(owner_id, organization_id)
);

CREATE POLICY "Manage own or org subcontractors"
ON public.subcontractors
FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid()
  OR (
    organization_id IS NOT NULL
    AND organization_id = ANY(public.get_my_org_ids())
  )
)
WITH CHECK (
  private.can_write_subcontractor_tenant(owner_id, organization_id)
);

DROP FUNCTION public.can_write_subcontractor_tenant(UUID, UUID);

UPDATE public.subcontractors
SET
  contact_person_name = NULLIF(BTRIM(contacts->0->>'name'), ''),
  email = NULLIF(BTRIM(contacts->0->>'email'), ''),
  phone = NULLIF(BTRIM(contacts->0->>'phone'), ''),
  updated_at = NOW()
WHERE jsonb_typeof(contacts) = 'array'
  AND jsonb_array_length(contacts) > 0
  AND (
    NULLIF(BTRIM(contacts->0->>'name'), '') IS DISTINCT FROM contact_person_name
    OR NULLIF(BTRIM(contacts->0->>'email'), '') IS DISTINCT FROM email
    OR NULLIF(BTRIM(contacts->0->>'phone'), '') IS DISTINCT FROM phone
  );
