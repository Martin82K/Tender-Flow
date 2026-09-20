-- Disposable local fixture; caller wraps BEGIN/ROLLBACK.
DO $$
DECLARE pid text:='budget-primary-fixture'; org uuid:='82000000-0000-4000-8000-000000000002'; src jsonb; manifest jsonb; doc jsonb:='{"schemaVersion":1,"origin":"import","nodes":[],"sheets":[],"issues":[],"figures":{}}';
BEGIN
 PERFORM set_config('request.jwt.claim.sub','82000000-0000-4000-8000-000000000001',true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 src:=public.construction_budget_source(pid,'dates.xlsx',repeat('9',64),'attachment');
 FOR i IN 1..3 LOOP
   PERFORM public.construction_budget_save(pid,(src->>'id')::uuid,NULL,0,'Import '||i,doc,'[]',false);
 END LOOP;
 -- Deliberately invert creation chronology relative to signed UUID ordering.
 UPDATE public.construction_budget_revisions r SET created_at='2026-01-04'::timestamptz - ordered.n*interval '1 day'
 FROM (SELECT id,row_number() OVER(ORDER BY id) n FROM public.construction_budget_revisions WHERE project_id=pid) ordered WHERE r.id=ordered.id;
 UPDATE public.construction_budget_sources SET first_converted_at='2026-01-01',last_converted_at='2026-01-03',status='attachment' WHERE id=(src->>'id')::uuid;
 manifest:=private.budget_backup_export(jsonb_build_object('organization_id',org,'projects',jsonb_build_array(jsonb_build_object('id',pid))));
 DELETE FROM public.construction_budget_history WHERE project_id=pid;
 DELETE FROM public.construction_budget_revisions WHERE project_id=pid;
 DELETE FROM public.construction_budget_sources WHERE project_id=pid;
 IF private.budget_backup_restore(manifest,org,'user')<>3 THEN RAISE EXCEPTION 'Missing restored imports'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.construction_budget_sources WHERE id=(src->>'id')::uuid AND first_converted_at='2026-01-01' AND last_converted_at='2026-01-03') THEN RAISE EXCEPTION 'UUID restore order changed conversion range'; END IF;
 IF private.budget_backup_restore(manifest,org,'user')<>0 THEN RAISE EXCEPTION 'Repeated restore not idempotent'; END IF;
END $$;
SELECT 'out-of-order signed restore preserves conversion date range and retry' AS result;
