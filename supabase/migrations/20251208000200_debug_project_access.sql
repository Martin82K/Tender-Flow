-- Script: debug_project_access
-- Date: 2025-12-08
-- Description: Diagnoses why 'REKO bazén Aš' is visible to cerny@baustav.cz

DO $$
DECLARE
    v_project_id VARCHAR;
    v_owner_id UUID;
    v_owner_email VARCHAR;
    v_cerny_id UUID;
    v_share_count INT;
BEGIN
    -- 1. Find Project
    SELECT id, owner_id INTO v_project_id, v_owner_id
    FROM public.projects
    WHERE name ILIKE '%REKO bazén Aš%'
    LIMIT 1;

    IF v_project_id IS NULL THEN
        RAISE NOTICE 'Project NOT FOUND with name like REKO bazén Aš';
        RETURN;
    END IF;

    -- 2. Identify Owner
    IF v_owner_id IS NULL THEN
        RAISE NOTICE 'Project Owner: NULL (Visible to Everyone)';
    ELSE
        SELECT email INTO v_owner_email FROM auth.users WHERE id = v_owner_id;
        RAISE NOTICE 'Project Owner: % (ID: %)', v_owner_email, v_owner_id;
    END IF;

    -- 3. Check for Shares
    SELECT COUNT(*) INTO v_share_count 
    FROM public.project_shares 
    WHERE project_id = v_project_id;

    RAISE NOTICE 'Total Shares found: %', v_share_count;

    -- 4. Check Cerny status
    SELECT id INTO v_cerny_id FROM auth.users WHERE email = 'cerny@baustav.cz';
    
    IF v_cerny_id IS NULL THEN
         RAISE NOTICE 'User cerny@baustav.cz NOT FOUND in auth.users';
    ELSE
         -- Check if shared to him
         PERFORM 1 FROM public.project_shares WHERE project_id = v_project_id AND user_id = v_cerny_id;
         IF FOUND THEN
             RAISE NOTICE 'ALERT: Project IS explicitly shared with cerny@baustav.cz';
         ELSE
             RAISE NOTICE 'Project is NOT shared with cerny@baustav.cz';
         END IF;

         -- Check if he is owner
         IF v_owner_id = v_cerny_id THEN
             RAISE NOTICE 'ALERT: cerny@baustav.cz IS the owner!';
         END IF;
    END IF;

END $$;
