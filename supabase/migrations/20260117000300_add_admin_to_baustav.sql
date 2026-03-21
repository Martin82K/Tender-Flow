-- Migration: add_admin_to_baustav
-- Date: 2026-01-17
-- Description: Historical incident migration kept as a no-op placeholder.
-- Security note (2026-03-20): fresh environments must not create implicit
-- cross-tenant owner access through hard-coded memberships.

DO $$
BEGIN
    RAISE NOTICE 'Legacy hard-coded Baustav owner membership disabled by security hardening.';
END $$;
