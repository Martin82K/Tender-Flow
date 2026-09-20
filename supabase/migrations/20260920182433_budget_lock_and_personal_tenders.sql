BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';

CREATE TABLE private.budget_edit_locks (
 project_id text PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
 locked boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1 CHECK(version>0)
);
CREATE TABLE private.personal_tender_defaults (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 definitions jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(definitions)='array' AND jsonb_array_length(definitions)<=500)
);
ALTER TABLE private.budget_edit_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.personal_tender_defaults ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.budget_edit_locks,private.personal_tender_defaults FROM PUBLIC,anon,authenticated,service_role;

-- Serialize edits and locking on the project, including import/restore and legacy RPCs.
CREATE FUNCTION private.budget_assert_unlocked(project_input text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.projects WHERE id=project_input FOR UPDATE;
 IF EXISTS(SELECT 1 FROM private.budget_edit_locks WHERE project_id=project_input AND locked)
    AND NOT EXISTS(SELECT 1 FROM private.construction_budget_purge_jobs WHERE project_id=project_input AND deletes_project AND completed_at IS NULL)
 THEN RAISE EXCEPTION 'Rozpočet je uzamčen. Před změnou jej odemkněte.' USING ERRCODE='55000'; END IF;
END $$;
CREATE FUNCTION private.budget_edit_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 -- FK anonymization on account deletion must preserve content, even when locked.
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'created_by'-'deleted_by') IS NOT DISTINCT FROM (to_jsonb(OLD)-'created_by'-'deleted_by')
    AND (to_jsonb(NEW)->>'created_by' IS NULL OR to_jsonb(NEW)->'created_by' IS NOT DISTINCT FROM to_jsonb(OLD)->'created_by')
    AND (to_jsonb(NEW)->>'deleted_by' IS NULL OR to_jsonb(NEW)->'deleted_by' IS NOT DISTINCT FROM to_jsonb(OLD)->'deleted_by')
 THEN RETURN NEW; END IF;
 PERFORM private.budget_assert_unlocked(CASE WHEN TG_OP='DELETE' THEN OLD.project_id ELSE NEW.project_id END);
 IF TG_OP='UPDATE' AND OLD.project_id IS DISTINCT FROM NEW.project_id THEN PERFORM private.budget_assert_unlocked(OLD.project_id); END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER budget_edit_lock BEFORE INSERT OR UPDATE OR DELETE ON public.construction_budget_revisions FOR EACH ROW EXECUTE FUNCTION private.budget_edit_guard();
CREATE TRIGGER budget_edit_lock BEFORE INSERT OR UPDATE OR DELETE ON public.construction_budget_sources FOR EACH ROW EXECUTE FUNCTION private.budget_edit_guard();
CREATE TRIGGER budget_edit_lock BEFORE INSERT OR UPDATE OR DELETE ON private.construction_budget_preferences FOR EACH ROW EXECUTE FUNCTION private.budget_edit_guard();

