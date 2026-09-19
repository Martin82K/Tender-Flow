-- Run only against an isolated schema copy. All fixture changes are rolled back.
BEGIN;
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
('96100000-0000-4000-8000-000000000001','resolver-own@gmail.com',now()),
('96100000-0000-4000-8000-000000000002','resolver-other@gmail.com',now());
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"96100000-0000-4000-8000-000000000001"}',true);
DO $$
DECLARE denied boolean := false;
BEGIN
  PERFORM public.get_effective_user_tier('96100000-0000-4000-8000-000000000001');
  BEGIN
    PERFORM public.get_effective_user_tier('96100000-0000-4000-8000-000000000002');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'A user must not inspect another identity licence'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE tenderflow_mcp_client;
SELECT set_config('request.jwt.claims','{"role":"tenderflow_mcp_client","sub":"96100000-0000-4000-8000-000000000001"}',true);
DO $$
DECLARE denied boolean := false;
BEGIN
  PERFORM public.get_effective_user_tier('96100000-0000-4000-8000-000000000001');
  BEGIN
    PERFORM public.get_effective_user_tier('96100000-0000-4000-8000-000000000002');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'MCP must not inspect another identity licence'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF has_function_privilege('anon','public.get_effective_user_tier(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous licence inspection must be revoked';
  END IF;
  IF has_function_privilege('authenticated','public._org_billable_seats_available(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Seat reservation helper must remain internal';
  END IF;
END $$;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT public.get_effective_user_tier('96100000-0000-4000-8000-000000000002')->>'tier' AS service_tier;
RESET ROLE;
ROLLBACK;
