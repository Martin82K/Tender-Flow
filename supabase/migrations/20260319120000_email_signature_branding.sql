-- Migration: email_signature_branding
-- Date: 2026-03-19
-- Description: Adds structured user email signature fields and organization email branding
--              including dedicated email logo metadata and RPCs.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS signature_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS signature_role TEXT NULL,
  ADD COLUMN IF NOT EXISTS signature_phone TEXT NULL,
  ADD COLUMN IF NOT EXISTS signature_phone_secondary TEXT NULL,
  ADD COLUMN IF NOT EXISTS signature_email TEXT NULL,
  ADD COLUMN IF NOT EXISTS signature_greeting TEXT NULL;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS email_logo_path TEXT NULL,
  ADD COLUMN IF NOT EXISTS email_logo_updated_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS email_logo_updated_by UUID NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS email_signature_company_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS email_signature_company_address TEXT NULL,
  ADD COLUMN IF NOT EXISTS email_signature_company_meta TEXT NULL,
  ADD COLUMN IF NOT EXISTS email_signature_disclaimer_html TEXT NULL;

CREATE OR REPLACE FUNCTION public.set_organization_email_logo_path(
  org_id_input UUID,
  email_logo_path_input TEXT
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

  IF email_logo_path_input IS NOT NULL THEN
    IF email_logo_path_input !~ ('^organizations/' || org_id_input::text || '/email-logo\.(png|jpg|jpeg|webp|svg)$') THEN
      RAISE EXCEPTION 'Invalid email logo path';
    END IF;
  END IF;

  UPDATE public.organizations
  SET
    email_logo_path = email_logo_path_input,
    email_logo_updated_at = NOW(),
    email_logo_updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = org_id_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_organization_email_logo_path(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_organization_email_branding(
  org_id_input UUID,
  company_name_input TEXT,
  company_address_input TEXT,
  company_meta_input TEXT,
  disclaimer_html_input TEXT
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

  UPDATE public.organizations
  SET
    email_signature_company_name = NULLIF(BTRIM(company_name_input), ''),
    email_signature_company_address = NULLIF(BTRIM(company_address_input), ''),
    email_signature_company_meta = NULLIF(BTRIM(company_meta_input), ''),
    email_signature_disclaimer_html = NULLIF(BTRIM(disclaimer_html_input), ''),
    updated_at = NOW()
  WHERE id = org_id_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_organization_email_branding(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

DROP FUNCTION IF EXISTS public.get_my_organizations();

CREATE OR REPLACE FUNCTION public.get_my_organizations()
RETURNS TABLE (
  organization_id UUID,
  organization_name VARCHAR(255),
  member_role VARCHAR(50),
  domain_whitelist TEXT[],
  logo_path TEXT,
  email_logo_path TEXT,
  email_signature_company_name TEXT,
  email_signature_company_address TEXT,
  email_signature_company_meta TEXT,
  email_signature_disclaimer_html TEXT
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
    o.logo_path,
    o.email_logo_path,
    o.email_signature_company_name,
    o.email_signature_company_address,
    o.email_signature_company_meta,
    o.email_signature_disclaimer_html
  FROM public.organizations o
  JOIN public.organization_members om ON om.organization_id = o.id
  WHERE om.user_id = auth.uid()
  ORDER BY o.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_organizations() TO authenticated;

DROP POLICY IF EXISTS "org_branding_insert" ON storage.objects;
CREATE POLICY "org_branding_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'organization-branding'
  AND split_part(name, '/', 1) = 'organizations'
  AND split_part(name, '/', 2) <> ''
  AND split_part(name, '/', 3) ~ '^(logo|email-logo)\.(png|jpg|jpeg|webp|svg)$'
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
  AND split_part(name, '/', 3) ~ '^(logo|email-logo)\.(png|jpg|jpeg|webp|svg)$'
);
