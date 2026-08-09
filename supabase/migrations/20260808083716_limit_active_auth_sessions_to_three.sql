-- Povolí nejvýše tři souběžné přihlašovací session na uživatele.
-- Nová session má vždy přednost; při čtvrtém přihlášení se revokuje nejstarší.
-- Platforma ani user agent nejsou autorizační signál a limit neovlivňují.

CREATE OR REPLACE FUNCTION public.handle_new_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  MAX_ACTIVE_SESSIONS CONSTANT INTEGER := 3;
BEGIN
  -- Souběžná přihlášení stejného uživatele musí limit vyhodnotit sériově.
  -- Kolize hashů pouze zbytečně serializuje různé uživatele; limit neoslabí.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW.user_id::TEXT, 0)
  );

  WITH overflow_sessions AS (
    SELECT existing_session.id
    FROM auth.sessions AS existing_session
    WHERE existing_session.user_id = NEW.user_id
    ORDER BY
      (existing_session.id = NEW.id) DESC,
      existing_session.created_at DESC,
      existing_session.id DESC
    OFFSET MAX_ACTIVE_SESSIONS
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

DROP FUNCTION IF EXISTS public.get_auth_session_client_kind(TEXT);
