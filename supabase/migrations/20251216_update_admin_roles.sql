-- Migration: Update admin RLS policies to include multiple admins
-- Purpose: Add kalkus@baustav.cz as admin alongside martinkalkus82@gmail.com
-- Date: 2025-12-16

-- Create a helper function to check if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.jwt() ->> 'email' IN ('martinkalkus82@gmail.com', 'kalkus@baustav.cz');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a helper function to check if the current user is a superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.jwt() ->> 'email' = 'martinkalkus82@gmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin TO authenticated;

-- Update subcontractor_statuses policies to use the new function
DROP POLICY IF EXISTS "subcontractor_statuses_admin_insert" ON subcontractor_statuses;
DROP POLICY IF EXISTS "subcontractor_statuses_admin_update" ON subcontractor_statuses;
DROP POLICY IF EXISTS "subcontractor_statuses_admin_delete" ON subcontractor_statuses;

CREATE POLICY "subcontractor_statuses_admin_insert" ON subcontractor_statuses 
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "subcontractor_statuses_admin_update" ON subcontractor_statuses 
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "subcontractor_statuses_admin_delete" ON subcontractor_statuses 
  FOR DELETE USING (public.is_admin());
