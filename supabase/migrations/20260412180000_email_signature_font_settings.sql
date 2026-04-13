-- Migration: email_signature_font_settings
-- Date: 2026-04-12
-- Description: Adds font family and font size settings to organization email branding.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS email_signature_font_family TEXT NULL,
  ADD COLUMN IF NOT EXISTS email_signature_font_size TEXT NULL;

-- Replace the branding RPC to include font settings
DROP FUNCTION IF EXISTS public.set_organization_email_branding(UUID, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.set_organization_email_branding(
  org_id_input UUID,
  company_name_input TEXT,
  company_address_input TEXT,
  company_meta_input TEXT,
  disclaimer_html_input TEXT,
  font_family_input TEXT DEFAULT NULL,
  font_size_input TEXT DEFAULT NULL
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
    email_signature_font_family = NULLIF(BTRIM(font_family_input), ''),
    email_signature_font_size = NULLIF(BTRIM(font_size_input), ''),
    updated_at = NOW()
  WHERE id = org_id_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_organization_email_branding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Update get_my_organizations to include font settings
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
  email_signature_disclaimer_html TEXT,
  email_signature_font_family TEXT,
  email_signature_font_size TEXT
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
    o.email_signature_disclaimer_html,
    o.email_signature_font_family,
    o.email_signature_font_size
  FROM public.organizations o
  JOIN public.organization_members om ON om.organization_id = o.id
  WHERE om.user_id = auth.uid()
  ORDER BY o.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_organizations() TO authenticated;
