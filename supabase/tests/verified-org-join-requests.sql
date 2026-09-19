-- Synthetic auth users in an isolated schema only; all changes roll back.
BEGIN;
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES ('96200000-0000-4000-8000-000000000001','owner@verified-join-fixture.invalid',now());
UPDATE public.organizations SET max_seats=2 WHERE owner_user_id='96200000-0000-4000-8000-000000000001';
INSERT INTO auth.users(id,email) VALUES ('96200000-0000-4000-8000-000000000002','pending@verified-join-fixture.invalid');
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.organization_members WHERE user_id='96200000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Unverified signup must not reserve membership through a legacy trigger'; END IF;
 IF EXISTS(SELECT 1 FROM public.organization_join_requests WHERE user_id='96200000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Unverified signup must not create a join request'; END IF;
END $$;
-- Simulate a pre-existing pending request from the legacy trigger.
INSERT INTO public.organization_join_requests(id,organization_id,user_id,email)
SELECT '96200000-0000-4000-8000-000000000010',id,'96200000-0000-4000-8000-000000000002','pending@verified-join-fixture.invalid' FROM public.organizations WHERE owner_user_id='96200000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"96200000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $$ DECLARE denied boolean := false; BEGIN
 BEGIN PERFORM public.approve_org_join_request('96200000-0000-4000-8000-000000000010'); EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Owner must not approve an unverified identity'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
UPDATE auth.users SET email_confirmed_at=now() WHERE id='96200000-0000-4000-8000-000000000002';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.organization_join_requests WHERE id='96200000-0000-4000-8000-000000000010' AND status='approved') THEN RAISE EXCEPTION 'Automatic join must close the stale pending request'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organization_members om JOIN public.organizations o ON o.id=om.organization_id WHERE om.user_id='96200000-0000-4000-8000-000000000002' AND o.type='business' AND om.is_active) THEN RAISE EXCEPTION 'Confirmed user must join available seat'; END IF;
END $$;
INSERT INTO auth.users(id,email) VALUES ('96200000-0000-4000-8000-000000000003','full@verified-join-fixture.invalid');
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.organization_join_requests WHERE user_id='96200000-0000-4000-8000-000000000003') THEN RAISE EXCEPTION 'Full tenant request must wait for confirmation'; END IF;
END $$;
UPDATE auth.users SET email_confirmed_at=now() WHERE id='96200000-0000-4000-8000-000000000003';
DO $$ BEGIN
 IF (SELECT count(*) FROM public.organization_join_requests WHERE user_id='96200000-0000-4000-8000-000000000003' AND status='pending')<>1 THEN RAISE EXCEPTION 'Confirmed full-tenant user must retain one pending request'; END IF;
 IF EXISTS(SELECT 1 FROM public.organizations WHERE owner_user_id='96200000-0000-4000-8000-000000000003' AND subscription_status='trial') THEN RAISE EXCEPTION 'Pending join must not mint trial'; END IF;
END $$;
ROLLBACK;
