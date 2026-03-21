-- Migration: assign_all_contacts_to_baustav
-- Date: 2026-01-17
-- Description: Historical incident migration kept as a no-op placeholder.
-- Security note (2026-03-20): replaying the original mass reassignment would
-- destroy tenant isolation in fresh environments. Existing databases are
-- handled by a dedicated hardening migration with audit artifacts.

DO $$
BEGIN
    RAISE NOTICE 'Legacy cross-tenant contact reassignment disabled by security hardening.';
END $$;
