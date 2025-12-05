-- Migration: implement_organizations_and_isolation
-- Description: Adds tables for organizations, extends projects/subcontractors with owner/org, adds hidden projects logic
-- Date: 2025-12-05

-- 1. Organizations Table
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    domain_whitelist TEXT[], -- e.g. ['baustav.cz']
    subscription_tier VARCHAR(50) DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Organization Members Table
CREATE TABLE IF NOT EXISTS public.organization_members (
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (organization_id, user_id)
);

-- 3. User Hidden Projects (for Demo project "deletion")
CREATE TABLE IF NOT EXISTS public.user_hidden_projects (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id VARCHAR(36) REFERENCES public.projects(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (user_id, project_id)
);

-- Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_hidden_projects ENABLE ROW LEVEL SECURITY;

-- 4. Extend Projects Table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id),
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

-- 5. Extend Subcontractors Table
ALTER TABLE public.subcontractors 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- 6. Helper Functions for RLS

-- Function to check if user is member of organization
CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.organization_members 
    WHERE organization_id = org_id 
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's organization IDs
CREATE OR REPLACE FUNCTION public.get_my_org_ids()
RETURNS UUID[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Initial Policies (Draft - will be refined in next step, but good to have basics)

-- Organizations: Visible if member
DROP POLICY IF EXISTS "Organizations visible to members" ON public.organizations;
CREATE POLICY "Organizations visible to members" ON public.organizations
    FOR SELECT USING (
        id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
    );

-- Org Members: Visible to members of same org
DROP POLICY IF EXISTS "Member list visible to members" ON public.organization_members;
CREATE POLICY "Member list visible to members" ON public.organization_members
    FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
    );

-- Hidden Projects: Users can manage their own hidden entries
DROP POLICY IF EXISTS "Users manage hidden projects" ON public.user_hidden_projects;
CREATE POLICY "Users manage hidden projects" ON public.user_hidden_projects
    FOR ALL USING (user_id = auth.uid());

-- Grant permissions
GRANT ALL ON public.organizations TO authenticated;
GRANT ALL ON public.organization_members TO authenticated;
GRANT ALL ON public.user_hidden_projects TO authenticated;
GRANT ALL ON public.organizations TO service_role;
GRANT ALL ON public.organization_members TO service_role;
GRANT ALL ON public.user_hidden_projects TO service_role;

-- 8. Create Default Baustav Organization (Idempotent)
DO $$
DECLARE
    baustav_id UUID;
BEGIN
    -- Check if exists, insert if not
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE 'baustav.cz' = ANY(domain_whitelist)) THEN
        INSERT INTO public.organizations (name, domain_whitelist, subscription_tier)
        VALUES ('Baustav', ARRAY['baustav.cz'], 'enterprise')
        RETURNING id INTO baustav_id;
    END IF;
END $$;
