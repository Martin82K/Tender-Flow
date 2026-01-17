-- Migration: assign_all_contacts_to_baustav
-- Date: 2026-01-17
-- Description: Assigns ALL contacts in the database to the 'Baustav' organization to ensure visibility for all members.

DO $$
DECLARE
    baustav_id UUID;
    count_updated INTEGER;
BEGIN
    -- 1. Get Baustav Organization ID
    -- We assume the organization named 'Baustav' exists from previous migrations.
    SELECT id INTO baustav_id FROM public.organizations WHERE name = 'Baustav' LIMIT 1;

    -- 2. Update contacts
    IF baustav_id IS NOT NULL THEN
        -- Update ALL subcontractors to belong to Baustav
        -- We also set owner_id to NULL so they are considered "Organization Shared" rather than "User Owned"
        WITH updated_rows AS (
            UPDATE public.subcontractors
            SET 
                organization_id = baustav_id,
                owner_id = NULL -- Make them shared/public within the org
            WHERE 
                -- Optional: only update if not already assigned to avoid unnecessary writes, 
                -- OR remove this WHERE clause to force-overwrite everything.
                -- User request was "nastav všechny kontakty" (set all contacts), so we overwrite.
                organization_id IS DISTINCT FROM baustav_id 
                OR owner_id IS NOT NULL
            RETURNING 1
        )
        SELECT count(*) INTO count_updated FROM updated_rows;

        RAISE NOTICE 'Successfully assigned % contacts to Baustav organization (ID: %).', count_updated, baustav_id;
    ELSE
        RAISE NOTICE 'WARNING: Baustav organization not found! No contacts were updated.';
    END IF;

END $$;
