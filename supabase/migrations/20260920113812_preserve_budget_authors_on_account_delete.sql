BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
-- Author identity is audit metadata, not ownership or an authorization grant.
-- Retain budgets/history/jobs on account deletion; revoke ephemeral upload grants.
DO $migration$
DECLARE item record; constraint_name text; definition text;
BEGIN
 FOR item IN SELECT * FROM (VALUES
   ('public','construction_budget_sources','created_by','SET NULL'),
   ('public','construction_budget_sources','deleted_by','SET NULL'),
   ('public','construction_budget_revisions','created_by','SET NULL'),
   ('public','construction_budget_revisions','deleted_by','SET NULL'),
   ('public','construction_budget_history','actor_id','SET NULL'),
   ('private','construction_budget_purge_jobs','actor_id','SET NULL'),
   ('private','construction_budget_restore_files','actor_id','CASCADE')
 ) AS fields(schema_name,table_name,column_name,delete_action) LOOP
   SELECT c.conname INTO constraint_name FROM pg_constraint c
   JOIN pg_attribute a ON a.attrelid=c.conrelid AND c.conkey=ARRAY[a.attnum]
   WHERE c.conrelid=format('%I.%I',item.schema_name,item.table_name)::regclass
     AND c.confrelid='auth.users'::regclass AND c.contype='f' AND a.attname=item.column_name;
   IF constraint_name IS NULL THEN RAISE EXCEPTION 'Missing budget author foreign key'; END IF;
   IF item.delete_action='SET NULL' THEN
     EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I DROP NOT NULL',item.schema_name,item.table_name,item.column_name);
   END IF;
   EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I, ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE %s NOT VALID',item.schema_name,item.table_name,constraint_name,constraint_name,item.column_name,item.delete_action);
   EXECUTE format('ALTER TABLE %I.%I VALIDATE CONSTRAINT %I',item.schema_name,item.table_name,constraint_name);
 END LOOP;
 SELECT pg_get_functiondef('private.budget_backup_restore_projects(jsonb,uuid,text)'::regprocedure) INTO definition;
 IF position('source.created_by:=auth.uid()' IN definition)=0 OR position('revision.created_by:=auth.uid()' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected budget author restore'; END IF;
 definition:=replace(definition,'source.created_by:=auth.uid()','source.created_by:=NULL');
 definition:=replace(definition,'IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=source.created_by)', 'IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=source.deleted_by) THEN source.deleted_by:=NULL; END IF; IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=source.created_by)');
 definition:=replace(definition,'revision.created_by:=auth.uid()','revision.created_by:=NULL');
 definition:=replace(definition,'IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=revision.created_by)', 'IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=revision.deleted_by) THEN revision.deleted_by:=NULL; END IF; IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=revision.created_by)');
 definition:=replace(definition,'COALESCE((SELECT id FROM auth.users WHERE id=(item->>''actor_id'')::uuid),auth.uid())','(SELECT id FROM auth.users WHERE id=(item->>''actor_id'')::uuid)');
 EXECUTE definition;
END $migration$;
-- FK anonymization may touch audit links even while content is locked for purge.
CREATE OR REPLACE FUNCTION private.budget_purge_lock() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF OLD.purge_job_id IS NOT NULL AND NOT (
   (to_jsonb(NEW)-'created_by'-'deleted_by') IS NOT DISTINCT FROM (to_jsonb(OLD)-'created_by'-'deleted_by')
   AND (NEW.created_by IS NULL OR NEW.created_by IS NOT DISTINCT FROM OLD.created_by)
   AND (NEW.deleted_by IS NULL OR NEW.deleted_by IS NOT DISTINCT FROM OLD.deleted_by)
 ) THEN RAISE EXCEPTION 'Probíhá trvalé mazání. Správce musí dokončit operaci v koši.'; END IF;
 RETURN NEW;
END $$;
COMMIT;
