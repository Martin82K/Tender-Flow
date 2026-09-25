// Synthetic legacy contacts only; never copy production contact data here.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const read = name => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const migration = read('20260925081917_restore_baustav_shared_contacts.sql');
const pinnedHash = migration.match(/expected_scope_hash CONSTANT TEXT := '([a-f0-9]{64})'/)?.[1];
const orphanHash = migration.match(/expected_orphan_hash CONSTANT TEXT := '([a-f0-9]{64})'/)?.[1];
const contentHash = migration.match(/expected_content_hash CONSTANT TEXT := '([a-f0-9]{64})'/)?.[1];
// Only the environment-specific fingerprint is substituted. Freeze it before
// each scenario changes data; a count-preserving replacement must still fail.
const sqlFor = db => {
  let sql = pinnedHash ? migration.replace(pinnedHash, db.approvedScopeHash) : migration;
  if (orphanHash) sql = sql.replace(orphanHash, db.approvedOrphanHash);
  return contentHash ? sql.replace(contentHash, db.approvedContentHash) : sql;
};
const tenant = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const member = '00000000-0000-0000-0000-000000000011';
const former = '00000000-0000-0000-0000-000000000012';
const outsider = '00000000-0000-0000-0000-000000000013';
async function fixture() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    INSERT INTO auth.users VALUES ('${member}'),('${former}'),('${outsider}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
    $$;
  `);
  await db.exec(`
    CREATE TABLE organizations(id uuid PRIMARY KEY,name text,type text);
    INSERT INTO organizations VALUES ('${tenant}','Baustav','business'),('${other}','Other','business');
    CREATE TABLE organization_members(organization_id uuid,user_id uuid,role text,is_active boolean);
    INSERT INTO organization_members VALUES ('${tenant}','${member}','owner',true),('${tenant}','${former}','member',false),('${other}','${outsider}','member',true);
    CREATE TABLE subcontractors(id varchar PRIMARY KEY,organization_id uuid REFERENCES organizations,owner_id uuid REFERENCES auth.users,
      company_name text,contacts jsonb DEFAULT '[]',created_at timestamp DEFAULT '2026-03-01',updated_at timestamp DEFAULT '2026-08-10');
    CREATE TABLE projects(id text PRIMARY KEY,organization_id uuid);
    CREATE TABLE demand_categories(id text PRIMARY KEY,project_id text REFERENCES projects);
    CREATE TABLE bids(id text PRIMARY KEY,subcontractor_id varchar REFERENCES subcontractors,demand_category_id text REFERENCES demand_categories);
    CREATE TABLE contracts(id text PRIMARY KEY,vendor_id varchar REFERENCES subcontractors,organization_id uuid,project_id text REFERENCES projects);
    INSERT INTO projects VALUES ('target','${tenant}'),('other','${other}');
    INSERT INTO demand_categories VALUES ('target','target'),('other','other');
    INSERT INTO subcontractors(id,owner_id,company_name) SELECT 'repair-'||n,'${former}','Supplier '||n FROM generate_series(1,20) n;
    INSERT INTO bids SELECT 'bid-'||n,'repair-'||n,'target' FROM generate_series(1,10) n;
    INSERT INTO contracts(id,vendor_id,project_id) SELECT 'contract-'||n,'repair-'||n,'target' FROM generate_series(11,20) n;
    INSERT INTO bids SELECT 'legacy-orphan-'||n,CASE WHEN n<=4 THEN 'repair-2' ELSE 'repair-16' END,NULL FROM generate_series(1,6) n;
    INSERT INTO subcontractors(id,owner_id,company_name) VALUES
      ('personal','${former}','Personal'),('cross','${former}','Cross tenant'),('foreign-owner','${outsider}','Unconfirmed owner');
    INSERT INTO bids VALUES ('cross-target','cross','target'),('cross-other','cross','other'),('foreign','foreign-owner','target');
    CREATE FUNCTION normalize_subcontractor_company_identity(text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT lower(trim($1)) $$;
    CREATE FUNCTION get_my_org_ids() RETURNS uuid[] LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
      SELECT ARRAY(SELECT organization_id FROM public.organization_members WHERE user_id=auth.uid() AND is_active=true)
    $$;
    GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
    GRANT SELECT,INSERT,UPDATE,DELETE ON subcontractors TO authenticated;
    GRANT SELECT ON subcontractors TO anon;
    ALTER TABLE subcontractors ENABLE ROW LEVEL SECURITY;
    CREATE POLICY read_contact ON subcontractors FOR SELECT TO authenticated
      USING(owner_id=auth.uid() OR organization_id=ANY(get_my_org_ids()));
    CREATE POLICY subscription_required ON subcontractors AS RESTRICTIVE TO authenticated
      USING(coalesce(current_setting('test.subscription',true),'yes')='yes');
  `);
  await db.exec(read('20260820101425_assign_contacts_to_member_tenant.sql').split('LOCK TABLE public.subcontractors')[0]);
  await db.exec(`CREATE TRIGGER guard_subcontractor_company_name_conflict BEFORE INSERT OR UPDATE OF company_name,owner_id,organization_id ON subcontractors
      FOR EACH ROW EXECUTE FUNCTION private.guard_subcontractor_company_name_conflict();
    CREATE POLICY update_contact ON subcontractors FOR UPDATE TO authenticated
      USING(owner_id=auth.uid() OR organization_id=ANY(get_my_org_ids()))
      WITH CHECK(private.can_write_subcontractor_tenant(owner_id,organization_id));`);
  db.approvedScopeHash = (await db.query(`SELECT encode(sha256(convert_to(string_agg(
    jsonb_build_array(id,owner_id,organization_id,$1::uuid)::text,'|' ORDER BY id),'UTF8')),'hex') AS hash
    FROM subcontractors WHERE id LIKE 'repair-%'`,[tenant])).rows[0].hash;
  db.approvedOrphanHash = (await db.query(`SELECT encode(sha256(convert_to(string_agg(
    jsonb_build_array(id,subcontractor_id,demand_category_id)::text,'|' ORDER BY id),'UTF8')),'hex') AS hash
    FROM bids WHERE id LIKE 'legacy-orphan-%'`)).rows[0].hash;
  db.approvedContentHash = (await db.query(`SELECT encode(sha256(convert_to(string_agg(
    to_jsonb(s)::text,'|' ORDER BY id),'UTF8')),'hex') AS hash
    FROM subcontractors s WHERE id LIKE 'repair-%'`)).rows[0].hash;
  return db;
}
const run = db => db.exec(`BEGIN; ${sqlFor(db)} COMMIT;`);
async function visible(db,user,role='authenticated') {
  await db.exec(`SET request.jwt.claims='${JSON.stringify({sub:user,role})}'; SET ROLE ${role}`);
  try { return (await db.query("SELECT id FROM subcontractors WHERE id LIKE 'repair-%' ORDER BY id")).rows.length; }
  finally { await db.exec('RESET ROLE'); }
}
const snapshot = async db => (await db.query(`SELECT jsonb_build_object(
  'contacts',(SELECT jsonb_agg(to_jsonb(s)-'organization_id'-'owner_id'-'updated_at' ORDER BY id) FROM subcontractors s),
  'bids',(SELECT jsonb_agg(b ORDER BY id) FROM bids b),
  'contracts',(SELECT jsonb_agg(c ORDER BY id) FROM contracts c),
  'policies',(SELECT jsonb_agg(p ORDER BY policyname) FROM pg_policies p WHERE tablename='subcontractors'),
  'constraints',(SELECT jsonb_agg(pg_get_constraintdef(oid) ORDER BY conname) FROM pg_constraint WHERE conrelid='subcontractors'::regclass),
  'triggers',(SELECT jsonb_agg(pg_get_triggerdef(oid) ORDER BY tgname) FROM pg_trigger WHERE tgrelid='subcontractors'::regclass AND NOT tgisinternal)
) state`)).rows[0].state;
test('shares legacy contacts with active members, preserves content and references, revokes former owner access', async()=>{
  const db=await fixture();
  try {
    assert.equal(await visible(db,member),0);
    const before=await snapshot(db);
    await run(db);
    assert.equal(await visible(db,member),20);
    assert.equal(await visible(db,former),0);
    assert.equal(await visible(db,outsider),0);
    assert.equal(await visible(db,member,'anon'),0);
    assert.deepEqual(await snapshot(db),before);
    assert.equal((await db.query('SELECT count(*)::int n FROM private.baustav_contact_scope_repair_20260925')).rows[0].n,20);
    assert.equal((await db.query('SELECT sum(unresolved_bid_count)::int n FROM private.baustav_contact_scope_repair_20260925')).rows[0].n,6);
    assert.equal((await db.query("SELECT count(*)::int n FROM subcontractors WHERE id IN ('personal','cross','foreign-owner') AND organization_id IS NULL")).rows[0].n,3);
    await db.exec(`SET request.jwt.claims='{"sub":"${member}"}'; SET ROLE authenticated; UPDATE subcontractors SET contacts='[{"name":"Updated"}]' WHERE id='repair-1'; RESET ROLE;`);
    await run(db); // Do not rewrite later edits on repeated application.
    assert.equal((await db.query("SELECT contacts->0->>'name' name FROM subcontractors WHERE id='repair-1'")).rows[0].name,'Updated');
    await db.exec("SET test.subscription='no'");
    assert.equal(await visible(db,member),0);
    await db.exec("SET test.subscription='yes'");
    await db.exec(`UPDATE organization_members SET is_active=false WHERE user_id='${member}'`);
    assert.equal(await visible(db,member),0);
    // Former account deletion must not delete or strand the restored records.
    await db.exec(`DELETE FROM subcontractors WHERE owner_id='${former}' AND id='personal'; DELETE FROM bids WHERE subcontractor_id='cross'; DELETE FROM subcontractors WHERE id='cross'; DELETE FROM auth.users WHERE id='${former}'`);
    assert.equal((await db.query("SELECT count(*)::int n FROM subcontractors WHERE organization_id=$1 AND owner_id IS NULL",[tenant])).rows[0].n,20);
  } finally { await db.close(); }
});
for (const scenario of ['count drift','name conflict','ambiguous organization','unresolvable reference','same-count replacement','same-count orphan replacement','personal content edit','missing organization','foreign contract project','missing contract project']) {
  test(`aborts atomically on ${scenario}`, async()=>{
    const db=await fixture();
    try {
      if(scenario==='count drift') await db.exec("DELETE FROM bids WHERE subcontractor_id='repair-1'");
      if(scenario==='name conflict') await db.exec(`INSERT INTO subcontractors(id,organization_id,company_name) VALUES ('duplicate','${tenant}','Supplier 1')`);
      if(scenario==='ambiguous organization') await db.exec(`UPDATE organizations SET name='Baustav' WHERE id='${other}'`);
      if(scenario==='unresolvable reference') await db.exec("INSERT INTO bids VALUES ('unscoped','repair-1',NULL)");
      if(scenario==='same-count replacement') await db.exec("DELETE FROM bids WHERE subcontractor_id='repair-1'; INSERT INTO bids VALUES ('replacement','personal','target')");
      if(scenario==='same-count orphan replacement') await db.exec("UPDATE bids SET id='different-orphan' WHERE id='legacy-orphan-1'");
      if(scenario==='personal content edit') await db.exec(`SET request.jwt.claims='{"sub":"${former}"}'; SET ROLE authenticated; UPDATE subcontractors SET contacts='[{"name":"Changed after approval"}]' WHERE id='repair-1'; RESET ROLE;`);
      if(scenario==='missing organization') await db.exec(`UPDATE organizations SET name='Renamed' WHERE id='${tenant}'`);
      if(scenario==='foreign contract project') await db.exec(`UPDATE contracts SET project_id='other',organization_id='${tenant}' WHERE id='contract-11'`);
      if(scenario==='missing contract project') await db.exec("UPDATE contracts SET project_id=NULL WHERE id='contract-11'");
      const before=await snapshot(db);
      await assert.rejects(run(db)); await db.exec('ROLLBACK');
      assert.deepEqual(await snapshot(db),before);
      assert.equal(await visible(db,member),0);
    } finally { await db.close(); }
  });
}
test('backup is private and transaction rollback restores the original scope', async()=>{
  const db=await fixture();
  try {
    await db.exec(`BEGIN; ${sqlFor(db)}`);
    assert.equal(await visible(db,member),20);
    for(const role of ['anon','authenticated','service_role']) {
      assert.equal((await db.query("SELECT has_table_privilege($1,'private.baustav_contact_scope_repair_20260925','SELECT') ok",[role])).rows[0].ok,false);
    }
    await db.exec('ROLLBACK');
    assert.equal(await visible(db,member),0);
    assert.equal(await visible(db,former),20);
  } finally { await db.close(); }
});
