-- Remove the legacy direct anonymous grant from the tenant-scoped overview RPC.
-- Authenticated users keep access; the function itself limits rows to their organizations.

REVOKE EXECUTE ON FUNCTION public.get_overview_tenant_data() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_overview_tenant_data() TO authenticated;
