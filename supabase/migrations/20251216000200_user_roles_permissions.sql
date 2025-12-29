-- Migration: User Roles and Permissions System
-- Date: 2025-12-16
-- Description: Creates user_roles, role_permissions tables and updates user_profiles

-- 1. Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
    id VARCHAR(50) PRIMARY KEY,
    label VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create role_permissions table
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id VARCHAR(50) REFERENCES public.user_roles(id) ON DELETE CASCADE,
    permission_key VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT false,
    PRIMARY KEY (role_id, permission_key)
);

-- 3. Create permissions reference table (for UI display)
CREATE TABLE IF NOT EXISTS public.permission_definitions (
    key VARCHAR(100) PRIMARY KEY,
    label VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    sort_order INTEGER DEFAULT 0
);

-- 4. Add role_id to user_profiles (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'role_id') THEN
        ALTER TABLE public.user_profiles ADD COLUMN role_id VARCHAR(50) REFERENCES public.user_roles(id);
    END IF;
END $$;

-- 5. Enable RLS on new tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_definitions ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for user_roles
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
CREATE POLICY "user_roles_select" ON public.user_roles 
    FOR SELECT USING (true); -- Everyone can read roles

DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles;
CREATE POLICY "user_roles_admin_all" ON public.user_roles 
    FOR ALL USING (public.is_superadmin());

-- 7. RLS Policies for role_permissions
DROP POLICY IF EXISTS "role_permissions_select" ON public.role_permissions;
CREATE POLICY "role_permissions_select" ON public.role_permissions 
    FOR SELECT USING (true); -- Everyone can read permissions

DROP POLICY IF EXISTS "role_permissions_admin_all" ON public.role_permissions;
CREATE POLICY "role_permissions_admin_all" ON public.role_permissions 
    FOR ALL USING (public.is_superadmin());

-- 8. RLS Policies for permission_definitions
DROP POLICY IF EXISTS "permission_definitions_select" ON public.permission_definitions;
CREATE POLICY "permission_definitions_select" ON public.permission_definitions 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "permission_definitions_admin_all" ON public.permission_definitions;
CREATE POLICY "permission_definitions_admin_all" ON public.permission_definitions 
    FOR ALL USING (public.is_superadmin());

-- 9. Update user_profiles policy to allow superadmin to update any profile
DROP POLICY IF EXISTS "Superadmin can update any profile" ON public.user_profiles;
CREATE POLICY "Superadmin can update any profile" ON public.user_profiles
    FOR UPDATE USING (public.is_superadmin());

-- 10. Grant permissions
GRANT ALL ON public.user_roles TO authenticated;
GRANT ALL ON public.role_permissions TO authenticated;
GRANT ALL ON public.permission_definitions TO authenticated;

-- 11. Insert default roles
INSERT INTO public.user_roles (id, label, description, sort_order) VALUES
    ('priprava', 'Přípravář', 'Odpovědný za přípravu stavby a výběrová řízení', 1),
    ('hl_stavbyvedo', 'Hl. stavbyvedoucí', 'Hlavní stavbyvedoucí odpovědný za celou stavbu', 2),
    ('stavbyvedo', 'Stavbyvedoucí', 'Stavbyvedoucí odpovědný za část stavby', 3),
    ('technik', 'Technik', 'Technický pracovník na stavbě', 4)
ON CONFLICT (id) DO NOTHING;

-- 12. Insert permission definitions
INSERT INTO public.permission_definitions (key, label, description, category, sort_order) VALUES
    ('edit_demands', 'Editace poptávek', 'Možnost vytvářet a upravovat poptávkové kategorie', 'Poptávky', 1),
    ('edit_tender_plan', 'Editace plánu VŘ', 'Možnost upravovat plán výběrového řízení', 'Poptávky', 2),
    ('manage_bids', 'Správa nabídek', 'Možnost přidávat a upravovat nabídky subdodavatelů', 'Poptávky', 3),
    ('exports', 'Exporty', 'Možnost exportovat data do PDF/Excel', 'Exporty', 4),
    ('manage_subcontractors', 'Správa subdodavatelů', 'Možnost přidávat a upravovat kontakty subdodavatelů', 'Kontakty', 5),
    ('view_financials', 'Zobrazení financí', 'Přístup k finančním údajům projektu', 'Finance', 6),
    ('view_dashboard', 'Přístup do dashboardu', 'Zobrazení dashboardu a AI analýz', 'Obecné', 7),
    ('share_projects', 'Sdílení projektů', 'Možnost sdílet projekty s ostatními uživateli', 'Projekty', 8)
ON CONFLICT (key) DO NOTHING;

