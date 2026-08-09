-- Trigger functions are invoked by PostgreSQL through their triggers and must
-- not remain directly exposed as PostgREST RPC endpoints.
REVOKE ALL ON FUNCTION public.guard_archived_project_write()
  FROM PUBLIC, anon, authenticated;