CREATE FUNCTION private.budget_set_lock(project_input text,locked_input boolean,version_input integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_lock private.budget_edit_locks;
BEGIN
 PERFORM 1 FROM public.projects WHERE id=project_input FOR UPDATE;
 IF NOT FOUND OR NOT private.budget_access(project_input,'edit') OR NOT private.budget_access(project_input,'prices')
 THEN RAISE EXCEPTION 'Změna zámku není povolena.' USING ERRCODE='42501'; END IF;
 IF locked_input IS NULL OR version_input IS NULL THEN RAISE EXCEPTION 'Neplatný stav zámku'; END IF;
 IF EXISTS(SELECT 1 FROM private.construction_budget_purge_jobs WHERE project_id=project_input AND completed_at IS NULL)
 THEN RAISE EXCEPTION 'Nejprve dokončete rozpracované mazání.'; END IF;
 SELECT * INTO current_lock FROM private.budget_edit_locks WHERE project_id=project_input;
 IF COALESCE(current_lock.version,0)<>version_input THEN RAISE EXCEPTION 'Zámek mezitím změnil jiný uživatel. Obnovte rozpočet.' USING ERRCODE='40001'; END IF;
 INSERT INTO private.budget_edit_locks(project_id,locked,version) VALUES(project_input,locked_input,1)
 ON CONFLICT(project_id) DO UPDATE SET locked=EXCLUDED.locked,version=budget_edit_locks.version+1 RETURNING * INTO current_lock;
 RETURN jsonb_build_object('locked',current_lock.locked,'lockVersion',current_lock.version);
END $$;
CREATE FUNCTION public.construction_budget_set_lock(project_input text,locked_input boolean,version_input integer) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.budget_set_lock(project_input,locked_input,version_input) $$;
-- Preserve the existing loader and its price redaction.
ALTER FUNCTION private.budget_load(text,uuid) RENAME TO budget_load_before_edit_lock;
CREATE FUNCTION private.budget_load(project_input text,revision_input uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 result:=private.budget_load_before_edit_lock(project_input,revision_input);
 IF revision_input IS NULL THEN
   result:=result||jsonb_build_object('locked',COALESCE((SELECT locked FROM private.budget_edit_locks WHERE project_id=project_input),false),
    'lockVersion',COALESCE((SELECT version FROM private.budget_edit_locks WHERE project_id=project_input),0));
 END IF;
 RETURN result;
END $$;
-- Rebind SQL wrappers, since renaming preserves their dependency on the old OID.
CREATE OR REPLACE FUNCTION public.construction_budget_load(project_input text,revision_input uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.budget_load(project_input,revision_input) $$;

CREATE FUNCTION private.validate_tender_definitions(definitions jsonb) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE entry jsonb;
BEGIN
 IF definitions IS NULL OR jsonb_typeof(definitions)<>'array' OR jsonb_array_length(definitions)>500 THEN RAISE EXCEPTION 'Číselník smí mít nejvýše 500 VŘ.'; END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(definitions) LOOP
   IF jsonb_typeof(entry)<>'object' OR jsonb_typeof(entry->'id') IS DISTINCT FROM 'string'
    OR length(entry->>'id') NOT BETWEEN 1 AND 100 OR jsonb_typeof(entry->'title') IS DISTINCT FROM 'string'
    OR length(btrim(entry->>'title')) NOT BETWEEN 1 AND 255 OR jsonb_typeof(entry->'externalCode') IS DISTINCT FROM 'string'
    OR length(entry->>'externalCode')>100 THEN RAISE EXCEPTION 'Vyplňte platné číslo a název VŘ.'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(definitions) e GROUP BY lower(btrim(e->>'title')) HAVING count(*)>1)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(definitions) e WHERE btrim(e->>'externalCode')<>'' GROUP BY btrim(e->>'externalCode') HAVING count(*)>1)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(definitions) e GROUP BY e->>'id' HAVING count(*)>1)
 THEN RAISE EXCEPTION 'Duplicitní název nebo číslo VŘ.'; END IF;
END $$;
-- Shared starting point is lazy: existing personal choices, including an empty list, win.
CREATE FUNCTION private.base_tender_definitions() RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $base$ SELECT '[{"id": "base-01", "title": "Zemní práce", "externalCode": "01"}, {"id": "base-02", "title": "Základy", "externalCode": "02"}, {"id": "base-03", "title": "Nosné konstrukce", "externalCode": "03"}, {"id": "base-04", "title": "Střecha", "externalCode": "04"}, {"id": "base-05", "title": "Izolace", "externalCode": "05"}, {"id": "base-06", "title": "Výplně otvorů", "externalCode": "06"}, {"id": "base-07", "title": "Fasáda", "externalCode": "07"}, {"id": "base-08", "title": "Vnitřní povrchy", "externalCode": "08"}, {"id": "base-09", "title": "Podlahy", "externalCode": "09"}, {"id": "base-10", "title": "Zdravotechnika", "externalCode": "10"}, {"id": "base-11", "title": "Vytápění", "externalCode": "11"}, {"id": "base-12", "title": "Vzduchotechnika", "externalCode": "12"}, {"id": "base-13", "title": "Elektroinstalace", "externalCode": "13"}, {"id": "base-14", "title": "Venkovní úpravy", "externalCode": "14"}]'::jsonb $base$;
REVOKE ALL ON FUNCTION private.base_tender_definitions() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.personal_tenders(definitions_input jsonb DEFAULT NULL,version_input integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE stored private.personal_tender_defaults; normalized jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid()) THEN RAISE EXCEPTION 'Přihlášení je vyžadováno.' USING ERRCODE='42501'; END IF;
 -- An actor-level lock also covers the first insert and concurrent empty catalogs.
 PERFORM 1 FROM auth.users WHERE id=auth.uid() FOR UPDATE;
 SELECT * INTO stored FROM private.personal_tender_defaults WHERE user_id=auth.uid();
 IF definitions_input IS NOT NULL THEN
   PERFORM private.validate_tender_definitions(definitions_input);
   IF version_input IS NULL OR version_input<>COALESCE(stored.version,0) THEN RAISE EXCEPTION 'Číselník se mezitím změnil. Načtěte jej znovu.' USING ERRCODE='40001'; END IF;
   SELECT COALESCE(jsonb_agg(jsonb_build_object('id',e->>'id','title',btrim(e->>'title'),'externalCode',btrim(e->>'externalCode')) ORDER BY ord),'[]') INTO normalized FROM jsonb_array_elements(definitions_input) WITH ORDINALITY AS entries(e,ord);
   INSERT INTO private.personal_tender_defaults(user_id,definitions) VALUES(auth.uid(),normalized)
   ON CONFLICT(user_id) DO UPDATE SET definitions=EXCLUDED.definitions,version=personal_tender_defaults.version+1 RETURNING * INTO stored;
 END IF;
 RETURN jsonb_build_object('version',COALESCE(stored.version,0),'definitions',COALESCE(stored.definitions,private.base_tender_definitions()));
