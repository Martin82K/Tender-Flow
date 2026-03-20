-- Migration: add_admin_to_baustav
-- Date: 2026-01-17
-- Description: Deprecated unsafe migration that previously added a hard-coded
-- user as organization owner.

DO $$
BEGIN
    -- Intentionally left as a no-op to avoid creating hard-coded privileged accounts.
    RAISE NOTICE 'Skipped unsafe hard-coded organization membership migration.';
END $$;
