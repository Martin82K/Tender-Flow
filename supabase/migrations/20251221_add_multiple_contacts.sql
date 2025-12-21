-- Migration: Add multiple contacts support to subcontractors
-- Created: 2025-12-21

-- 1. Add contacts JSONB column
ALTER TABLE public.subcontractors 
ADD COLUMN IF NOT EXISTS contacts JSONB DEFAULT '[]'::JSONB;

-- 2. Migrate existing single-contact data to the new JSONB array
-- Only runs for subcontractors that don't have contacts yet but have legacy contact info
UPDATE public.subcontractors
SET contacts = jsonb_build_array(
    jsonb_build_object(
        'id', gen_random_uuid(),
        'name', COALESCE(contact_person_name, '-'),
        'phone', COALESCE(phone, '-'),
        'email', COALESCE(email, '-'),
        'position', 'Hlavní kontakt'
    )
)
WHERE (contacts IS NULL OR contacts = '[]'::JSONB)
  AND (contact_person_name IS NOT NULL AND contact_person_name != '-'
       OR phone IS NOT NULL AND phone != '-'
       OR email IS NOT NULL AND email != '-');

-- 3. Add comment for clarity
COMMENT ON COLUMN public.subcontractors.contacts IS 'Seznam kontaktních osob (array of objects)';