END $$;
CREATE FUNCTION public.personal_tender_defaults(definitions_input jsonb DEFAULT NULL,version_input integer DEFAULT NULL) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.personal_tenders(definitions_input,version_input) $$;

CREATE FUNCTION private.copy_personal_tenders(project_input text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE entry jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.projects WHERE id=project_input AND owner_id=auth.uid()) THEN RAISE EXCEPTION 'Kopírování číselníku není povoleno.' USING ERRCODE='42501'; END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(COALESCE((SELECT definitions FROM private.personal_tender_defaults WHERE user_id=auth.uid()),private.base_tender_definitions())) LOOP
   INSERT INTO public.demand_categories(id,project_id,title,external_code,status,description,budget_display,sod_budget,plan_budget)
   VALUES(gen_random_uuid()::text,project_input,entry->>'title',NULLIF(entry->>'externalCode',''),'open','','',0,0);
 END LOOP;
END $$;
-- Only the normal creation path seeds defaults. Clone/backup restore retain their own definitions.
DO $migration$
DECLARE definition text; marker text:='FOR member IN SELECT value FROM jsonb_array_elements';
BEGIN
 SELECT pg_get_functiondef('public.create_project_with_team(text,text,text,text,uuid,jsonb)'::regprocedure) INTO definition;
 IF position(marker IN definition)=0 THEN RAISE EXCEPTION 'Unexpected project creation function'; END IF;
 definition:=replace(definition,marker,'PERFORM private.copy_personal_tenders(project_id_input);'||chr(10)||marker);
 EXECUTE definition;
END $migration$;

CREATE FUNCTION private.save_project_tender_catalog(project_input text,expected_input jsonb,definitions_input jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE catalog jsonb; entry jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('budget-categories:'||project_input,0));
 PERFORM 1 FROM public.projects WHERE id=project_input FOR UPDATE;
 IF NOT FOUND OR NOT private.budget_access(project_input,'read') OR NOT public.can_project_module_action(project_input,'module_pipeline',true)
 THEN RAISE EXCEPTION 'Úprava VŘ není povolena.' USING ERRCODE='42501'; END IF;
 PERFORM private.budget_assert_unlocked(project_input);
 PERFORM private.validate_tender_definitions(definitions_input);
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'title',title,'externalCode',COALESCE(external_code,'')) ORDER BY id),'[]') INTO catalog FROM public.demand_categories WHERE project_id=project_input;
 IF catalog IS DISTINCT FROM expected_input THEN RAISE EXCEPTION 'Seznam VŘ se mezitím změnil. Načtěte jej znovu.' USING ERRCODE='40001'; END IF;
 IF EXISTS(SELECT 1 FROM public.demand_categories c WHERE c.project_id=project_input AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(definitions_input) d WHERE d->>'id'=c.id))
 THEN RAISE EXCEPTION 'Existující projektové VŘ nelze odstranit z číselníku.'; END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(definitions_input) LOOP
   IF EXISTS(SELECT 1 FROM public.demand_categories WHERE id=entry->>'id' AND project_id<>project_input) THEN RAISE EXCEPTION 'Cizí VŘ' USING ERRCODE='42501'; END IF;
   INSERT INTO public.demand_categories(id,project_id,title,external_code,status,description,budget_display,sod_budget,plan_budget)
   VALUES(entry->>'id',project_input,btrim(entry->>'title'),NULLIF(btrim(entry->>'externalCode'),''),'open','','',0,0)
   ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,external_code=EXCLUDED.external_code WHERE demand_categories.project_id=project_input;
 END LOOP;
END $$;
CREATE FUNCTION public.save_project_tender_catalog(project_input text,expected_input jsonb,definitions_input jsonb) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.save_project_tender_catalog(project_input,expected_input,definitions_input) $$;

