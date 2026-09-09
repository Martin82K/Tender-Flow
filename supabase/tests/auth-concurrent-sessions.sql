-- Runs the deployed trigger against temporary fixtures; never changes live sessions.
BEGIN;
CREATE TEMP TABLE sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  oauth_client_id uuid,
  created_at timestamptz NOT NULL
);
CREATE TEMP TABLE test_refresh_tokens (
  session_id uuid PRIMARY KEY REFERENCES pg_temp.sessions(id) ON DELETE CASCADE
);
DO $$
DECLARE definition text := pg_get_functiondef('public.handle_new_session()'::regprocedure);
BEGIN
  definition := replace(definition, 'public.handle_new_session', 'pg_temp.handle_new_session');
  definition := replace(definition, 'auth.sessions', 'pg_temp.sessions');
  EXECUTE definition;
END;
$$;
CREATE TRIGGER on_auth_session_created AFTER INSERT ON pg_temp.sessions
  FOR EACH ROW EXECUTE FUNCTION pg_temp.handle_new_session();
DO $$
DECLARE
  test_user uuid := gen_random_uuid();
  other_user uuid := gen_random_uuid();
  client_a uuid := gen_random_uuid();
  client_b uuid := gen_random_uuid();
  bucket_user uuid;
  bucket_client uuid;
  oldest_id uuid;
  newest_id uuid;
  bucket integer;
  ordinal integer;
BEGIN
  -- Two users and two MCP clients, plus ordinary web/desktop sessions.
  FOR bucket IN 1..4 LOOP
    bucket_user := CASE WHEN bucket = 4 THEN other_user ELSE test_user END;
    bucket_client := CASE WHEN bucket IN (2, 4) THEN client_a WHEN bucket = 3 THEN client_b ELSE NULL END;
    FOR ordinal IN 1..10 LOOP
      newest_id := gen_random_uuid();
      INSERT INTO pg_temp.sessions VALUES (newest_id, bucket_user, bucket_client, now() + ordinal * interval '1 second');
      INSERT INTO pg_temp.test_refresh_tokens VALUES (newest_id);
    END LOOP;
    IF (SELECT count(*) FROM pg_temp.sessions WHERE user_id=bucket_user
        AND oauth_client_id IS NOT DISTINCT FROM bucket_client) <> 10 THEN
      RAISE EXCEPTION 'Ten concurrent sessions must survive in bucket %', bucket;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_temp.sessions) <> 40 THEN
    RAISE EXCEPTION 'A user or client displaced another bucket';
  END IF;
  -- Each eleventh login evicts only its oldest session and refresh-token chain.
  FOR bucket IN 1..4 LOOP
    bucket_user := CASE WHEN bucket = 4 THEN other_user ELSE test_user END;
    bucket_client := CASE WHEN bucket IN (2, 4) THEN client_a WHEN bucket = 3 THEN client_b ELSE NULL END;
    SELECT id INTO oldest_id FROM pg_temp.sessions WHERE user_id=bucket_user
      AND oauth_client_id IS NOT DISTINCT FROM bucket_client ORDER BY created_at, id LIMIT 1;
    newest_id := gen_random_uuid();
    -- The just-created session survives even with equal timestamps / clock skew.
    INSERT INTO pg_temp.sessions VALUES (newest_id, bucket_user, bucket_client, now());
    INSERT INTO pg_temp.test_refresh_tokens VALUES (newest_id);
    IF EXISTS (SELECT FROM pg_temp.sessions WHERE id=oldest_id)
       OR EXISTS (SELECT FROM pg_temp.test_refresh_tokens WHERE session_id=oldest_id)
       OR NOT EXISTS (SELECT FROM pg_temp.sessions WHERE id=newest_id)
       OR (SELECT count(*) FROM pg_temp.sessions) <> 40 THEN
      RAISE EXCEPTION 'Eleventh login evicted an incorrect session in bucket %', bucket;
    END IF;
  END LOOP;
  DELETE FROM pg_temp.sessions WHERE id=newest_id AND user_id=other_user;
  IF (SELECT count(*) FROM pg_temp.sessions WHERE user_id=test_user) <> 30
     OR (SELECT count(*) FROM pg_temp.sessions WHERE user_id=other_user) <> 9 THEN
    RAISE EXCEPTION 'Targeted revocation affected other sessions';
  END IF;
END;
$$;
SELECT 'PASS: ten sessions per bucket, client/user isolation, oldest-only eviction, refresh-chain cleanup, targeted revocation' AS result;
ROLLBACK;
