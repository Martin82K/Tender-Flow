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
    CREATE TABLE public.demand_categories(id text PRIMARY KEY,project_id text REFERENCES projects(id),title text,status text,description text,budget_display text,sod_budget numeric,plan_budget numeric);
    CREATE FUNCTION public.can_project_module_action(text,text,boolean) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1='p' AND current_setting('test.pipeline',true)='yes' $$;
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
  await db.exec(migration);
  return db;
}
const request=()=>({operationId:randomUUID(),mode:'assignments',sourceId:source,revisionId:revision,version:1,expectedCatalog:[{id:'existing',title:'Existující',externalCode:''}],newCategories:[{id:'new',title:'Nové',externalCode:'02'}],assignments:[{itemId:'item',categoryId:'new',action:'remaining'}]});
const call=(db,r,project='p')=>db.query('SELECT public.construction_budget_import_tenders($1,$2) result',[project,r]).then(r=>r.rows[0].result);

test('mapping preserves authoritative document, creates project tenders atomically and retries once',async()=>{
  const db=await fixture();try{
    const r=request();const result=await call(db,r);
    assert.deepEqual(result.revision.document,document);assert.deepEqual(result.revision.allocations,[{itemId:'item',categoryId:'new',quantity:'10'}]);
    assert.equal(result.revision.version,2);assert.equal((await call(db,r)).revision.version,2);
    assert.equal((await db.query("SELECT external_code FROM demand_categories WHERE id='new'")).rows[0].external_code,'02');
    await assert.rejects(call(db,{...r,assignments:[]}),/jiné operaci/);
  }finally{await db.close();}
});
test('rejects forged document, foreign target, duplicate target and stale versions with zero partial inserts',async()=>{
  const db=await fixture();try{
    for(const patch of [{document},{version:0},{assignments:[{itemId:'item',categoryId:'foreign',action:'remaining'}]},{assignments:[{itemId:'item',categoryId:'new',action:'remaining'},{itemId:'item',categoryId:'new',action:'remaining'}]}]){
      await assert.rejects(call(db,{...request(),...patch}));
      assert.equal((await db.query("SELECT count(*)::int n FROM demand_categories WHERE id='new'")).rows[0].n,0);
    }
    await assert.rejects(call(db,request(),'foreign'),/povolen/);
  }finally{await db.close();}
});
test('enforces each permission and catalog snapshot, including no-op retry authorization',async()=>{
  const db=await fixture();try{
    for(const permission of ['read','edit','prices','allocate','pipeline']){
      await db.exec(`SET test.${permission}='no'`);await assert.rejects(call(db,request()),/povolen/);await db.exec(`SET test.${permission}='yes'`);
    }
    await assert.rejects(call(db,{...request(),expectedCatalog:[]}),/Seznam VŘ/);
    const r=request();await call(db,r);await db.exec("SET test.prices='no'");await assert.rejects(call(db,r),/povolen/);
  }finally{await db.close();}
});
test('remaining and explicit replacement use target quantity and confirmed revisions become copies',async()=>{
  const db=await fixture();try{
    await db.query('UPDATE construction_budget_revisions SET allocations=$1,status=$2 WHERE id=$3',[[{itemId:'item',categoryId:'existing',quantity:'3'}],'confirmed',revision]);
    const result=await call(db,request());assert.notEqual(result.revision.id,revision);
    assert.deepEqual(result.revision.allocations,[{itemId:'item',categoryId:'existing',quantity:'3'},{itemId:'item',categoryId:'new',quantity:'7'}]);
    assert.equal((await db.query('SELECT status FROM construction_budget_revisions WHERE id=$1',[revision])).rows[0].status,'confirmed');
  }finally{await db.close();}
});
test('templates copy only definitions, reject duplicates, and do not create a revision',async()=>{
  const db=await fixture();try{
    const r={...request(),mode:'template',assignments:[]};
    assert.equal((await call(db,r)).revision,null);
    assert.equal((await db.query('SELECT count(*)::int n FROM construction_budget_revisions')).rows[0].n,1);
    const catalog=[...r.expectedCatalog,{id:'new',title:'Nové',externalCode:'02'}];
    await assert.rejects(call(db,{...r,operationId:randomUUID(),expectedCatalog:catalog,newCategories:[{id:'other',title:' NOVÉ ',externalCode:'03'}]}),/Duplicitní/);
    assert.equal((await db.query("SELECT count(*)::int n FROM demand_categories WHERE id='other'")).rows[0].n,0);
  }finally{await db.close();}
});
test('restores external codes within the authorized scope and keeps codes for old backups',async()=>{
  const db=await fixture();try{
    for(const scope of ['user','tenant']){
      await db.query(`SELECT public.restore_${scope}_backup_without_offer_deadline_20260817($1,$2)`,[{demand_categories:[{id:'existing',project_id:'p',external_code:'007'},{id:'foreign',project_id:'foreign',external_code:'leak'}]},org]);
      assert.equal((await db.query("SELECT external_code FROM demand_categories WHERE id='existing'")).rows[0].external_code,'007');
      assert.equal((await db.query("SELECT external_code FROM demand_categories WHERE id='foreign'")).rows[0].external_code,null);
      await db.query(`SELECT public.restore_${scope}_backup_without_offer_deadline_20260817($1,$2)`,[{demand_categories:[{id:'existing',project_id:'p'}]},org]);
      assert.equal((await db.query("SELECT external_code FROM demand_categories WHERE id='existing'")).rows[0].external_code,'007');
    }
  }finally{await db.close();}
});
test('applies explicit replacement and negative quantities without exceeding target amounts',async()=>{
  const db=await fixture();try{
    const doc=structuredClone(document);doc.nodes[0].quantity='-10';
    await db.query('UPDATE construction_budget_revisions SET document=$1,allocations=$2 WHERE id=$3',[doc,[{itemId:'item',categoryId:'existing',quantity:'-3'}],revision]);
    const r=request();r.assignments[0].action='replace';
    assert.deepEqual((await call(db,r)).revision.allocations,[{itemId:'item',categoryId:'new',quantity:'-10'}]);
  }finally{await db.close();}
});
test('revision mode accepts new prices while removing raw previews, and public grants exclude anonymous callers',async()=>{
  const db=await fixture();try{
    const doc=structuredClone(document);doc.nodes[0].quantity='40';doc.sheets=[{id:'s',name:'SO',selected:true,sourcePreview:{rows:[{value:'secret'}]}}];
    const r={...request(),mode:'revision',title:'Nová verze',document:doc,allocations:[]};const result=await call(db,r);
    assert.notEqual(result.revision.id,revision);assert.equal(result.revision.document.nodes[0].quantity,'40');assert.equal(result.revision.document.sheets[0].sourcePreview,undefined);
    assert.deepEqual(result.revision.allocations,[{itemId:'item',categoryId:'new',quantity:'40'}]);
    const grants=(await db.query("SELECT has_function_privilege('anon','public.construction_budget_import_tenders(text,jsonb)','EXECUTE') anon,has_function_privilege('authenticated','public.construction_budget_import_tenders(text,jsonb)','EXECUTE') authenticated,has_table_privilege('authenticated','private.budget_tender_import_operations','SELECT') private_read")).rows[0];
    assert.deepEqual(grants,{anon:false,authenticated:true,private_read:false});
  }finally{await db.close();}
});

