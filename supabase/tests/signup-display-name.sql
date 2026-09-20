BEGIN;
DO $$ DECLARE u uuid:=gen_random_uuid(); BEGIN
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(u,u||'@gmail.com',jsonb_build_object('name',repeat('Ž',300)));
  UPDATE auth.users SET email_confirmed_at=now() WHERE id=u;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=u AND email_confirmed_at IS NOT NULL)
     OR NOT EXISTS(SELECT 1 FROM public.organizations WHERE owner_user_id=u AND name=repeat('Ž',255)) THEN
    RAISE EXCEPTION 'Oversized legacy metadata must confirm safely with a bounded organization name';
  END IF;
END $$;
ROLLBACK;
