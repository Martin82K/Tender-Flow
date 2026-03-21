-- Migration: finalize_platform_admin_phase2
-- Date: 2026-03-20
-- Description: Removes temporary email fallback from platform admin checks.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    RETURN public.is_platform_admin(auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    RETURN public.is_admin();
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;

DO $$
BEGIN
    RAISE NOTICE 'Platform admin phase 2 complete: legacy email fallback removed from is_admin().';
END $$;
