-- Migration: Swap contact_person_name and specialization values
-- Problem: Data was imported with swapped values
-- - contact_person_name contains specialization (e.g., "Přípojky VODA a KANALIZACE")
-- - specialization contains contact name (e.g., "Jakub Lahner")

-- Note: specialization is text[] (array), contact_person_name is varchar

-- This script swaps the values with proper type casting
UPDATE public.subcontractors
SET 
    contact_person_name = specialization[1],  -- Take first element from array
    specialization = ARRAY[contact_person_name];  -- Wrap string in array

-- Verify with:
-- SELECT id, company_name, contact_person_name, specialization FROM subcontractors LIMIT 10;
