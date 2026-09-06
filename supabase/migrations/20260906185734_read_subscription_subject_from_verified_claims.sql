-- PostgREST supplies these claims only after JWT verification. Read the signed
-- top-level subject (never user_metadata); MCP intentionally has no auth schema access.
CREATE OR REPLACE FUNCTION public.has_active_subscription()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT COALESCE(public.get_effective_user_tier(
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid
  )->>'tier' IN ('starter', 'pro', 'enterprise', 'admin'), false);
$$;
NOTIFY pgrst, 'reload schema';
