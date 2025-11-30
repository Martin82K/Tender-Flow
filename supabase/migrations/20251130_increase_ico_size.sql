-- Increase ICO column size to handle longer values
ALTER TABLE public.subcontractors 
ALTER COLUMN ico TYPE VARCHAR(50);
