-- Migration: revoke_authenticated_create_default_contact_statuses
-- Date: 2026-03-21
-- Description: Prevent authenticated users from invoking organization bootstrap status seeding directly.

REVOKE EXECUTE ON FUNCTION public.create_default_contact_statuses(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_default_contact_statuses(UUID) TO service_role;
