-- Migration: assign_all_contacts_to_baustav
-- Date: 2026-01-17
-- Description: Deprecated unsafe migration that previously reassigned all contacts
-- to a single organization and broke tenant isolation.

DO $$
BEGIN
    -- Intentionally left as a no-op to preserve tenant ownership boundaries.
    RAISE NOTICE 'Skipped unsafe global contact reassignment migration.';
END $$;
