-- This wrapper reads no tables. Both caller roles can already execute the
-- existing entitlement resolver, which owns the narrowly scoped privileged read.
ALTER FUNCTION public.has_active_subscription() SECURITY INVOKER;
NOTIFY pgrst, 'reload schema';
