-- Migrate app_settings RLS from legacy profiles.is_admin to the
-- centralized is_admin() security-definer function used everywhere else.

-- Drop the legacy policy that references profiles.is_admin
DROP POLICY IF EXISTS "Admins can manage app_settings" ON public.app_settings;

-- Recreate with is_admin() — consistent with email_whitelist, admin_roles, etc.
CREATE POLICY "Admins can manage app_settings" ON public.app_settings
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
