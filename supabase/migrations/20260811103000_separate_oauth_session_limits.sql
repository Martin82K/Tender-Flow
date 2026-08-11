-- Keep interactive Tender Flow sessions independent from long-lived OAuth clients.
-- First-party logins retain the existing three-session cap. Each OAuth client
-- gets one session per user, so reconnecting revokes only that client's prior
-- refresh-token chain instead of competing with browser and desktop sessions.

CREATE OR REPLACE FUNCTION public.handle_new_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  MAX_FIRST_PARTY_SESSIONS CONSTANT INTEGER := 3;
  MAX_OAUTH_SESSIONS_PER_CLIENT CONSTANT INTEGER := 1;
  session_limit INTEGER;
BEGIN
  -- Serialize every session insertion for one user. The lock is intentionally
  -- broader than a bucket so concurrent first-party and OAuth logins cannot
  -- observe inconsistent session sets.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW.user_id::TEXT, 0)
  );

  session_limit := CASE
    WHEN NEW.oauth_client_id IS NULL THEN MAX_FIRST_PARTY_SESSIONS
    ELSE MAX_OAUTH_SESSIONS_PER_CLIENT
  END;

  WITH overflow_sessions AS (
    SELECT existing_session.id
    FROM auth.sessions AS existing_session
    WHERE existing_session.user_id = NEW.user_id
      AND (
        (
          NEW.oauth_client_id IS NULL
          AND existing_session.oauth_client_id IS NULL
        )
        OR (
          NEW.oauth_client_id IS NOT NULL
          AND existing_session.oauth_client_id = NEW.oauth_client_id
        )
      )
    ORDER BY
      (existing_session.id = NEW.id) DESC,
      existing_session.created_at DESC,
      existing_session.id DESC
    OFFSET session_limit
  )
  DELETE FROM auth.sessions AS session_to_revoke
  USING overflow_sessions
  WHERE session_to_revoke.id = overflow_sessions.id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_session() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_session_created ON auth.sessions;

CREATE TRIGGER on_auth_session_created
  AFTER INSERT ON auth.sessions
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_session();

COMMENT ON FUNCTION public.handle_new_session() IS
  'Limits first-party sessions to three per user and OAuth sessions to one per user/client without cross-bucket eviction.';