REVOKE ALL ON FUNCTION private.budget_assert_unlocked(text),private.budget_edit_guard(),private.validate_tender_definitions(jsonb),private.copy_personal_tenders(text),private.budget_load_before_edit_lock(text,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.budget_set_lock(text,boolean,integer),private.budget_load(text,uuid),private.personal_tenders(jsonb,integer),private.save_project_tender_catalog(text,jsonb,jsonb),public.construction_budget_set_lock(text,boolean,integer),public.personal_tender_defaults(jsonb,integer),public.save_project_tender_catalog(text,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.budget_set_lock(text,boolean,integer),private.budget_load(text,uuid),private.personal_tenders(jsonb,integer),private.save_project_tender_catalog(text,jsonb,jsonb),public.construction_budget_set_lock(text,boolean,integer),public.personal_tender_defaults(jsonb,integer),public.save_project_tender_catalog(text,jsonb,jsonb) TO authenticated;
-- Template-only imports must honor the same lock even when they create no revision.
DO $migration$
DECLARE definition text; marker text:='PERFORM pg_advisory_xact_lock(hashtextextended(''budget-categories:''||project_input,0));';
BEGIN
 SELECT pg_get_functiondef('private.budget_tender_import(text,jsonb)'::regprocedure) INTO definition;
 IF position(marker IN definition)=0 THEN RAISE EXCEPTION 'Unexpected tender import lock'; END IF;
 definition:=replace(definition,marker,marker||chr(10)||'PERFORM private.budget_assert_unlocked(project_input);');
 EXECUTE definition;
END $migration$;

-- Signed backup extension: actor-owned defaults are never restored into another account.
ALTER FUNCTION private.budget_backup_export(jsonb) RENAME TO budget_backup_export_before_personal_tenders;
ALTER FUNCTION private.budget_backup_restore(jsonb,uuid,text) RENAME TO budget_backup_restore_before_personal_tenders;
CREATE FUNCTION private.budget_backup_export(manifest jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; payload text;
BEGIN
 result:=private.budget_backup_export_before_personal_tenders(manifest);
 SELECT jsonb_build_object('kind','budget-editor-settings','version',1,'actor',auth.uid(),'organization_id',manifest->>'organization_id',
 'defaults',(SELECT definitions FROM private.personal_tender_defaults WHERE user_id=auth.uid()),
 'locks',COALESCE((SELECT jsonb_agg(jsonb_build_object('project_id',l.project_id,'locked',l.locked)) FROM private.budget_edit_locks l WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(manifest->'projects') p WHERE p->>'id'=l.project_id)),'[]'))::text INTO payload;
 RETURN result||jsonb_build_object('budget_editor_settings',jsonb_build_object('payload',payload,'signature',private.budget_backup_signature(payload)));
END $$;
CREATE FUNCTION private.budget_backup_restore(manifest jsonb,org_id uuid,scope text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE restored integer; envelope jsonb; snapshot jsonb; entry jsonb;
BEGIN
 restored:=private.budget_backup_restore_before_personal_tenders(manifest,org_id,scope);
 IF manifest ? 'budget_editor_settings' THEN
   envelope:=manifest->'budget_editor_settings';
   IF auth.uid() IS NULL OR envelope->>'payload' IS NULL OR envelope->>'signature' IS NULL
    OR private.budget_backup_signature(envelope->>'payload') IS DISTINCT FROM envelope->>'signature'
   THEN RAISE EXCEPTION 'Invalid budget editor backup signature' USING ERRCODE='42501'; END IF;
   snapshot:=(envelope->>'payload')::jsonb;
   IF snapshot->>'kind' IS DISTINCT FROM 'budget-editor-settings' OR snapshot->>'version' IS DISTINCT FROM '1'
    OR (snapshot->>'organization_id')::uuid IS DISTINCT FROM org_id THEN RAISE EXCEPTION 'Foreign budget editor backup' USING ERRCODE='42501'; END IF;
   IF scope='user' AND snapshot->>'defaults' IS NOT NULL THEN
     IF (snapshot->>'actor')::uuid IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Foreign personal tender defaults' USING ERRCODE='42501'; END IF;
     PERFORM private.validate_tender_definitions(snapshot->'defaults');
     INSERT INTO private.personal_tender_defaults(user_id,definitions) VALUES(auth.uid(),snapshot->'defaults') ON CONFLICT(user_id) DO NOTHING;
   END IF;
   FOR entry IN SELECT value FROM jsonb_array_elements(snapshot->'locks') LOOP
     IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(manifest->'projects') p WHERE p->>'id'=entry->>'project_id')
       OR NOT EXISTS(SELECT 1 FROM public.projects WHERE id=entry->>'project_id' AND organization_id=org_id AND (scope='tenant' OR owner_id=auth.uid()))
       OR NOT private.budget_access(entry->>'project_id','edit')
     THEN RAISE EXCEPTION 'Foreign budget lock' USING ERRCODE='42501'; END IF;
     INSERT INTO private.budget_edit_locks(project_id,locked) VALUES(entry->>'project_id',(entry->>'locked')::boolean) ON CONFLICT(project_id) DO NOTHING;
   END LOOP;
 END IF;
 RETURN restored;
END $$;
REVOKE ALL ON FUNCTION private.budget_backup_export(jsonb),private.budget_backup_restore(jsonb,uuid,text),private.budget_backup_export_before_personal_tenders(jsonb),private.budget_backup_restore_before_personal_tenders(jsonb,uuid,text) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
