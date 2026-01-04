-- Migration: auto_organization_for_solo_users
-- Description: Adds automatic organization creation for solo users with free email providers
-- Date: 2026-01-04

-- 1. Add 'type' column to organizations (personal vs business)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'organizations' 
        AND column_name = 'type'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN type VARCHAR(20) 
        CHECK (type IN ('personal', 'business')) 
        DEFAULT 'business';
    END IF;
END $$;

-- 2. Add owner_user_id for tracking who created the organization
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'organizations' 
        AND column_name = 'owner_user_id'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN owner_user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- 3. Function to detect free email providers
CREATE OR REPLACE FUNCTION public.is_free_email_provider(email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    domain TEXT;
    free_domains TEXT[] := ARRAY[
        'gmail.com', 'googlemail.com',
        'seznam.cz', 'email.cz', 'post.cz', 'centrum.cz', 'atlas.cz',
        'yahoo.com', 'yahoo.cz', 'ymail.com',
        'outlook.com', 'hotmail.com', 'hotmail.cz', 'live.com', 'msn.com',
        'icloud.com', 'me.com', 'mac.com',
        'protonmail.com', 'proton.me', 'pm.me',
        'aol.com', 'mail.com', 'zoho.com', 'gmx.com', 'gmx.net',
        'volny.cz', 'tiscali.cz', 'quick.cz'
    ];
BEGIN
    IF email IS NULL OR email = '' THEN
        RETURN true; -- Treat null/empty as personal
    END IF;
    domain := lower(split_part(email, '@', 2));
    RETURN domain = ANY(free_domains);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Main function to get or create organization for a user
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
        -- Create personal organization for this user
        v_org_name := COALESCE(NULLIF(TRIM(p_display_name), ''), split_part(p_email, '@', 1));
        
        INSERT INTO public.organizations (name, type, owner_user_id, subscription_tier)
        VALUES (v_org_name, 'personal', p_user_id, 'free')
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
            -- Create new business organization for this domain
            v_org_name := initcap(split_part(v_domain, '.', 1));
            
            INSERT INTO public.organizations (name, type, domain_whitelist, owner_user_id, subscription_tier)
            VALUES (v_org_name, 'business', ARRAY[v_domain], p_user_id, 'free')
            RETURNING id INTO v_org_id;
            
            -- Add user as owner of new business org
            INSERT INTO public.organization_members (organization_id, user_id, role)
            VALUES (v_org_id, p_user_id, 'owner');
            
            RETURN v_org_id;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger function to auto-create organization when new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user_organization()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
    v_display_name TEXT;
BEGIN
    -- Get display name from user metadata (set during registration)
    v_display_name := NEW.raw_user_meta_data->>'name';
    
    -- Create or get organization for this user
    BEGIN
        v_org_id := public.get_or_create_user_organization(
            NEW.id,
            NEW.email,
            v_display_name
        );
    EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the user creation
        RAISE WARNING 'Could not create organization for user %: %', NEW.email, SQLERRM;
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users (drop first if exists)
DROP TRIGGER IF EXISTS on_auth_user_created_organization ON auth.users;
CREATE TRIGGER on_auth_user_created_organization
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_organization();

-- 6. Backfill: Create organizations for existing users who don't have one
DO $$
DECLARE
    r RECORD;
    v_org_id UUID;
    v_count INTEGER := 0;
BEGIN
    FOR r IN 
        SELECT au.id, au.email, au.raw_user_meta_data->>'name' as display_name
        FROM auth.users au
        WHERE au.email IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.organization_members om 
            WHERE om.user_id = au.id
        )
    LOOP
        BEGIN
            v_org_id := public.get_or_create_user_organization(
                r.id,
                r.email,
                r.display_name
            );
            v_count := v_count + 1;
            RAISE NOTICE 'Created organization % for user %', v_org_id, r.email;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to create organization for %: %', r.email, SQLERRM;
        END;
    END LOOP;
    RAISE NOTICE 'Backfill complete: % organizations created', v_count;
END $$;

-- 7. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_free_email_provider TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_free_email_provider TO service_role;
GRANT EXECUTE ON FUNCTION public.get_or_create_user_organization TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_user_organization TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user_organization TO service_role;

-- 8. Update existing Baustav organization to type 'business' if not set
UPDATE public.organizations 
SET type = 'business' 
WHERE type IS NULL AND domain_whitelist IS NOT NULL AND array_length(domain_whitelist, 1) > 0;

-- Set personal type for any orgs without domain that might exist
UPDATE public.organizations 
SET type = 'personal' 
WHERE type IS NULL AND (domain_whitelist IS NULL OR array_length(domain_whitelist, 1) = 0 OR domain_whitelist = '{}');
