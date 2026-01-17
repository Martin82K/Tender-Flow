-- Migration: add_admin_to_baustav
-- Date: 2026-01-17
-- Description: Explicitly adds 'martinkalkus82@gmail.com' to the 'Baustav' organization.

DO $$
DECLARE
    baustav_id UUID;
    target_user_id UUID;
BEGIN
    -- 1. Get Baustav Organization ID
    SELECT id INTO baustav_id FROM public.organizations WHERE name = 'Baustav' LIMIT 1;

    -- 2. Get User ID
    SELECT id INTO target_user_id FROM auth.users WHERE email = 'martinkalkus82@gmail.com' LIMIT 1;

    -- 3. Insert Membership
    IF baustav_id IS NOT NULL AND target_user_id IS NOT NULL THEN
        INSERT INTO public.organization_members (organization_id, user_id, role)
        VALUES (baustav_id, target_user_id, 'owner')
        ON CONFLICT (organization_id, user_id) 
        DO UPDATE SET role = 'owner'; -- Upgrade to owner if already a member with lower role

        RAISE NOTICE 'Successfully added/updated martinkalkus82@gmail.com to Baustav organization.';
    ELSE
        RAISE NOTICE 'WARNING: Could not find Baustav organization or User ID.';
        IF baustav_id IS NULL THEN RAISE NOTICE ' - Baustav ID is missing'; END IF;
        IF target_user_id IS NULL THEN RAISE NOTICE ' - User ID is missing'; END IF;
    END IF;

END $$;
