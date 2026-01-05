-- Migration: Remove contact person names from specialization array
-- Problem: During import, contact person names were incorrectly added to the 
-- specialization array alongside actual specializations.
--
-- Example before fix:
--   specialization: ["Jakub Lahner", "Přípojky PLYN", "Přípojky VODA a KANALIZACE"]
--   contact_person_name: "Jakub Lahner"
--
-- Example after fix:
--   specialization: ["Přípojky PLYN", "Přípojky VODA a KANALIZACE"]
--   contact_person_name: "Jakub Lahner"

-- Step 1: Remove contact_person_name from specialization array
UPDATE public.subcontractors
SET specialization = array_remove(specialization, contact_person_name)
WHERE 
    contact_person_name IS NOT NULL 
    AND contact_person_name != '-'
    AND contact_person_name != ''
    AND contact_person_name = ANY(specialization);

-- Step 2: Also remove any names that appear in the contacts JSONB array
-- This handles cases where the name is stored in contacts[].name
UPDATE public.subcontractors s
SET specialization = (
    SELECT array_agg(spec)
    FROM unnest(s.specialization) AS spec
    WHERE spec NOT IN (
        SELECT jsonb_array_elements_text(
            COALESCE(
                (SELECT jsonb_agg(c->>'name') FROM jsonb_array_elements(s.contacts) AS c),
                '[]'::jsonb
            )
        )
    )
    AND spec IS NOT NULL
    AND spec != ''
)
WHERE 
    s.contacts IS NOT NULL 
    AND jsonb_array_length(s.contacts) > 0
    AND EXISTS (
        SELECT 1 
        FROM unnest(s.specialization) AS spec
        WHERE spec IN (
            SELECT jsonb_array_elements_text(
                (SELECT jsonb_agg(c->>'name') FROM jsonb_array_elements(s.contacts) AS c)
            )
        )
    );

-- Step 3: Ensure specialization is not empty after cleanup (fallback to "Ostatní")
UPDATE public.subcontractors
SET specialization = ARRAY['Ostatní']
WHERE 
    specialization IS NULL 
    OR array_length(specialization, 1) IS NULL 
    OR array_length(specialization, 1) = 0;

-- Verify results:
-- SELECT id, company_name, contact_person_name, specialization, contacts
-- FROM public.subcontractors
-- LIMIT 20;
