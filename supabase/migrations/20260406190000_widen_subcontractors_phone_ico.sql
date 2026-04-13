-- Widen all VARCHAR columns to TEXT to prevent truncation on import
ALTER TABLE public.subcontractors
ALTER COLUMN phone TYPE TEXT,
ALTER COLUMN ico TYPE TEXT,
ALTER COLUMN region TYPE TEXT,
ALTER COLUMN company_name TYPE TEXT,
ALTER COLUMN contact_person_name TYPE TEXT,
ALTER COLUMN email TYPE TEXT;
