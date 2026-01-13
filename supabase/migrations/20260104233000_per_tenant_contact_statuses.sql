-- Migration: per_tenant_contact_statuses
-- Description: Makes contact statuses per-tenant with organization_id isolation
-- Also updates default subscription tier to 'starter'
-- Date: 2026-01-04

-- 1. Add organization_id column to subcontractor_statuses
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'subcontractor_statuses' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE public.subcontractor_statuses 
        ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Drop old RLS policies
DROP POLICY IF EXISTS "subcontractor_statuses_select" ON public.subcontractor_statuses;
DROP POLICY IF EXISTS "subcontractor_statuses_admin_insert" ON public.subcontractor_statuses;
DROP POLICY IF EXISTS "subcontractor_statuses_admin_update" ON public.subcontractor_statuses;
DROP POLICY IF EXISTS "subcontractor_statuses_admin_delete" ON public.subcontractor_statuses;
DROP POLICY IF EXISTS "subcontractor_statuses_tenant_select" ON public.subcontractor_statuses;
DROP POLICY IF EXISTS "subcontractor_statuses_tenant_insert" ON public.subcontractor_statuses;
DROP POLICY IF EXISTS "subcontractor_statuses_tenant_update" ON public.subcontractor_statuses;
DROP POLICY IF EXISTS "subcontractor_statuses_tenant_delete" ON public.subcontractor_statuses;

-- 3. Create new per-tenant RLS policies

-- SELECT: Users can see their org's statuses OR global statuses (NULL org_id)
CREATE POLICY "subcontractor_statuses_tenant_select" ON public.subcontractor_statuses
    FOR SELECT
    TO authenticated
    USING (
        organization_id IS NULL  -- Global/system statuses visible to all
        OR organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- INSERT: Users can only add statuses to their own organization
CREATE POLICY "subcontractor_statuses_tenant_insert" ON public.subcontractor_statuses
    FOR INSERT
    TO authenticated
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- UPDATE: Users can only update their org's statuses (not global ones)
CREATE POLICY "subcontractor_statuses_tenant_update" ON public.subcontractor_statuses
    FOR UPDATE
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- DELETE: Users can only delete their org's statuses (not global ones)
CREATE POLICY "subcontractor_statuses_tenant_delete" ON public.subcontractor_statuses
    FOR DELETE
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- 4. Function to create default statuses for an organization
CREATE OR REPLACE FUNCTION public.create_default_contact_statuses(p_org_id UUID)
RETURNS void AS $$
BEGIN
    -- Only insert if org doesn't have any statuses yet
    IF NOT EXISTS (
        SELECT 1 FROM public.subcontractor_statuses 
        WHERE organization_id = p_org_id
    ) THEN
        INSERT INTO public.subcontractor_statuses (id, label, color, sort_order, organization_id)
        VALUES 
            (p_org_id || '_available', 'K dispozici', 'green', 1, p_org_id),
            (p_org_id || '_busy', 'Zaneprázdněn', 'red', 2, p_org_id),
            (p_org_id || '_waiting', 'Čeká', 'yellow', 3, p_org_id)
        ON CONFLICT (id) DO NOTHING;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger to auto-create statuses when organization is created
CREATE OR REPLACE FUNCTION public.handle_new_organization_statuses()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.create_default_contact_statuses(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_organization_created_statuses ON public.organizations;
CREATE TRIGGER on_organization_created_statuses
    AFTER INSERT ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_organization_statuses();

-- 6. Backfill: Create statuses for existing organizations that don't have them
DO $$
DECLARE
    r RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR r IN 
        SELECT o.id FROM public.organizations o
        WHERE NOT EXISTS (
            SELECT 1 FROM public.subcontractor_statuses ss 
            WHERE ss.organization_id = o.id
        )
    LOOP
        PERFORM public.create_default_contact_statuses(r.id);
        v_count := v_count + 1;
    END LOOP;
    RAISE NOTICE 'Created default statuses for % organizations', v_count;
END $$;

-- 7. Update default subscription tier to 'starter' in get_or_create_user_organization
-- (This updates the function created in previous migration)
CREATE OR REPLACE FUNCTION public.get_or_create_user_organization(
    p_user_id UUID,
    p_email TEXT,
    p_display_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_org_id UUID;
    v_domain TEXT;
    v_org_name TEXT;
BEGIN
    -- Validate input
    IF p_user_id IS NULL OR p_email IS NULL OR p_email = '' THEN
        RAISE EXCEPTION 'user_id and email are required';
    END IF;

    v_domain := lower(split_part(p_email, '@', 2));
    
    -- First, check if user already has an organization membership
    SELECT organization_id INTO v_org_id
    FROM public.organization_members
    WHERE user_id = p_user_id
    LIMIT 1;
    
    IF v_org_id IS NOT NULL THEN
        RETURN v_org_id;
    END IF;
    
    -- Check if it's a free email provider
    IF public.is_free_email_provider(p_email) THEN
        -- Create personal organization for this user with 'starter' tier
        v_org_name := COALESCE(NULLIF(TRIM(p_display_name), ''), split_part(p_email, '@', 1));
        
        INSERT INTO public.organizations (name, type, owner_user_id, subscription_tier)
        VALUES (v_org_name, 'personal', p_user_id, 'starter')  -- Changed from 'free' to 'starter'
        RETURNING id INTO v_org_id;
        
        -- Add user as owner of personal org
        INSERT INTO public.organization_members (organization_id, user_id, role)
        VALUES (v_org_id, p_user_id, 'owner');
        
        RETURN v_org_id;
    ELSE
        -- Business email - check if organization with this domain exists
        SELECT id INTO v_org_id
        FROM public.organizations
        WHERE v_domain = ANY(domain_whitelist)
        LIMIT 1;
        
        IF v_org_id IS NOT NULL THEN
            -- Add user to existing organization as member
            INSERT INTO public.organization_members (organization_id, user_id, role)
            VALUES (v_org_id, p_user_id, 'member')
            ON CONFLICT (organization_id, user_id) DO NOTHING;
            
            RETURN v_org_id;
        ELSE
            -- Create new business organization with 'starter' tier
            v_org_name := initcap(split_part(v_domain, '.', 1));
            
            INSERT INTO public.organizations (name, type, domain_whitelist, owner_user_id, subscription_tier)
            VALUES (v_org_name, 'business', ARRAY[v_domain], p_user_id, 'starter')  -- Changed from 'free' to 'starter'
            RETURNING id INTO v_org_id;
            
            -- Add user as owner of new business org
            INSERT INTO public.organization_members (organization_id, user_id, role)
            VALUES (v_org_id, p_user_id, 'owner');
            
            RETURN v_org_id;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Grant permissions
GRANT EXECUTE ON FUNCTION public.create_default_contact_statuses TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_default_contact_statuses TO service_role;
