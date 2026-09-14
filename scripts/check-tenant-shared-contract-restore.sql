-- Run in a disposable PostgreSQL session. Only temporary fixtures are written;
-- the deployed wrapper is cloned verbatim, with references redirected to them.
BEGIN;
CREATE TEMP TABLE contracts(id uuid PRIMARY KEY,project_id text,source_bid_id text,organization_id uuid,owner_id uuid);
CREATE TEMP TABLE projects(id text PRIMARY KEY,owner_id uuid);
CREATE TEMP TABLE project_shares(project_id text,user_id uuid,permission text);
CREATE TEMP TABLE demand_categories(id text PRIMARY KEY,project_id text);
CREATE TEMP TABLE bids(id text PRIMARY KEY,demand_category_id text);
CREATE TEMP TABLE contract_bid_links(bid_id text PRIMARY KEY,contract_id uuid,project_id text,category_id text UNIQUE);
CREATE FUNCTION pg_temp.test_uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user_id',true),'')::uuid $$;
CREATE FUNCTION pg_temp.is_org_admin(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT pg_temp.test_uid() IS NOT NULL AND current_setting('test.is_admin',true)='yes' AND $1='00000000-0000-0000-0000-000000000100'::uuid $$;
CREATE FUNCTION pg_temp.has_active_subscription() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE FUNCTION pg_temp.user_has_feature(text) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE FUNCTION pg_temp.can_project_module_action(text,text,boolean) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE FUNCTION pg_temp.restore_tenant_backup_before_shared_tenders(jsonb,uuid) RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN
  IF NOT pg_temp.is_org_admin($2) THEN RAISE EXCEPTION 'admin required' USING ERRCODE='42501'; END IF;
  RETURN '{}'::jsonb;
END $$;
INSERT INTO projects VALUES('p1','00000000-0000-0000-0000-000000000020'),('p2','00000000-0000-0000-0000-000000000020');
INSERT INTO contracts VALUES('00000000-0000-0000-0000-000000000001','p1',null,'00000000-0000-0000-0000-000000000100','00000000-0000-0000-0000-000000000020');
INSERT INTO demand_categories VALUES('cat1','p1'),('cat2','p2');
INSERT INTO bids VALUES('b1','cat1'),('b2','cat2');
DO $$ BEGIN EXECUTE replace(replace(pg_get_functiondef('public.restore_tenant_backup(jsonb,uuid)'::regprocedure),'public.','pg_temp.'),'auth.uid()','pg_temp.test_uid()'); END $$;
-- APPLY_PATCH_HERE
SET LOCAL test.user_id='00000000-0000-0000-0000-000000000010';
SET LOCAL test.is_admin='yes';
SELECT pg_temp.restore_tenant_backup('{"contracts":[{"id":"00000000-0000-0000-0000-000000000001","contract_bid_links":[{"bid_id":"b1"}]}]}','00000000-0000-0000-0000-000000000100');
DO $$ BEGIN
  IF (SELECT count(*) FROM pg_temp.contract_bid_links)<>1 THEN RAISE EXCEPTION 'admin restore did not create link'; END IF;
  BEGIN
    PERFORM pg_temp.restore_tenant_backup('{"contracts":[{"id":"00000000-0000-0000-0000-000000000001","contract_bid_links":[{"bid_id":"b2"}]}]}','00000000-0000-0000-0000-000000000100');
    RAISE EXCEPTION 'cross-project link accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    PERFORM pg_temp.restore_tenant_backup('{}','00000000-0000-0000-0000-000000000200');
    RAISE EXCEPTION 'foreign tenant accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET LOCAL test.is_admin='no';
DO $$ BEGIN
  BEGIN
    PERFORM pg_temp.restore_tenant_backup('{}','00000000-0000-0000-0000-000000000100');
    RAISE EXCEPTION 'non-admin accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET LOCAL test.is_admin='yes';
SET LOCAL test.user_id='';
DO $$ BEGIN
  BEGIN
    PERFORM pg_temp.restore_tenant_backup('{}','00000000-0000-0000-0000-000000000100');
    RAISE EXCEPTION 'anonymous accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT 'tenant restore: admin without personal rights, cross-project, cross-tenant, non-admin and anonymous checks passed' AS result;
ROLLBACK;
