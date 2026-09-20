-- Disposable local fixture; caller wraps BEGIN/ROLLBACK.
DO $$
DECLARE org uuid:='82000000-0000-4000-8000-000000000002'; manifest jsonb; bad jsonb; denied boolean; category uuid;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','82000000-0000-4000-8000-000000000001',true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 INSERT INTO public.construction_budget_catalog(organization_id,kind,name) VALUES(org,'tag','Catalog-only fixture') RETURNING id INTO category;
 -- No exported projects and therefore no source/revision can carry the catalog.
 manifest:=private.budget_backup_export(jsonb_build_object('organization_id',org,'projects','[]'::jsonb));
 IF NOT manifest ? 'construction_budget_catalog' THEN RAISE EXCEPTION 'Catalog-only backup omitted'; END IF;
 IF jsonb_array_length(((manifest#>>'{construction_budget_catalog,payload}')::jsonb)->'items')<>1 THEN RAISE EXCEPTION 'Catalog count mismatch'; END IF;
 bad:=jsonb_set(manifest,'{construction_budget_catalog,payload}',to_jsonb((manifest#>>'{construction_budget_catalog,payload}')||' '));
 denied:=false;
 BEGIN PERFORM private.budget_backup_restore(bad,org,'tenant'); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Tampered catalog signature accepted'; END IF;
 DELETE FROM public.construction_budget_catalog WHERE id=category;
 PERFORM private.budget_backup_restore(manifest,org,'tenant');
 IF (SELECT count(*) FROM public.construction_budget_catalog WHERE id=category AND organization_id=org)<>1 THEN RAISE EXCEPTION 'Catalog-only restore failed'; END IF;
 PERFORM private.budget_backup_restore(manifest,org,'tenant');
 IF (SELECT count(*) FROM public.construction_budget_catalog WHERE id=category)<>1 THEN RAISE EXCEPTION 'Restore is not idempotent'; END IF;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
 denied:=false;
 BEGIN PERFORM private.budget_backup_restore(manifest,org,'tenant'); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Foreign catalog restore accepted'; END IF;
END $$;
SELECT 'catalog-only signed backup, restore count, tamper and foreign actor passed' AS result;
