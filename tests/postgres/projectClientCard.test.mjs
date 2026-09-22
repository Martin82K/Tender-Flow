// Isolated PostgreSQL/WASM; no credentials or customer data. Authorization helpers
// are fixture-controlled; the card's actual RLS, triggers and constraints execute.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
assert.ok(process.env.PGLITE_MODULE, 'Set PGLITE_MODULE to the audited PGlite entry.');
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const read = name => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const owner = '00000000-0000-0000-0000-000000000001';
const editor = '00000000-0000-0000-0000-000000000002';
const outsider = '00000000-0000-0000-0000-000000000003';
const org = '00000000-0000-0000-0000-000000000010';
const foreignOrg = '00000000-0000-0000-0000-000000000020';
async function fixture() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE ROLE tenderflow_mcp_client;
    CREATE SCHEMA auth; CREATE SCHEMA private;
    GRANT USAGE ON SCHEMA auth, private TO authenticated;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('test.actor',true),'')::uuid $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE organizations(id uuid PRIMARY KEY);
    CREATE TABLE projects(id varchar(36) PRIMARY KEY, organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE, owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, status text);
    CREATE TABLE project_shares(project_id varchar(36),user_id uuid,permission text);
    GRANT SELECT ON projects, project_shares TO authenticated;
    CREATE FUNCTION is_org_member(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1='${org}' AND auth.uid() IN ('${owner}'::uuid,'${editor}'::uuid) $$;
    CREATE FUNCTION is_org_admin(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1='${org}' AND auth.uid()='${owner}'::uuid $$;
    CREATE FUNCTION has_active_subscription() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('test.subscription',true)='yes' $$;
    CREATE FUNCTION has_resource_subscription(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT public.has_active_subscription() $$;
    CREATE FUNCTION has_project_subscription(text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT public.has_active_subscription() $$;
    CREATE FUNCTION project_has_feature(text,text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('test.module',true)='yes' $$;
    CREATE FUNCTION can_project_action(text,text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.projects WHERE id=$1 AND owner_id=auth.uid()) AND $2='restore' $$;
    CREATE FUNCTION can_project_module_action(text,text,boolean) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('test.module',true)='yes' AND (NOT $3 OR NOT EXISTS(SELECT 1 FROM public.projects WHERE id=$1 AND status='archived')) $$;
    SET test.actor='${owner}'; SET test.subscription='yes'; SET test.module='yes';
    INSERT INTO auth.users VALUES('${owner}'),('${editor}'),('${outsider}');
    INSERT INTO organizations VALUES('${org}'),('${foreignOrg}');
    INSERT INTO projects VALUES('p','${org}','${owner}','tender'),('shared','${org}','${owner}','tender'),('foreign','${foreignOrg}','${outsider}','tender');
    INSERT INTO project_shares VALUES('shared','${editor}','view');
    CREATE TABLE backup_history(record_counts jsonb);
  `);
  const archive = read('20260808120000_project_teams_contract_overview.sql');
  await db.exec(archive.slice(archive.indexOf('CREATE OR REPLACE FUNCTION public.guard_archived_project_write()'), archive.indexOf('DO $$\nDECLARE spec TEXT[]', archive.indexOf('CREATE OR REPLACE FUNCTION public.guard_archived_project_write()'))));
  for (const scope of ['user', 'tenant']) {
    await db.exec(`CREATE FUNCTION public.export_${scope}_backup_before_shared_tenders(target_org_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
      DECLARE result jsonb; rec_counts jsonb;
      BEGIN
        IF auth.uid() IS NULL OR NOT public.is_org_member(target_org_id) OR ('${scope}'='tenant' AND NOT public.is_org_admin(target_org_id)) THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501'; END IF;
        result:=jsonb_build_object('organization_id',target_org_id,'type','${scope}','projects',COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM public.projects p WHERE p.organization_id=target_org_id AND ('${scope}'='tenant' OR p.owner_id=auth.uid())),'[]'::jsonb));
        rec_counts := jsonb_build_object('projects',jsonb_array_length(result->'projects'));
        INSERT INTO public.backup_history VALUES(rec_counts);
        RETURN result;
      END $$;
      CREATE FUNCTION public.export_${scope}_backup(target_org_id uuid,include_budget_files boolean DEFAULT false) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT public.export_${scope}_backup_before_shared_tenders(target_org_id) $$;
      CREATE FUNCTION public.restore_${scope}_backup(backup_json jsonb,target_org_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
      DECLARE result jsonb := '{"success":true}'; BEGIN
        IF auth.uid() IS NULL OR NOT public.is_org_member(target_org_id) OR ('${scope}'='tenant' AND NOT public.is_org_admin(target_org_id)) THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501'; END IF;
        RETURN result || jsonb_build_object('restored_construction_budget_sources','{}'::jsonb);
      END $$;`);
  }
  // Existing clone authorization is covered separately; this fixture exercises the
  // migration's patch of the existing function and copied card constraints.
  await db.exec(`CREATE FUNCTION public.clone_tender_project_to_realization(project_id_input varchar) RETURNS TABLE(cloned_project_id varchar) LANGUAGE plpgsql SECURITY DEFINER AS $$
    DECLARE v_source_project public.projects; v_new_project_id varchar(36):='cloned'; BEGIN
      SELECT * INTO v_source_project FROM public.projects WHERE id=project_id_input AND owner_id=auth.uid();
      IF NOT FOUND THEN RAISE EXCEPTION 'denied'; END IF;
      INSERT INTO public.projects VALUES(v_new_project_id,v_source_project.organization_id,auth.uid(),'realization');
      RETURN QUERY SELECT v_new_project_id;
    END $$;`);
  await db.exec(read('20260921221000_project_client_cards.sql'));
  await db.exec(read('20260922053348_project_client_card_lifecycle.sql'));
  return db;
}
const card = (pid='p', organization=org) => ({project_id:pid,organization_id:organization,company_name:'Firma',ico:'27074358',created_at:'2026-01-01T00:00:00Z'});
const manifest = (cards=[card()]) => ({organization_id:org,projects:cards.map(c=>({id:c.project_id})),project_client_cards:cards});
const insert = (db,pid='p') => db.query('INSERT INTO project_client_cards(project_id,organization_id,company_name,ico) VALUES($1,$2,$3,$4)',[pid,org,' Firma ','27074358']);
const restore = (db,m=manifest(),scope='user') => db.query(`SELECT public.restore_${scope}_backup($1,$2) result`,[m,org]).then(r=>r.rows[0].result);

test('exports only authorized project cards and records their count; restores missing cards idempotently for both scopes',async()=>{
  const db=await fixture(); try {
    await insert(db); await insert(db,'shared');
    for(const scope of ['user','tenant']) {
      const exported=(await db.query(`SELECT export_${scope}_backup($1,true) result`,[org])).rows[0].result;
      assert.equal(exported.project_client_cards.length,2);
      assert.equal((await db.query('SELECT record_counts FROM backup_history ORDER BY ctid DESC LIMIT 1')).rows[0].record_counts.project_client_cards,2);
      await db.exec('DELETE FROM project_client_cards');
      assert.equal((await restore(db,exported,scope)).restored_project_client_cards,2);
      await db.exec("UPDATE project_client_cards SET company_name='Novější' WHERE project_id='p'");
      assert.equal((await restore(db,exported,scope)).restored_project_client_cards,0);
      assert.equal((await db.query("SELECT company_name FROM project_client_cards WHERE project_id='p'")).rows[0].company_name,'Novější');
    }
    assert.equal((await restore(db,{projects:[]})).restored_project_client_cards,0);
  } finally {await db.close();}
});

test('denies forged tenant/project payloads, unauthorized restore and malformed cards atomically',async()=>{
  const db=await fixture(); try {
    for(const m of [manifest([card('foreign',foreignOrg)]),{...manifest(),projects:[]},{...manifest(),organization_id:foreignOrg},manifest([card(),{...card('shared'),ico:'12345678'}])]) {
      await assert.rejects(restore(db,m));
      assert.equal((await db.query('SELECT count(*)::int n FROM project_client_cards')).rows[0].n,0);
    }
    await db.exec(`SET test.actor='${editor}'`);
    await assert.rejects(restore(db)); await assert.rejects(restore(db,manifest(),'tenant'));
    await db.exec(`SET test.actor='${owner}'; SET test.subscription='no'`); await assert.rejects(restore(db));
    await db.exec("SET test.subscription='yes'; SET test.module='no'"); await assert.rejects(restore(db));
  } finally {await db.close();}
});

test('restores archived cards without opening normal archived writes or leaving restore capability behind',async()=>{
  const db=await fixture(); try {
    await db.exec("UPDATE projects SET status='archived' WHERE id='p'");
    assert.equal((await restore(db)).restored_project_client_cards,1);
    assert.equal((await db.query('SELECT count(*)::int n FROM private.project_client_card_restore_context')).rows[0].n,0);
    await assert.rejects(db.exec("UPDATE project_client_cards SET company_name='zakázáno' WHERE project_id='p'"),/archived/);
    await assert.rejects(db.exec("DELETE FROM project_client_cards WHERE project_id='p'"),/archived/);
    await db.exec('SET ROLE authenticated');
    await assert.rejects(db.exec('INSERT INTO private.project_client_card_restore_context VALUES(txid_current(),\'p\')'),/permission denied/);
  } finally {await db.close();}
});

test('FK user deletion clears attribution on archived cards and project deletion cascades',async()=>{
  const db=await fixture(); try {
    await db.exec(`SET test.actor='${editor}'`); await insert(db);
    await db.exec(`UPDATE projects SET status='archived' WHERE id='p'; SET test.actor='${owner}'`);
    await db.exec(`DELETE FROM auth.users WHERE id='${editor}'`);
    assert.equal((await db.query("SELECT updated_by FROM project_client_cards WHERE project_id='p'")).rows[0].updated_by,null);
    await db.exec("DELETE FROM projects WHERE id='p'");
    assert.equal((await db.query('SELECT count(*)::int n FROM project_client_cards')).rows[0].n,0);
  } finally {await db.close();}
});

test('actual RLS separates owner, viewer, editor, outsider, modules and subscriptions',async()=>{
  const db=await fixture(); try {
    await insert(db); await insert(db,'shared'); await db.exec('SET ROLE authenticated');
    await db.exec(`SET test.actor='${editor}'`);
    assert.deepEqual((await db.query('SELECT project_id FROM project_client_cards')).rows,[{project_id:'shared'}]);
    assert.equal((await db.query("UPDATE project_client_cards SET company_name='x' RETURNING project_id")).rows.length,0);
    await db.exec('RESET ROLE'); await db.exec("UPDATE project_shares SET permission='edit'"); await db.exec('SET ROLE authenticated');
    assert.equal((await db.query("UPDATE project_client_cards SET company_name='x' RETURNING project_id")).rows.length,1);
    await assert.rejects(db.exec("UPDATE project_client_cards SET project_id='p' WHERE project_id='shared'"),/cannot move/);
    await assert.rejects(db.exec(`UPDATE project_client_cards SET organization_id='${foreignOrg}' WHERE project_id='shared'`),/organization must match/);
    for(const setting of ['module','subscription']) {
      await db.exec(`SET test.${setting}='no'`); assert.equal((await db.query('SELECT * FROM project_client_cards')).rows.length,0); await db.exec(`SET test.${setting}='yes'`);
    }
    await db.exec(`SET test.actor='${outsider}'`); assert.equal((await db.query('SELECT * FROM project_client_cards')).rows.length,0);
    await db.exec('RESET ROLE; SET ROLE anon'); await assert.rejects(db.query('SELECT * FROM project_client_cards'),/permission denied/);
  } finally {await db.close();}
});

test('cloning a tender carries its client identity to the new realization',async()=>{
  const db=await fixture(); try {
    await insert(db);
    await db.query('SELECT * FROM clone_tender_project_to_realization($1)',['p']);
    assert.deepEqual((await db.query("SELECT company_name,ico FROM project_client_cards WHERE project_id='cloned'")).rows,[{company_name:'Firma',ico:'27074358'}]);
  } finally {await db.close();}
});

test('organization deletion cascades archived cards and owner deletion does not block FK cleanup',async()=>{
  const db=await fixture(); try {
    await insert(db); await db.exec("UPDATE projects SET status='archived' WHERE id='p'");
    await db.exec(`SET test.actor=''; DELETE FROM auth.users WHERE id='${owner}'`);
    assert.equal((await db.query("SELECT updated_by FROM project_client_cards WHERE project_id='p'")).rows[0].updated_by,null);
    await db.exec(`DELETE FROM organizations WHERE id='${org}'`);
    assert.equal((await db.query('SELECT count(*)::int n FROM project_client_cards')).rows[0].n,0);
  } finally {await db.close();}
});

test('private capabilities are not callable by API roles and failed archived restore leaves no context',async()=>{
  const db=await fixture(); try {
    await db.exec("UPDATE projects SET status='archived' WHERE id='p'");
    await assert.rejects(restore(db,manifest([{...card(),ico:'12345678'}])),/check constraint/);
    assert.equal((await db.query('SELECT count(*)::int n FROM private.project_client_card_restore_context')).rows[0].n,0);
    for(const role of ['authenticated','anon','service_role','tenderflow_mcp_client']) {
      const result=await db.query(`SELECT has_function_privilege($1,'private.client_card_backup_restore(jsonb,uuid,text)','EXECUTE') AS restore, has_function_privilege($1,'private.client_card_backup_export(jsonb)','EXECUTE') AS export, has_table_privilege($1,'private.project_client_card_restore_context','INSERT') AS mint`,[role]);
      assert.deepEqual(result.rows,[{restore:false,export:false,mint:false}]);
    }
  } finally {await db.close();}
});
