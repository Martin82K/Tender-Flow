-- Migration: harden org join request authorization
-- Date: 2026-03-17
-- Description: Prevent spoofed emails and arbitrary org targets in join requests

DROP POLICY IF EXISTS "org_join_requests_insert" ON public.organization_join_requests;
CREATE POLICY "org_join_requests_insert"
ON public.organization_join_requests FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND lower(trim(email)) = lower(trim(COALESCE(auth.jwt() ->> 'email', '')))
  AND NOT public.is_public_email_domain(public.normalize_email_domain(email))
  AND EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = organization_id
      AND public.normalize_email_domain(email) = ANY(o.domain_whitelist)
  )
);

CREATE OR REPLACE FUNCTION public.request_org_join_by_email(email_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email TEXT;
  domain TEXT;
  target_org UUID;
BEGIN
  caller_email := lower(trim(COALESCE(auth.jwt() ->> 'email', '')));

  IF caller_email = '' THEN
    RAISE EXCEPTION 'Authenticated email is required';
  END IF;

  IF lower(trim(email_input)) <> caller_email THEN
    RAISE EXCEPTION 'Email must match authenticated user';
  END IF;

  domain := public.normalize_email_domain(caller_email);
  IF domain IS NULL OR public.is_public_email_domain(domain) THEN
    RAISE EXCEPTION 'Public or invalid domain';
  END IF;

  SELECT id INTO target_org
  FROM public.organizations
  WHERE domain = ANY(domain_whitelist)
  LIMIT 1;

  IF target_org IS NULL THEN
    RAISE EXCEPTION 'Organization not found for domain';
  END IF;

  INSERT INTO public.organization_join_requests (organization_id, user_id, email)
  VALUES (target_org, auth.uid(), caller_email)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN TRUE;
END;
$$;