test('does not resurrect deleted results and cascades operation records with project deletion',async()=>{
  const db=await fixture();try{
    const r=request();await call(db,r);
    await db.query('UPDATE construction_budget_revisions SET deleted_at=now() WHERE id=$1',[revision]);
    await assert.rejects(call(db,r),/již není dostupný/);
    await db.query('DELETE FROM construction_budget_history WHERE revision_id=$1',[revision]);
    await db.query('DELETE FROM construction_budget_revisions WHERE id=$1',[revision]);
    await assert.rejects(call(db,r),/již byl odstraněn/);
    assert.equal((await db.query('SELECT revision_id FROM private.budget_tender_import_operations')).rows[0].revision_id,null);
    await db.exec("DELETE FROM demand_categories WHERE project_id='p'; DELETE FROM construction_budget_sources WHERE project_id='p'; DELETE FROM projects WHERE id='p'");
    assert.equal((await db.query('SELECT count(*)::int n FROM private.budget_tender_import_operations')).rows[0].n,0);
  }finally{await db.close();}
});
test('operation records do not prevent actor deletion and zero target quantity creates no allocation',async()=>{
  const db=await fixture();try{
    const doc=structuredClone(document);doc.nodes[0].quantity='0';
    await db.query('UPDATE construction_budget_revisions SET document=$1 WHERE id=$2',[doc,revision]);
    const r=request();assert.deepEqual((await call(db,r)).revision.allocations,[]);
    // Isolate this migration from the pre-existing author FKs; account cleanup is
    // covered by the integration migration's own regressions.
    await db.exec('DELETE FROM construction_budget_history; DELETE FROM construction_budget_revisions; DELETE FROM construction_budget_sources');
    await db.query('DELETE FROM auth.users WHERE id=$1',[actor]);
    await db.exec("SET test.actor=''");await assert.rejects(call(db,r),/povolen/);
  }finally{await db.close();}
});
