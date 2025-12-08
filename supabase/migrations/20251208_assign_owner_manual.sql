-- Migration: assign_owner_manual
-- Date: 2025-12-08
-- Description: Manually assigns 'REKO bazén Aš' to martinkalkus82@gmail.com.

DO $$
DECLARE
    target_user_id UUID;
BEGIN
    -- 1. Get User ID from auth.users
    SELECT id INTO target_user_id 
    FROM auth.users 
    WHERE email = 'martinkalkus82@gmail.com';

    -- 2. Check if user exists
    IF target_user_id IS NOT NULL THEN
        -- 3. Update the specific project
        -- Using ILIKE for case-insensitive matching
        UPDATE public.projects
        SET owner_id = target_user_id
        WHERE name ILIKE '%REKO bazén Aš%';
        
        RAISE NOTICE 'Successfully assigned REKO bazén Aš to user %', target_user_id;
    ELSE
        RAISE NOTICE 'ERROR: User martinkalkus82@gmail.com not found in auth.users!';
    END IF;
END $$;
