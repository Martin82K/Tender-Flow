-- Povolí jednu desktopovou session a jednu mobilní doprovodnou session na uživatele.
-- Electron patří do desktopové třídy; nemobilní webový prohlížeč také, aby
-- pravidlo neotevřelo třetí paralelní desktop-web session mimo požadovaný
-- model 1x desktop + 1x mobile.

CREATE OR REPLACE FUNCTION public.get_auth_session_client_kind(p_user_agent TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(p_user_agent, '') ~* '(iphone|ipad|ipod|android|mobile|windows phone|iemobile|opera mini|blackberry)'
      THEN 'mobile'
    ELSE 'desktop'
  END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_client_kind TEXT;
BEGIN
  -- Toto je UX limit pro sessions, ne bezpečnostní atestace zařízení.
  -- User agent se používá pouze k tomu, aby mobilní náhled neodpojil desktop;
  -- autorizace dál stojí na Supabase Auth + RLS.
  new_client_kind := public.get_auth_session_client_kind(
    COALESCE(to_jsonb(NEW) ->> 'user_agent', '')
  );

  DELETE FROM auth.sessions existing_session
  WHERE existing_session.user_id = NEW.user_id
    AND existing_session.id <> NEW.id
    AND public.get_auth_session_client_kind(
      COALESCE(to_jsonb(existing_session) ->> 'user_agent', '')
    ) = new_client_kind;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_session_created ON auth.sessions;

CREATE TRIGGER on_auth_session_created
  AFTER INSERT ON auth.sessions
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_session();