-- 13. Insert default permissions for each role
-- Přípravář - full access to demands and bids
INSERT INTO public.role_permissions (role_id, permission_key, enabled) VALUES
    ('priprava', 'edit_demands', true),
    ('priprava', 'edit_tender_plan', true),
    ('priprava', 'manage_bids', true),
    ('priprava', 'exports', true),
    ('priprava', 'manage_subcontractors', true),
    ('priprava', 'view_financials', true),
    ('priprava', 'view_dashboard', true),
    ('priprava', 'share_projects', false)
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Hl. stavbyvedoucí - full access
INSERT INTO public.role_permissions (role_id, permission_key, enabled) VALUES
    ('hl_stavbyvedo', 'edit_demands', true),
    ('hl_stavbyvedo', 'edit_tender_plan', true),
    ('hl_stavbyvedo', 'manage_bids', true),
    ('hl_stavbyvedo', 'exports', true),
    ('hl_stavbyvedo', 'manage_subcontractors', true),
    ('hl_stavbyvedo', 'view_financials', true),
    ('hl_stavbyvedo', 'view_dashboard', true),
    ('hl_stavbyvedo', 'share_projects', true)
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Stavbyvedoucí - limited access
INSERT INTO public.role_permissions (role_id, permission_key, enabled) VALUES
    ('stavbyvedo', 'edit_demands', true),
    ('stavbyvedo', 'edit_tender_plan', false),
    ('stavbyvedo', 'manage_bids', true),
    ('stavbyvedo', 'exports', true),
    ('stavbyvedo', 'manage_subcontractors', false),
    ('stavbyvedo', 'view_financials', false),
    ('stavbyvedo', 'view_dashboard', true),
    ('stavbyvedo', 'share_projects', false)
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Technik - view only mostly
INSERT INTO public.role_permissions (role_id, permission_key, enabled) VALUES
    ('technik', 'edit_demands', false),
    ('technik', 'edit_tender_plan', false),
    ('technik', 'manage_bids', false),
    ('technik', 'exports', true),
    ('technik', 'manage_subcontractors', false),
    ('technik', 'view_financials', false),
    ('technik', 'view_dashboard', true),
    ('technik', 'share_projects', false)
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- 14. RPC to get all users with their profiles (superadmin only)
CREATE OR REPLACE FUNCTION public.get_all_users_admin()
RETURNS TABLE (
    user_id UUID,
    email VARCHAR(255),
    display_name VARCHAR(255),
    role_id VARCHAR(50),
    role_label VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE,
    last_sign_in TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only superadmins can call this
    IF NOT public.is_superadmin() THEN
        RAISE EXCEPTION 'Access denied: Superadmin only';
    END IF;

    RETURN QUERY
    SELECT 
        au.id as user_id,
        au.email::VARCHAR(255),
        COALESCE(up.display_name, '')::VARCHAR(255) as display_name,
        up.role_id,
        ur.label as role_label,
        au.created_at,
        au.last_sign_in_at as last_sign_in
    FROM auth.users au
    LEFT JOIN public.user_profiles up ON au.id = up.user_id
    LEFT JOIN public.user_roles ur ON up.role_id = ur.id
    ORDER BY au.created_at DESC;
END;
$$;

-- 15. RPC to update user role (superadmin only)
CREATE OR REPLACE FUNCTION public.update_user_role(
    target_user_id UUID,
    new_role_id VARCHAR(50)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only superadmins can call this
    IF NOT public.is_superadmin() THEN
        RAISE EXCEPTION 'Access denied: Superadmin only';
    END IF;

    -- Upsert user profile with new role
    INSERT INTO public.user_profiles (user_id, role_id, updated_at)
    VALUES (target_user_id, new_role_id, now())
    ON CONFLICT (user_id) DO UPDATE SET 
        role_id = EXCLUDED.role_id,
        updated_at = now();

    RETURN true;
END;
$$;

-- 16. RPC to get all roles with their permissions
CREATE OR REPLACE FUNCTION public.get_roles_with_permissions()
RETURNS TABLE (
    role_id VARCHAR(50),
    role_label VARCHAR(100),
    role_description TEXT,
    permissions JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ur.id as role_id,
        ur.label as role_label,
        ur.description as role_description,
        COALESCE(
            jsonb_object_agg(rp.permission_key, rp.enabled) FILTER (WHERE rp.permission_key IS NOT NULL),
            '{}'::jsonb
        ) as permissions
    FROM public.user_roles ur
    LEFT JOIN public.role_permissions rp ON ur.id = rp.role_id
    GROUP BY ur.id, ur.label, ur.description, ur.sort_order
    ORDER BY ur.sort_order;
END;
$$;

-- 17. RPC to update role permission (superadmin only)
CREATE OR REPLACE FUNCTION public.update_role_permission(
    target_role_id VARCHAR(50),
    target_permission_key VARCHAR(100),
    new_enabled BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only superadmins can call this
    IF NOT public.is_superadmin() THEN
        RAISE EXCEPTION 'Access denied: Superadmin only';
    END IF;

    INSERT INTO public.role_permissions (role_id, permission_key, enabled)
    VALUES (target_role_id, target_permission_key, new_enabled)
    ON CONFLICT (role_id, permission_key) DO UPDATE SET 
        enabled = EXCLUDED.enabled;

    RETURN true;
END;
$$;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.get_all_users_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_roles_with_permissions TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_role_permission TO authenticated;
