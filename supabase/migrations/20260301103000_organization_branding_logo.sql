-- Migration: organization_branding_logo
-- Date: 2026-03-01
-- Description: Adds tenant logo metadata, RPC for logo path updates, and private storage policies.

-- 1) Extend organizations metadata for branding logo
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS logo_path TEXT NULL,
  ADD COLUMN IF NOT EXISTS logo_updated_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS logo_updated_by UUID NULL REFERENCES auth.users(id);

-- 2) RPC: update logo path with role and path validation
CREATE OR REPLACE FUNCTION public.set_organization_logo_path(
  org_id_input UUID,
  logo_path_input TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_admin(org_id_input) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF logo_path_input IS NOT NULL THEN
    IF logo_path_input !~ ('^organizations/' || org_id_input::text || '/logo\.(png|jpg|jpeg|webp|svg)$') THEN
      RAISE EXCEPTION 'Invalid logo path';
    END IF;
  END IF;

  UPDATE public.organizations
  SET
    logo_path = logo_path_input,
    logo_updated_at = NOW(),
    logo_updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = org_id_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_organization_logo_path(UUID, TEXT) TO authenticated;

-- 3) Ensure get_my_organizations returns logo_path
DROP FUNCTION IF EXISTS public.get_my_organizations();

CREATE OR REPLACE FUNCTION public.get_my_organizations()
RETURNS TABLE (
  organization_id UUID,
  organization_name VARCHAR(255),
  member_role VARCHAR(50),
  domain_whitelist TEXT[],
  logo_path TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.name,
    om.role,
    o.domain_whitelist,
    o.logo_path
  FROM public.organizations o
  JOIN public.organization_members om ON om.organization_id = o.id
  WHERE om.user_id = auth.uid()
  ORDER BY o.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_organizations() TO authenticated;

-- 4) Storage bucket for tenant branding
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organization-branding',
  'organization-branding',
  false,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 5) Storage object policies for org admins (owner/admin)
DROP POLICY IF EXISTS "org_branding_select" ON storage.objects;
CREATE POLICY "org_branding_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'organization-branding'
  AND EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id::text = split_part(name, '/', 2)
  )
);

DROP POLICY IF EXISTS "org_branding_insert" ON storage.objects;
CREATE POLICY "org_branding_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'organization-branding'
  AND split_part(name, '/', 1) = 'organizations'
  AND split_part(name, '/', 2) <> ''
  AND split_part(name, '/', 3) ~ '^logo\.(png|jpg|jpeg|webp|svg)$'
  AND EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id::text = split_part(name, '/', 2)
      AND om.role IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "org_branding_update" ON storage.objects;
CREATE POLICY "org_branding_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'organization-branding'
  AND EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id::text = split_part(name, '/', 2)
      AND om.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  bucket_id = 'organization-branding'
  AND split_part(name, '/', 1) = 'organizations'
  AND split_part(name, '/', 2) <> ''
  AND split_part(name, '/', 3) ~ '^logo\.(png|jpg|jpeg|webp|svg)$'
);

DROP POLICY IF EXISTS "org_branding_delete" ON storage.objects;
CREATE POLICY "org_branding_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'organization-branding'
  AND EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id::text = split_part(name, '/', 2)
      AND om.role IN ('owner', 'admin')
  )
);
