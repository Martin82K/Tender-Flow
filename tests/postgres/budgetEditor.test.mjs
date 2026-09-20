// Isolated PostgreSQL/WASM only. Never reads a connection string or customer data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
assert.ok(process.env.PGLITE_MODULE,'Set PGLITE_MODULE to an audited PGlite ESM entry.');
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const read=name=>readFileSync(new URL(`../../supabase/migrations/${name}`,import.meta.url),'utf8');
const migration=read('20260920112056_budget_tender_import.sql');
const actor='00000000-0000-0000-0000-000000000001';
const org='00000000-0000-0000-0000-000000000002';
const source='00000000-0000-0000-0000-000000000003';
const revision='00000000-0000-0000-0000-000000000004';
const document={schemaVersion:1,sheets:[],issues:[],figures:{},nodes:[{id:'item',kind:'K',parentId:null,code:'001',description:'Práce',unit:'m2',quantity:'10',unitPrice:'20',total:'200',tags:[],tenders:[],sheetId:'s',order:0,source:{sheet:'SO',row:1,cells:{}}}]};
async function fixture(){
  const db=new PGlite();
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE SCHEMA private;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('test.actor',true),'')::uuid $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE public.organizations(id uuid PRIMARY KEY);
    CREATE TABLE public.projects(id text PRIMARY KEY,organization_id uuid,owner_id uuid);
    CREATE TABLE public.demand_categories(id text PRIMARY KEY,project_id text REFERENCES projects(id) ON DELETE CASCADE,title varchar(255),status text,description text,budget_display text,sod_budget numeric,plan_budget numeric);
    CREATE FUNCTION public.can_project_module_action(text,text,boolean) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1='p' AND $2='module_pipeline' AND current_setting('test.pipeline',true)='yes' $$;
    CREATE FUNCTION private.budget_access(text,text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT auth.uid() IS NOT NULL AND $1='p' AND current_setting('test.'||$2,true)='yes' $$;
    CREATE FUNCTION public.has_project_share_permission(text,uuid,text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
    SET test.actor='${actor}'; SET test.read='yes'; SET test.edit='yes'; SET test.prices='yes'; SET test.allocate='yes'; SET test.pipeline='yes';
    INSERT INTO auth.users VALUES('${actor}'); INSERT INTO organizations VALUES('${org}');
    INSERT INTO projects VALUES('p','${org}','${actor}'),('foreign','${org}','${actor}');
    INSERT INTO demand_categories(id,project_id,title) VALUES('existing','p','Existující'),('foreign','foreign','Cizí');
  `);
  const initial=read('20260919141602_construction_budget.sql');
  await db.exec(initial.slice(initial.indexOf('CREATE TABLE public.construction_budget_sources'),initial.indexOf('-- Private implementation')));
  await db.exec(`ALTER TABLE construction_budget_sources ADD deleted_at timestamptz;
    ALTER TABLE construction_budget_revisions ADD deleted_at timestamptz;
    INSERT INTO construction_budget_sources(id,project_id,organization_id,filename,storage_path,sha256) VALUES('${source}','p','${org}','file.xlsx','p/file',repeat('a',64));`);
  const hardening=read('20260920080712_harden_budget_validation_and_plan_rollout.sql');
  await db.exec(hardening.slice(hardening.indexOf('CREATE OR REPLACE FUNCTION'),hardening.indexOf('-- The UI deliberately')));
  await db.query(`INSERT INTO construction_budget_revisions(id,project_id,organization_id,source_id,title,document) VALUES($1,'p',$2,$3,'Rozpočet',$4)`,[revision,org,source,document]);
  for(const scope of ['user','tenant'])await db.exec(`CREATE FUNCTION public.restore_${scope}_backup_without_offer_deadline_20260817(backup_json jsonb,target_org_id uuid) RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE cnt_categories integer:=0; item jsonb; BEGIN FOR item IN SELECT value FROM jsonb_array_elements(backup_json->'demand_categories') LOOP IF item->>'project_id'='p' THEN cnt_categories := cnt_categories + 1; END IF; END LOOP; RETURN '{}'::jsonb; END $$;`);
  await db.exec(read('20260321130000_harden_clone_tender_rpc_ownerless_access.sql'));
  await db.exec(migration);
  await db.exec(`CREATE TABLE private.construction_budget_preferences(project_id text PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,revision_id uuid);
    CREATE TABLE private.construction_budget_purge_jobs(project_id text,deletes_project boolean,completed_at timestamptz,id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid,revision_ids uuid[],source_ids uuid[]);
    ALTER TABLE construction_budget_sources ADD purge_job_id uuid;
    ALTER TABLE construction_budget_revisions ADD purge_job_id uuid;
    CREATE SCHEMA storage; CREATE TABLE storage.objects(bucket_id text,name text);
    CREATE FUNCTION public.can_project_action(text,text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1='p' AND auth.uid()='00000000-0000-0000-0000-000000000001'::uuid AND current_setting('test.delete',true)='yes' $$;
    CREATE FUNCTION public.has_project_subscription(text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('test.subscription',true)='yes' $$;
    SET test.delete='yes'; SET test.subscription='yes';
    CREATE FUNCTION private.budget_load(text,uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN IF NOT private.budget_access($1,'read') THEN RAISE EXCEPTION 'denied'; END IF; RETURN '{}'::jsonb; END $$;
    CREATE FUNCTION public.create_project_with_team(project_id_input text,name_input text,location_input text,status_input text,organization_id_input uuid,team_input jsonb DEFAULT '[]') RETURNS text LANGUAGE plpgsql AS $$ DECLARE member jsonb; BEGIN INSERT INTO projects VALUES(project_id_input,organization_id_input,auth.uid()); FOR member IN SELECT value FROM jsonb_array_elements(team_input) LOOP NULL; END LOOP; RETURN project_id_input; END $$;
    CREATE FUNCTION private.budget_backup_export(jsonb) RETURNS jsonb LANGUAGE sql AS $$ SELECT $1 $$;
    CREATE FUNCTION private.budget_backup_restore(jsonb,uuid,text) RETURNS integer LANGUAGE sql AS $$ SELECT 0 $$;
    CREATE FUNCTION private.budget_backup_signature(text) RETURNS text LANGUAGE sql AS $$ SELECT md5($1||'test-only-signature') $$;
    INSERT INTO auth.users VALUES('00000000-0000-0000-0000-000000000009');
    GRANT USAGE ON SCHEMA private,auth TO authenticated;
  `);
  if(!process.env.BUDGET_UX_RED)await db.exec(read('20260920182433_budget_lock_and_personal_tenders.sql'));
  await db.exec(read('20260920190558_harden_budget_catalog_guards.sql'));
  await db.exec(read('20260920193400_align_budget_catalog_permissions_and_names.sql'));
  await db.exec(read('20260920195705_scope_budget_delete_lock_bypass.sql'));
  return db;
}

const definitions=[{id:'d1',title:'Zemní práce',externalCode:'01'},{id:'d2',title:'Beton',externalCode:'02'}];
const defaults=(db,entries=null,version=null)=>db.query('SELECT public.personal_tender_defaults($1,$2) result',[entries,version]).then(r=>r.rows[0].result);
const lock=(db,locked,version=0,project='p')=>db.query('SELECT public.construction_budget_set_lock($1,$2,$3) result',[project,locked,version]).then(r=>r.rows[0].result);
test('stores personal defaults only for the current actor, checks versions and normalizes definitions',async()=>{
 const db=await fixture();try{
   assert.equal((await defaults(db)).version,0);assert.equal((await defaults(db)).definitions.length,14);
   assert.deepEqual((await defaults(db,definitions,0)).definitions,definitions);
   await assert.rejects(defaults(db,[],0),/mezitím/);
   await assert.rejects(defaults(db,[definitions[0],{...definitions[1],title:' Zemní práce '}],1),/Duplicitní/);
   await db.exec("SET test.actor='00000000-0000-0000-0000-000000000009'");
   assert.equal((await defaults(db)).version,0);assert.equal((await defaults(db)).definitions.length,14);
   await db.exec("SET test.actor=''");await assert.rejects(defaults(db),/Přihlášení/);
 }finally{await db.close();}
});
test('copies defaults atomically only during normal project creation and preserves independent project copies',async()=>{
 const db=await fixture();try{
   await defaults(db,definitions,0);
   await db.query("SELECT create_project_with_team('new','New','','realization',$1,'[]')",[org]);
   assert.deepEqual((await db.query("SELECT title,external_code FROM demand_categories WHERE project_id='new' ORDER BY external_code")).rows,[{title:'Zemní práce',external_code:'01'},{title:'Beton',external_code:'02'}]);
   await defaults(db,[],1);
   assert.equal((await db.query("SELECT count(*)::int n FROM demand_categories WHERE project_id='new'")).rows[0].n,2);
   await assert.rejects(db.query("SELECT create_project_with_team('new','New','','realization',$1,'[]')",[org]));
   assert.equal((await db.query("SELECT count(*)::int n FROM demand_categories WHERE project_id='new'")).rows[0].n,2);

 }finally{await db.close();}
});
test('locks existing and new revisions, sources and preferences and checks stale tokens and permissions',async()=>{
 const db=await fixture();try{
   assert.equal((await lock(db,true)).locked,true);
   assert.equal((await db.query("SELECT construction_budget_load('p') result")).rows[0].result.locked,true);
   await assert.rejects(db.query("UPDATE construction_budget_revisions SET title='changed' WHERE id=$1",[revision]),/uzamčen/);
   await assert.rejects(db.exec("UPDATE construction_budget_sources SET filename='changed.xlsx'"),/uzamčen/);
   await assert.rejects(db.exec("INSERT INTO private.construction_budget_preferences VALUES('p',NULL)"),/uzamčen/);
   await assert.rejects(db.exec("DELETE FROM construction_budget_revisions"),/uzamčen/);
   await assert.rejects(lock(db,false,0),/mezitím/);
   await db.exec("SET test.edit='no'");await assert.rejects(lock(db,false,1),/povolena/);await db.exec("SET test.edit='yes'");
   await assert.rejects(lock(db,false,0,'foreign'),/povolena/);
   await lock(db,false,1);await db.exec("UPDATE construction_budget_revisions SET title='changed'");
 }finally{await db.close();}
});
test('does not expose private tables to authenticated clients',async()=>{
 const db=await fixture();try{
   await db.exec('SET ROLE authenticated');
   await assert.rejects(db.exec('SELECT * FROM private.personal_tender_defaults'),/permission denied/);
   await assert.rejects(db.exec("INSERT INTO private.budget_edit_locks VALUES('p',false,1)"),/permission denied/);
   await defaults(db,definitions,0);
 }finally{await db.close();}
});
test('project catalog rejects foreign ids, missing existing entries, duplicate codes and stale snapshots',async()=>{
 const db=await fixture();try{
   const expected=[{id:'existing',title:'Existující',externalCode:''}];
   const save=(base,entries)=>db.query('SELECT save_project_tender_catalog($1,$2,$3)',['p',base,entries]);
   await assert.rejects(save([],expected),/mezitím/);
   await assert.rejects(save(expected,[]),/odstranit/);
   await assert.rejects(save(expected,[...expected,{id:'foreign',title:'Foreign',externalCode:'03'}]),/Cizí/);
   await save(expected,[{...expected[0],title:'Edited'},...definitions]);
   assert.equal((await db.query("SELECT title FROM demand_categories WHERE id='existing'")).rows[0].title,'Edited');
 }finally{await db.close();}
});
test('backup preserves personal defaults and locks, rejects another actor and does not overwrite current settings',async()=>{
 const db=await fixture();try{
   await defaults(db,definitions,0);await lock(db,true);
   const manifest={organization_id:org,projects:[{id:'p'}]};
   const backup=(await db.query('SELECT private.budget_backup_export($1) result',[manifest])).rows[0].result;
   await db.exec('DELETE FROM private.personal_tender_defaults; DELETE FROM private.budget_edit_locks');
   await db.query("SELECT private.budget_backup_restore($1,$2,'user')",[backup,org]);
   assert.deepEqual((await defaults(db)).definitions,definitions);
   assert.equal((await db.query("SELECT locked FROM private.budget_edit_locks WHERE project_id='p'")).rows[0].locked,true);
   await defaults(db,[],1);await db.query("SELECT private.budget_backup_restore($1,$2,'user')",[backup,org]);
   assert.deepEqual((await defaults(db)).definitions,[]);
   await db.exec("SET test.actor='00000000-0000-0000-0000-000000000009'");
   await assert.rejects(db.query("SELECT private.budget_backup_restore($1,$2,'user')",[backup,org]),/Foreign personal/);
 }finally{await db.close();}
});
test('keeps account anonymization and authorized project deletion possible while locked',async()=>{
 const db=await fixture();try{
   await lock(db,true);
   await db.exec('ALTER TABLE construction_budget_revisions ALTER COLUMN created_by DROP NOT NULL');
   await db.exec('UPDATE construction_budget_revisions SET created_by=NULL');
   await assert.rejects(db.exec("UPDATE construction_budget_revisions SET created_by=NULL,title='bad'"),/uzamčen/);
   await db.exec("INSERT INTO private.construction_budget_purge_jobs(project_id,deletes_project,completed_at) VALUES('p',true,NULL)");
   await assert.rejects(db.exec('DELETE FROM construction_budget_revisions'),/uzamčen/);
   await db.exec("SET test.actor='00000000-0000-0000-0000-000000000009'");await defaults(db,definitions,0);
   await db.exec("DELETE FROM auth.users WHERE id='00000000-0000-0000-0000-000000000009'");
   assert.equal((await db.query("SELECT count(*)::int n FROM private.personal_tender_defaults")).rows[0].n,0);
 }finally{await db.close();}
});
test('provides a shared starting catalog to every new user and preserves explicitly empty personal defaults',async()=>{
 const db=await fixture();try{
   const initial=await defaults(db);assert.equal(initial.version,0);assert.equal(initial.definitions.length,14);
   assert.equal(initial.definitions[0].title,'Zemní práce');
   await db.query("SELECT create_project_with_team('seeded','Seeded','','realization',$1,'[]')",[org]);
   assert.equal((await db.query("SELECT count(*)::int n FROM demand_categories WHERE project_id='seeded'")).rows[0].n,14);
   await defaults(db,[],0);assert.deepEqual((await defaults(db)).definitions,[]);
   await db.exec("SET test.actor='00000000-0000-0000-0000-000000000009'");
   assert.equal((await defaults(db)).definitions.length,14);
 }finally{await db.close();}
});

test('guards direct tender identity writes while locked but permits pipeline status',async()=>{
 const db=await fixture();try{
  await lock(db,true);
  await assert.rejects(db.exec("UPDATE demand_categories SET title='changed' WHERE id='existing'"),/uzamčen/);
  await assert.rejects(db.exec("INSERT INTO demand_categories(id,project_id,title) VALUES('new','p','New')"),/uzamčen/);
  await assert.rejects(db.exec("DELETE FROM demand_categories WHERE id='existing'"),/uzamčen/);
  await db.exec("UPDATE demand_categories SET status='closed' WHERE id='existing'");
  await db.exec("INSERT INTO private.construction_budget_purge_jobs(project_id,deletes_project,completed_at) VALUES('p',true,NULL)");
  await assert.rejects(db.exec("DELETE FROM demand_categories WHERE id='existing'"),/uzamčen/);
 }finally{await db.close();}
});
test('edits a project catalog larger than personal defaults without relaxing the personal limit',async()=>{
 const db=await fixture();try{
  const entries=Array.from({length:501},(_,i)=>({id:`large-${i}`,title:`Tender ${i}`,externalCode:String(i)}));
  await assert.rejects(defaults(db,entries,0),/500/);
  const base=[{id:'existing',title:'Existující',externalCode:''}];
  await db.query("SELECT save_project_tender_catalog('p',$1,$2)",[base,[...base,...entries]]);
  const snapshot=(await db.query("SELECT id,title,COALESCE(external_code,'') AS \"externalCode\" FROM demand_categories WHERE project_id='p' ORDER BY id")).rows;
  await db.query("SELECT save_project_tender_catalog('p',$1,$2)",[snapshot,snapshot.map(e=>e.id==='existing'?{...e,title:'Renamed'}:e)]);
 }finally{await db.close();}
});

test('rejects whitespace-equivalent tender names and reports pipeline editing separately',async()=>{
 const db=await fixture();try{
  await assert.rejects(defaults(db,[definitions[0],{...definitions[1],title:'Zemní  práce'}],0),/Duplicitní/);
  await assert.rejects(defaults(db,[{...definitions[0],title:'\t\n'}],0),/platné/);
  await db.exec("SET test.edit='no'; SET test.pipeline='yes'");
  assert.equal((await db.query("SELECT construction_budget_load('p') result")).rows[0].result.permissions.editTenders,true);
  await db.exec("SET test.pipeline='no'");
  assert.equal((await db.query("SELECT construction_budget_load('p') result")).rows[0].result.permissions.editTenders,false);
 }finally{await db.close();}
});

test('rejects overlong stored titles even when whitespace normalization is short',async()=>{
 const db=await fixture();try{
  const title='A'+' '.repeat(300)+'B';
  await assert.rejects(defaults(db,[{...definitions[0],title}],0),/platné/);
  const base=[{id:'existing',title:'Existující',externalCode:''}];
  await assert.rejects(db.query("SELECT save_project_tender_catalog('p',$1,$2)",[base,[{...base[0],title}]]),/platné/);
 }finally{await db.close();}
});
test('does not let a pending project deletion bypass locked revisions or tender identity',async()=>{
 const db=await fixture();try{
  await lock(db,true);
  await db.exec("INSERT INTO private.construction_budget_purge_jobs(project_id,deletes_project,completed_at) VALUES('p',true,NULL)");
  await assert.rejects(db.exec("UPDATE construction_budget_revisions SET title='changed'"),/uzamčen/);
  await assert.rejects(db.exec("UPDATE demand_categories SET title='changed' WHERE id='existing'"),/uzamčen/);
 }finally{await db.close();}
});

test('scopes unlock to authorized delete transactions, preserves retries and rolls back failed completion',async()=>{
 const db=await fixture();try{
  await lock(db,true);
  const start=()=>db.query("SELECT private.budget_project_delete_start('p') result").then(r=>r.rows[0].result);
  const finish=id=>db.query("SELECT private.budget_project_delete_finish('p',$1)",[id]);
  await db.exec("SET test.delete='no'");await assert.rejects(start(),/denied/);
  await db.exec("SET test.delete='yes'");
  const job=await start();assert.equal((await start()).id,job.id);
  assert.equal((await db.query("SELECT locked FROM private.budget_edit_locks WHERE project_id='p'")).rows[0].locked,true);
  await assert.rejects(db.exec("UPDATE demand_categories SET title='changed' WHERE id='existing'"),/uzamčen/);
  await assert.rejects(finish(randomUUID()),/Invalid deletion job/);
  await db.exec("INSERT INTO storage.objects VALUES('construction-budgets','p/file')");
  await assert.rejects(finish(job.id),/odstranit soubory/);
  assert.equal((await db.query("SELECT locked FROM private.budget_edit_locks WHERE project_id='p'")).rows[0].locked,true);
  await db.exec("DELETE FROM storage.objects; SET test.subscription='no'");await assert.rejects(finish(job.id),/denied/);
  await db.exec("SET test.subscription='yes'; SET test.delete='no'");await assert.rejects(finish(job.id),/denied/);
  await db.exec("SET test.delete='yes'");await finish(job.id);await finish(job.id);
  assert.equal((await db.query("SELECT count(*)::int n FROM projects WHERE id='p'")).rows[0].n,0);
  assert.equal((await db.query("SELECT count(*)::int n FROM projects WHERE id='foreign'")).rows[0].n,1);
 }finally{await db.close();}
});

test('returns a completed import on retry after locking without allowing a new import',async()=>{
 const db=await fixture();try{
  const request={operationId:randomUUID(),mode:'template',expectedCatalog:[{id:'existing',title:'Existující',externalCode:''}],newCategories:[{id:'new',title:'Nové',externalCode:'02'}],assignments:[]};
  const call=r=>db.query("SELECT construction_budget_import_tenders('p',$1) result",[r]).then(r=>r.rows[0].result);
  const first=await call(request);await lock(db,true);
  assert.deepEqual(await call(request),first);
  await assert.rejects(call({...request,operationId:randomUUID()}),/uzamčen/);
  await assert.rejects(call({...request,newCategories:[]}),/jiné operaci/);
  await db.exec("SET test.prices='no'");await assert.rejects(call(request),/povolen/);
 }finally{await db.close();}
});
test('requires price access when restoring a lock without a budget envelope',async()=>{
 const db=await fixture();try{
  await lock(db,true);const manifest={organization_id:org,projects:[{id:'p'}]};
  const backup=(await db.query('SELECT private.budget_backup_export($1) result',[manifest])).rows[0].result;
  await db.exec("DELETE FROM private.budget_edit_locks; SET test.prices='no'");
  await assert.rejects(db.query("SELECT private.budget_backup_restore($1,$2,'tenant')",[backup,org]),/Foreign budget lock/);
  assert.equal((await db.query('SELECT count(*)::int n FROM private.budget_edit_locks')).rows[0].n,0);
  await db.exec("SET test.prices='yes'");await db.query("SELECT private.budget_backup_restore($1,$2,'tenant')",[backup,org]);
  assert.equal((await db.query("SELECT locked FROM private.budget_edit_locks WHERE project_id='p'")).rows[0].locked,true);
 }finally{await db.close();}
});
test('takes the catalog advisory lock before locking the project in deletion completion',async()=>{
 const db=await fixture();try{
  // PGlite is single-session: assert the lock-order contract on the installed function.
  const body=(await db.query("SELECT pg_get_functiondef('private.budget_project_delete_finish(text,uuid)'::regprocedure) body")).rows[0].body;
  const advisory=body.indexOf("pg_advisory_xact_lock(hashtextextended('budget-categories:'||project_input,0))");
  assert.ok(advisory>=0 && advisory<body.indexOf('FOR UPDATE'));
 }finally{await db.close();}
});

async function assignmentFixture(){
 const db=await fixture();
 const compact=read('20260920103208_compact_budget_history_and_guard_category_delete.sql');
 await db.exec(compact.slice(compact.indexOf('ALTER TABLE public.construction_budget_history'),compact.indexOf('DO $migration$')));
 if(!process.env.BUDGET_ASSIGNMENT_RED)await db.exec(read('20260920220500_budget_assignment_fast_path.sql'));
 return db;
}
const directRequest=()=>({operationId:randomUUID(),mode:'assignments',sourceId:source,revisionId:revision,version:1,expectedCatalog:[{id:'existing',title:'Existující',externalCode:''}],newCategories:[],assignments:[{itemId:'item',categoryId:'existing',action:'replace'}]});
const assign=(db,r,project='p')=>db.query('SELECT public.construction_budget_import_tenders($1,$2) result',[project,r]).then(r=>r.rows[0].result);
test('assigns existing draft items without re-saving their document and retains history and retry safety',async()=>{
 const db=await assignmentFixture();try{
  await db.exec(`CREATE OR REPLACE FUNCTION private.budget_save(project_input text,source_input uuid,revision_input uuid,version_input integer,title_input text,document_input jsonb,allocations_input jsonb,confirm_input boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'full-document-save-called'; END $$;`);
  const r=directRequest();const result=await assign(db,r);
  assert.deepEqual(result.revision.document,document);assert.equal(result.revision.version,2);
  assert.deepEqual(result.revision.allocations,[{itemId:'item',categoryId:'existing',quantity:'10'}]);
  assert.equal((await assign(db,r)).revision.version,2);
  const history=(await db.query('SELECT changes FROM construction_budget_history')).rows;
  assert.equal(history.length,1);assert.deepEqual(history[0].changes,{format:1,fields:[],nodes:null,allocations:{length:0,items:[]}});
  await assert.rejects(assign(db,{...r,version:2}),/jiné operaci/);
 }finally{await db.close();}
});
test('fast assignment preserves authorization, locks, version, source and tenant boundaries',async()=>{
 const db=await assignmentFixture();try{
  for(const permission of ['read','edit','prices','allocate','pipeline']){
   await db.exec(`SET test.${permission}='no'`);await assert.rejects(assign(db,directRequest()),/povolen/);await db.exec(`SET test.${permission}='yes'`);
  }
  await assert.rejects(assign(db,directRequest(),'foreign'),/povolen/);
  for(const patch of [{version:0},{document},{sourceId:randomUUID()},{assignments:[{itemId:'item',categoryId:'foreign',action:'replace'}]},{assignments:[{itemId:'missing',categoryId:'existing',action:'replace'}]}])await assert.rejects(assign(db,{...directRequest(),...patch}));
  await lock(db,true);await assert.rejects(assign(db,directRequest()),/uzamčen/);
  assert.equal((await db.query('SELECT version FROM construction_budget_revisions WHERE id=$1',[revision])).rows[0].version,1);
  assert.equal((await db.query('SELECT count(*)::int n FROM construction_budget_history')).rows[0].n,0);
 }finally{await db.close();}
});
test('assigns one item in a 11000-row document without changing its content',async()=>{
 const db=await assignmentFixture();try{
  const large={...document,nodes:Array.from({length:11000},(_,i)=>({...document.nodes[0],id:i?'item'+i:'item',description:'Synthetic work '+i+'x'.repeat(700),order:i}))};
  await db.query('UPDATE construction_budget_revisions SET document=$1 WHERE id=$2',[large,revision]);
  const started=performance.now();const result=await assign(db,directRequest());
  const elapsed=performance.now()-started;console.log('11000-row assignment ms:',Math.round(elapsed));
  assert.deepEqual(result.revision.document,large);assert.equal(result.revision.allocations.length,1);
  assert.ok(elapsed<8000,`assignment exceeded 8s: ${elapsed}`);
 }finally{await db.close();}
});

test('persists an edited unit price and calculated total in a large draft',async()=>{
 const db=await assignmentFixture();try{
  // Install the production compact-history save patch as well as its helper functions.
  let definition=(await db.query("SELECT pg_get_functiondef('private.budget_save(text,uuid,uuid,integer,text,jsonb,jsonb,boolean)'::regprocedure) body")).rows[0].body;
  definition=definition.replace('previous_document,previous_allocations)','previous_document,previous_allocations,changes)').replace('old.version,saved.version,old.document,old.allocations)','old.version,saved.version,NULL,NULL,private.budget_revision_reverse_patch(old.document,saved.document,old.allocations,saved.allocations))');
  await db.exec(definition);
  const large={...document,nodes:Array.from({length:11000},(_,i)=>({...document.nodes[0],id:i?'item'+i:'item',description:'Synthetic work '+i+'x'.repeat(700),order:i}))};
  large.nodes[0]={...large.nodes[0],quantity:'2600',unitPrice:null,total:'0'};
  await db.query('UPDATE construction_budget_revisions SET document=$1 WHERE id=$2',[large,revision]);
  const edited={...large,nodes:large.nodes.map((n,i)=>i?n:{...n,unitPrice:'100',total:'260000.00'})};
  const started=performance.now();
  const result=(await db.query("SELECT private.budget_save('p',$1,$2,1,'Rozpočet',$3,'[]',false) result",[source,revision,edited])).rows[0].result;
  console.log('11000-row price save ms:',Math.round(performance.now()-started));
  assert.equal(result.version,2);assert.deepEqual(result.document,edited);
  const stored=(await db.query('SELECT document FROM construction_budget_revisions WHERE id=$1',[revision])).rows[0].document;
  assert.equal(stored.nodes[0].total,'260000.00');
  const changes=(await db.query('SELECT changes FROM construction_budget_history')).rows[0].changes;
  assert.equal(changes.nodes.items.length,1);assert.equal(changes.nodes.items[0].value.unitPrice,null);
 }finally{await db.close();}
});

async function itemEditFixture(){
 const db=await assignmentFixture();
 let definition=(await db.query("SELECT pg_get_functiondef('private.budget_save(text,uuid,uuid,integer,text,jsonb,jsonb,boolean)'::regprocedure) body")).rows[0].body;
 definition=definition.replace('previous_document,previous_allocations)','previous_document,previous_allocations,changes)').replace('old.version,saved.version,old.document,old.allocations)','old.version,saved.version,NULL,NULL,private.budget_revision_reverse_patch(old.document,saved.document,old.allocations,saved.allocations))');
 await db.exec(definition);
 if(!process.env.BUDGET_ITEM_RED)await db.exec(read('20260920223500_budget_item_patch.sql'));
 return db;
}
const editRequest=()=>({operationId:randomUUID(),revisionId:revision,sourceId:source,version:1,itemId:'item',patch:{unitPrice:'100'},resolvedIssueIndexes:[]});
const editItem=(db,request,project='p')=>db.query('SELECT public.construction_budget_edit_item($1,$2) result',[project,request]).then(r=>r.rows[0].result);
test('saves a small item patch, calculates money server-side and safely replays a lost response',async()=>{
 const db=await itemEditFixture();try{
  const r=editRequest();const result=await editItem(db,r);
  assert.equal(result.node.total,'1000.00');assert.equal(result.version,2);
  assert.ok(JSON.stringify(result).length<2000);assert.equal(result.document,undefined);
  assert.deepEqual(await editItem(db,r),result);
  await assert.rejects(editItem(db,{...r,patch:{unitPrice:'101'}}),/conflict/i);
  assert.equal((await db.query('SELECT count(*)::int n FROM construction_budget_history')).rows[0].n,1);
  const next={...editRequest(),version:2,patch:{quantity:'12.25'}};
  assert.equal((await editItem(db,next)).node.total,'1225.00');
  await assert.rejects(editItem(db,r),/conflict/i);
 }finally{await db.close();}
});
test('item patches retain permissions, tenant isolation, source/version/lock guards and field boundaries',async()=>{
 const db=await itemEditFixture();try{
  for(const permission of ['read','edit','prices']){
   await db.exec(`SET test.${permission}='no'`);await assert.rejects(editItem(db,editRequest()),/denied/i);await db.exec(`SET test.${permission}='yes'`);
  }
  await assert.rejects(editItem(db,editRequest(),'foreign'),/denied/i);
  for(const patch of [{version:0},{sourceId:randomUUID()},{itemId:'missing'},{patch:{parentId:'foreign'}},{patch:{unitPrice:'1e5'}},{patch:{kind:'section'}},{patch:{unitPrice:'100',total:'1'}}])await assert.rejects(editItem(db,{...editRequest(),...patch}));
  await lock(db,true);await assert.rejects(editItem(db,editRequest()),/uzamčen/);
  assert.equal((await db.query('SELECT version FROM construction_budget_revisions WHERE id=$1',[revision])).rows[0].version,1);
 }finally{await db.close();}
});
test('item quantity patches synchronize whole assignments and reject split quantities and assigned units',async()=>{
 const db=await itemEditFixture();try{
  await db.query('UPDATE construction_budget_revisions SET allocations=$1 WHERE id=$2',[[{itemId:'item',categoryId:'existing',quantity:'10'}],revision]);
  await assert.rejects(editItem(db,{...editRequest(),patch:{unit:'m3'}}),/unit/i);
  await db.exec("SET test.allocate='no'");
  await assert.rejects(editItem(db,{...editRequest(),patch:{quantity:'20'}}),/Allocation denied/);
  // Pricing an allocated item does not require allocation rights.
  assert.equal((await editItem(db,editRequest())).node.total,'1000.00');
  await db.exec("SET test.allocate='yes'");
  const result=await editItem(db,{...editRequest(),version:2,patch:{quantity:'20'}});
  assert.equal(result.allocations[0].quantity,'20');assert.equal(result.node.total,'2000.00');
  await db.query('UPDATE construction_budget_revisions SET allocations=$1 WHERE id=$2',[[{itemId:'item',categoryId:'existing',quantity:'5'}],revision]);
  await assert.rejects(editItem(db,{...editRequest(),version:3,patch:{quantity:'30'}}),/whole/i);
 }finally{await db.close();}
});
test('large item edits transfer a bounded payload and preserve history and unrelated rows',async()=>{
 const db=await itemEditFixture();try{
  const large={...document,nodes:Array.from({length:11000},(_,i)=>({...document.nodes[0],id:i?'item'+i:'item',description:'Synthetic work '+i+'x'.repeat(700),order:i}))};
  await db.query('UPDATE construction_budget_revisions SET document=$1 WHERE id=$2',[large,revision]);
  const r=editRequest(),started=performance.now(),result=await editItem(db,r);
  console.log('11000-row patch ms / request bytes / response bytes:',Math.round(performance.now()-started),JSON.stringify(r).length,JSON.stringify(result).length);
  assert.ok(JSON.stringify(r).length<500);assert.ok(JSON.stringify(result).length<2000);
  const stored=(await db.query('SELECT document FROM construction_budget_revisions WHERE id=$1',[revision])).rows[0].document;
  assert.equal(stored.nodes[0].total,'1000.00');assert.deepEqual(stored.nodes.slice(1),large.nodes.slice(1));
  const history=(await db.query('SELECT changes FROM construction_budget_history')).rows[0].changes;
  assert.equal(history.nodes.items.length,1);assert.equal(history.nodes.items[0].value.unitPrice,'20');
 }finally{await db.close();}
});
test('item edits remove only requested numeric issues on the edited source row and preserve backup history',async()=>{
 const db=await itemEditFixture();try{
  const issues=[{sheet:'SO',row:1,severity:'error',message:'Neplatná nebo chybějící hodnota G.'},{sheet:'SO',row:2,severity:'error',message:'Neplatná nebo chybějící hodnota G.'},{sheet:'SO',row:1,severity:'error',message:'Neplatné mapování.'}];
  await db.query('UPDATE construction_budget_revisions SET document=$1 WHERE id=$2',[{...document,issues},revision]);
  await assert.rejects(editItem(db,{...editRequest(),resolvedIssueIndexes:[1]}),/Invalid resolved issue/);
  await assert.rejects(editItem(db,{...editRequest(),resolvedIssueIndexes:[2]}),/Invalid resolved issue/);
  await assert.rejects(editItem(db,{...editRequest(),resolvedIssueIndexes:[-1]}),/Invalid resolved issue/);
  const r={...editRequest(),resolvedIssueIndexes:[0]};const result=await editItem(db,r);
  assert.deepEqual(result.resolvedIssueIndexes,[0]);
  assert.deepEqual((await db.query('SELECT document FROM construction_budget_revisions WHERE id=$1',[revision])).rows[0].document.issues,issues.slice(1));
  const changes=(await db.query('SELECT changes FROM construction_budget_history')).rows[0].changes;
  assert.deepEqual(changes.fields.find(f=>f.key==='issues').value,issues);
  assert.deepEqual(changes.clientEdit,r);
 }finally{await db.close();}
});
test('item edit entry points deny anonymous access and use an empty search path',async()=>{
 const db=await itemEditFixture();try{
  const acl=(await db.query("SELECT has_function_privilege('anon','public.construction_budget_edit_item(text,jsonb)','EXECUTE') anon,has_function_privilege('authenticated','public.construction_budget_edit_item(text,jsonb)','EXECUTE') authenticated")).rows[0];
  assert.equal(acl.anon,false);assert.equal(acl.authenticated,true);
  const definition=(await db.query("SELECT pg_get_functiondef('private.budget_edit_item(text,jsonb)'::regprocedure) body")).rows[0].body;
  assert.match(definition,/SET search_path TO ''/);
  await db.exec("SET test.actor=''");await assert.rejects(editItem(db,editRequest()),/denied/i);
 }finally{await db.close();}
});

test('unchanged item edits retain retry metadata even when the reverse patch is empty',async()=>{
 const db=await itemEditFixture();try{
  const r={...editRequest(),patch:{description:'Práce'}};
  const result=await editItem(db,r);assert.equal(result.version,2);
  assert.deepEqual(await editItem(db,r),result);
  const changes=(await db.query('SELECT changes FROM construction_budget_history')).rows[0].changes;
  assert.equal(changes.format,1);assert.equal(changes.nodes,null);assert.deepEqual(changes.clientEdit,r);
 }finally{await db.close();}
});
async function allocationPatchFixture(){const db=await itemEditFixture();const initial=read('20260919141602_construction_budget.sql');await db.exec(initial.slice(initial.indexOf('CREATE FUNCTION private.budget_apply_plan'),initial.indexOf('CREATE FUNCTION public.construction_budget_apply_plan')));if(!process.env.ALLOCATION_PATCH_RED)await db.exec(read('20260920230000_budget_assignment_patch.sql'));return db;}
const allocationRequest=()=>({operationId:randomUUID(),sourceId:source,revisionId:revision,version:1,itemIds:['item'],categoryId:'existing'});
const setAssignments=(db,r,project='p')=>db.query('SELECT public.construction_budget_set_assignments($1,$2) result',[project,r]).then(r=>r.rows[0].result);
test('small assignment and removal preserve zero links, history and retry without pipeline permission',async()=>{
 const db=await allocationPatchFixture();try{
  await db.exec("SET test.pipeline='no'");
  await db.query("UPDATE construction_budget_revisions SET document=jsonb_set(document,'{nodes,0,quantity}','\"0\"') WHERE id=$1",[revision]);
  const r=allocationRequest();const result=await setAssignments(db,r);
  assert.deepEqual(result.allocations,[{itemId:'item',categoryId:'existing',quantity:'0'}]);assert.equal(result.document,undefined);
  assert.deepEqual(await setAssignments(db,r),result);
  const remove={...allocationRequest(),version:2,categoryId:null};const removed=await setAssignments(db,remove);
  assert.deepEqual(removed.allocations,[]);assert.deepEqual(await setAssignments(db,remove),removed);
  await assert.rejects(setAssignments(db,r),/conflict/i);
  const rows=(await db.query('SELECT changes FROM construction_budget_history ORDER BY id')).rows;
  assert.equal(rows.length,2);assert.equal(rows[1].changes.allocations.items[0].value.quantity,'0');
 }finally{await db.close();}
});
test('small assignments retain all budget rights, project isolation, version and lock guards',async()=>{
 const db=await allocationPatchFixture();try{
  for(const permission of ['read','edit','prices','allocate']){
   await db.exec(`SET test.${permission}='no'`);await assert.rejects(setAssignments(db,allocationRequest()),/denied/i);await db.exec(`SET test.${permission}='yes'`);
  }
  await assert.rejects(setAssignments(db,allocationRequest(),'foreign'),/denied/i);
  for(const patch of [{sourceId:randomUUID()},{version:0},{categoryId:'foreign'},{itemIds:['missing']},{itemIds:['item','item']}])await assert.rejects(setAssignments(db,{...allocationRequest(),...patch}));
  await lock(db,true);await assert.rejects(setAssignments(db,allocationRequest()),/uzamčen/);
  assert.equal((await db.query('SELECT count(*)::int n FROM construction_budget_history')).rows[0].n,0);
 }finally{await db.close();}
});
test('removes assignments from a large budget without saving or returning the document',async()=>{
 const db=await allocationPatchFixture();try{
  const large={...document,nodes:Array.from({length:11000},(_,i)=>({...document.nodes[0],id:i?'item'+i:'item',description:'Synthetic '+i+'x'.repeat(700),order:i}))};
  await db.query('UPDATE construction_budget_revisions SET document=$1,allocations=$2 WHERE id=$3',[large,[{itemId:'item',categoryId:'existing',quantity:'10'}],revision]);
  const result=await setAssignments(db,{...allocationRequest(),categoryId:null});
  assert.ok(JSON.stringify(result).length<300);assert.deepEqual(result.allocations,[]);
  assert.deepEqual((await db.query('SELECT document FROM construction_budget_revisions WHERE id=$1',[revision])).rows[0].document,large);
 }finally{await db.close();}
});

test('plan allocation amounts match authoritative totals and preserve the disabled endpoint',async()=>{
 const db=await allocationPatchFixture();try{
  for(const [quantity,total,part,expected] of [['12','175','12','175.00'],['12','175','6','87.50'],['0','0','0','0.00'],['-12','-175','-6','-87.50']]){
   const result=(await db.query('SELECT private.budget_allocation_amount($1,$2)::text amount',[{quantity,total,unitPrice:'10'},part])).rows[0].amount;
   assert.equal(result,expected);
  }
  const definition=(await db.query("SELECT pg_get_functiondef('private.budget_apply_plan(text,uuid,text,numeric)'::regprocedure) body")).rows[0].body;
  assert.ok(definition.includes('private.budget_allocation_amount'));
  assert.equal((await db.query("SELECT has_function_privilege('anon','public.construction_budget_set_assignments(text,jsonb)','EXECUTE') allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});

test('coalesces legacy whole-item allocations to the same tender when editing quantity',async()=>{
 const db=await allocationPatchFixture();try{
  await db.query('UPDATE construction_budget_revisions SET allocations=$1 WHERE id=$2',[[{itemId:'item',categoryId:'existing',quantity:'3'},{itemId:'item',categoryId:'existing',quantity:'7'}],revision]);
  const result=await editItem(db,{...editRequest(),patch:{quantity:'12'}});
  assert.deepEqual(result.allocations,[{itemId:'item',categoryId:'existing',quantity:'12'}]);
 }finally{await db.close();}
});
