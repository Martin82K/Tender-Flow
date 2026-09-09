-- Transactional regression: only temporary fixtures are mutated; always rolls back.
-- Copies the deployed function body, changing only relation/function schemas.
BEGIN;
CREATE TEMP TABLE mcp_user_client_grants
  (LIKE public.mcp_user_client_grants INCLUDING DEFAULTS);
ALTER TABLE pg_temp.mcp_user_client_grants ADD CONSTRAINT mcp_user_client_grants_pkey
  PRIMARY KEY (user_id, client_id, permission);
CREATE TEMP TABLE mcp_permission_grant_audit
  (LIKE public.mcp_permission_grant_audit INCLUDING DEFAULTS);
CREATE TEMP TABLE mcp_oauth_client_resources (client_id uuid, resource text, enabled boolean);
CREATE TEMP TABLE oauth_clients (id uuid, deleted_at timestamptz);
CREATE TEMP TABLE oauth_consents (id uuid, client_id uuid, user_id uuid, granted_at timestamptz, revoked_at timestamptz);
DO $$
DECLARE definition text := pg_get_functiondef('public.set_my_mcp_client_grant(uuid,text,boolean)'::regprocedure);
BEGIN
  definition := replace(definition, 'public.set_my_mcp_client_grant', 'pg_temp.set_my_mcp_client_grant');
  definition := replace(definition, 'public.mcp_user_client_grants', 'pg_temp.mcp_user_client_grants');
  definition := replace(definition, 'public.mcp_permission_grant_audit', 'pg_temp.mcp_permission_grant_audit');
  definition := replace(definition, 'public.mcp_oauth_client_resources', 'pg_temp.mcp_oauth_client_resources');
  definition := replace(definition, 'auth.oauth_clients', 'pg_temp.oauth_clients');
  definition := replace(definition, 'auth.oauth_consents', 'pg_temp.oauth_consents');
  EXECUTE definition;
END;
$$;
DO $$
DECLARE
  test_user uuid := gen_random_uuid();
  test_client uuid := gen_random_uuid();
  test_consent uuid := gen_random_uuid();
  result record;
BEGIN
  INSERT INTO pg_temp.oauth_clients VALUES (test_client, null);
  INSERT INTO pg_temp.mcp_oauth_client_resources VALUES (test_client, 'https://www.tenderflow.cz/api/mcp', true);
  INSERT INTO pg_temp.oauth_consents VALUES (test_consent, test_client, test_user, now(), null);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', test_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', test_user::text, true);
  SELECT * INTO result FROM pg_temp.set_my_mcp_client_grant(test_client, 'tenderflow.contacts.read', true);
  IF result.expires_at IS DISTINCT FROM now() + interval '180 days' THEN
    RAISE EXCEPTION 'Contact grant must expire after 180 days; got %', result.expires_at - now();
  END IF;
  -- Explicit renewal updates the expiry and keeps an audit trail.
  UPDATE pg_temp.mcp_user_client_grants SET expires_at = now() + interval '1 day';
  PERFORM pg_temp.set_my_mcp_client_grant(test_client, 'tenderflow.contacts.read', true);
  IF NOT EXISTS (SELECT FROM pg_temp.mcp_permission_grant_audit WHERE action='renew'
    AND (new_state->>'expires_at')::timestamptz = now() + interval '180 days') THEN
    RAISE EXCEPTION 'Renewal not audited with 180-day expiry';
  END IF;
  SELECT * INTO result FROM pg_temp.set_my_mcp_client_grant(test_client, 'tenderflow.write', true);
  IF result.expires_at IS DISTINCT FROM 'infinity'::timestamptz THEN RAISE EXCEPTION 'Write lifetime changed'; END IF;
  SELECT * INTO result FROM pg_temp.set_my_mcp_client_grant(test_client, 'tenderflow.bids.offer.write', true);
  IF result.expires_at IS DISTINCT FROM 'infinity'::timestamptz THEN RAISE EXCEPTION 'Financial lifetime changed'; END IF;
  PERFORM pg_temp.set_my_mcp_client_grant(test_client, 'tenderflow.contacts.read', false);
  IF EXISTS (SELECT FROM pg_temp.mcp_user_client_grants WHERE permission='tenderflow.contacts.read' AND enabled) THEN
    RAISE EXCEPTION 'Contact revocation failed';
  END IF;
  -- Consent from another user must never authorize a grant.
  PERFORM set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  BEGIN
    PERFORM pg_temp.set_my_mcp_client_grant(test_client, 'tenderflow.contacts.read', true);
    RAISE EXCEPTION 'Foreign user grant unexpectedly accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub', test_user::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', test_user, 'client_id', test_client)::text, true);
  BEGIN
    PERFORM pg_temp.set_my_mcp_client_grant(test_client, 'tenderflow.contacts.read', true);
    RAISE EXCEPTION 'OAuth client self-elevation unexpectedly accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', test_user, 'azp', test_client)::text, true);
  BEGIN
    PERFORM pg_temp.set_my_mcp_client_grant(test_client, 'tenderflow.contacts.read', true);
    RAISE EXCEPTION 'OAuth azp self-elevation unexpectedly accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', test_user, 'role', 'authenticated')::text, true);
  UPDATE pg_temp.oauth_consents SET revoked_at=now();
  BEGIN
    PERFORM pg_temp.set_my_mcp_client_grant(test_client, 'tenderflow.contacts.read', true);
    RAISE EXCEPTION 'Revoked consent unexpectedly accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
SELECT 'PASS: 180-day grants/renewals, persistent writes, revocation, user isolation, OAuth self-elevation denial' AS result;
ROLLBACK;
