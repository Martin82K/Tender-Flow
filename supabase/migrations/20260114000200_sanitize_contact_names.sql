-- Migration: Sanitize contact (company) names
-- Removes forbidden characters that cause issues with OneDrive (.,)
-- Standardizes suffixes: "s.r.o." -> "sro", "a.s." -> "as"

-- 1. Update subcontractors table (Main source of truth)
UPDATE subcontractors
SET company_name = REPLACE(REPLACE(REPLACE(REPLACE(company_name, 's.r.o.', 'sro'), 'a.s.', 'as'), '.', ''), ',', '')
WHERE company_name LIKE '%a.s.%' 
   OR company_name LIKE '%s.r.o.%' 
   OR company_name LIKE '%.%' 
   OR company_name LIKE '%,%';

-- 2. Update bids table IF it has company_name column (Defensive update)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bids' AND column_name = 'company_name') THEN
        UPDATE bids
        SET company_name = REPLACE(REPLACE(REPLACE(REPLACE(company_name, 's.r.o.', 'sro'), 'a.s.', 'as'), '.', ''), ',', '')
        WHERE company_name LIKE '%a.s.%' 
           OR company_name LIKE '%s.r.o.%' 
           OR company_name LIKE '%.%' 
           OR company_name LIKE '%,%';
    END IF;
END $$;
