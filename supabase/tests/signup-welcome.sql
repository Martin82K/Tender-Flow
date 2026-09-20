-- Replace the delivery function transactionally; no external mail is sent.
BEGIN;
CREATE TEMP TABLE welcome_deliveries(user_id uuid);
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN INSERT INTO pg_temp.welcome_deliveries VALUES(NEW.id); RETURN NEW; END $$;
DO $$ DECLARE u uuid:=gen_random_uuid(); oauth_user uuid:=gen_random_uuid(); BEGIN
  INSERT INTO auth.users(id,email) VALUES(u,u||'@gmail.com');
  IF EXISTS(SELECT 1 FROM pg_temp.welcome_deliveries WHERE user_id=u) THEN RAISE EXCEPTION 'Unverified insert must not send a welcome email'; END IF;
  UPDATE auth.users SET email_confirmed_at=now() WHERE id=u;
  UPDATE auth.users SET email_confirmed_at=now() WHERE id=u;
  IF (SELECT count(*) FROM pg_temp.welcome_deliveries WHERE user_id=u)<>1 THEN RAISE EXCEPTION 'First confirmation must send exactly one welcome'; END IF;
  INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(oauth_user,oauth_user||'@gmail.com',now());
  IF (SELECT count(*) FROM pg_temp.welcome_deliveries WHERE user_id=oauth_user)<>1 THEN RAISE EXCEPTION 'Confirmed OAuth insert must preserve welcome'; END IF;
END $$;
ROLLBACK;
