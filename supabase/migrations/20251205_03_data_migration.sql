-- Migration: data_migration_and_demo
-- Description: Assigns existing users to organizations, sets up Demo project, and migrates legacy data
-- Date: 2025-12-05

DO $$
DECLARE
    baustav_id UUID;
    demo_project_id UUID;
    user_rec RECORD;
BEGIN
    -- 1. Get Baustav Organization ID (created in previous migration)
    SELECT id INTO baustav_id FROM public.organizations WHERE name = 'Baustav' LIMIT 1;

    -- 2. Add all existing users with @baustav.cz to the organization
    IF baustav_id IS NOT NULL THEN
        FOR user_rec IN SELECT id, email FROM auth.users WHERE email LIKE '%@baustav.cz'
        LOOP
            INSERT INTO public.organization_members (organization_id, user_id, role)
            VALUES (baustav_id, user_rec.id, 'member')
            ON CONFLICT (organization_id, user_id) DO NOTHING;
        END LOOP;
        
        -- Also assign existing subcontractors to Baustav organization so they are shared
        UPDATE public.subcontractors
        SET organization_id = baustav_id
        WHERE organization_id IS NULL AND owner_id IS NULL;

        -- Assign existing projects to Baustav organization (optional, but good for team visibility)
        -- Only if they are not demo projects
        UPDATE public.projects
        SET organization_id = baustav_id
        WHERE organization_id IS NULL AND owner_id IS NULL AND (is_demo IS NULL OR is_demo = false);
        
    END IF;

    -- 3. Create Demo Project if it doesn't exist
    -- We check by name or some reliable marker. Let's create one if no project marked as demo exists.
    IF NOT EXISTS (SELECT 1 FROM public.projects WHERE is_demo = true) THEN
        
        INSERT INTO public.projects (id, name, location, status, investor, planned_cost, is_demo, created_at)
        VALUES (
            gen_random_uuid()::text, -- Cast to text to match VARCHAR(36)
            'Vzorový Projekt RD (Demo)',
            'Praha - Východ',
            'realization',
            'Jan Novák',
            5500000,
            true,
            NOW()
        ) RETURNING id INTO demo_project_id;

        -- Add some dummy categories for the Demo Project
        INSERT INTO public.demand_categories (id, project_id, title, sod_budget, plan_budget, status)
        VALUES 
        (gen_random_uuid(), demo_project_id, 'Zemní práce', 150000, 120000, 'closed'),
        (gen_random_uuid(), demo_project_id, 'Základy a deska', 450000, 400000, 'sod'),
        (gen_random_uuid(), demo_project_id, 'Hrubá stavba', 1200000, 1000000, 'open');

    END IF;

END $$;
