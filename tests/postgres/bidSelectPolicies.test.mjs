// Isolated policy equivalence and query-plan regressions; no production data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const read = name => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const migration = read('20260924221934_optimize_bid_select_policy_sets.sql');
const originalVisible = read('20260807173635_allow_demo_bid_select.sql');
const actor = '00000000-0000-0000-0000-000000000001';
async function fixture(column) {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE tenderflow_mcp_client;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '${actor}'::uuid $$;
    CREATE FUNCTION is_org_member(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('test.org',true)='yes' $$;
    CREATE FUNCTION is_project_shared_with_user(text,uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1='shared' AND current_setting('test.share',true)='yes' $$;
    CREATE FUNCTION can_project_module_action(text,text,boolean) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1 IS NOT NULL AND current_setting('test.module',true)='yes' $$;
    CREATE FUNCTION has_project_subscription(text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1 <> 'expired' AND current_setting('test.subscription',true)='yes' $$;
    CREATE TABLE projects(id text PRIMARY KEY, owner_id uuid, organization_id uuid, is_demo boolean DEFAULT false);
    CREATE TABLE demand_categories(id text PRIMARY KEY, project_id text REFERENCES projects);
    CREATE TABLE bids(id text PRIMARY KEY, ${column} text REFERENCES demand_categories, price int);
    CREATE INDEX bids_category ON bids(${column});
    CREATE TABLE user_hidden_projects(project_id text, user_id uuid);
    INSERT INTO projects VALUES ('owned','${actor}',NULL,false), ('foreign',NULL,NULL,false),
      ('org',NULL,'${actor}',false), ('shared',NULL,NULL,false), ('demo',NULL,NULL,true), ('expired','${actor}',NULL,false);
    INSERT INTO demand_categories SELECT id||'-category',id FROM projects;
    INSERT INTO bids SELECT p.id||'-'||n,p.id||'-category',n FROM projects p CROSS JOIN generate_series(1,100) n;
    INSERT INTO bids VALUES ('null-category',NULL,0);
    GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,tenderflow_mcp_client;
    GRANT SELECT ON projects,demand_categories,user_hidden_projects TO authenticated,tenderflow_mcp_client;
    GRANT SELECT,INSERT,UPDATE,DELETE ON bids TO authenticated;
    GRANT SELECT ON bids TO tenderflow_mcp_client;
    ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
    ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
    ALTER TABLE demand_categories ENABLE ROW LEVEL SECURITY;
    CREATE POLICY project_access ON projects TO authenticated,tenderflow_mcp_client USING (id <> current_setting('test.revoked',true));
    CREATE POLICY category_access ON demand_categories TO authenticated,tenderflow_mcp_client USING (id <> current_setting('test.hidden_category',true));
    CREATE POLICY team_module_bids_select ON bids AS RESTRICTIVE FOR SELECT TO authenticated
      USING(can_project_module_action((SELECT dc.project_id FROM demand_categories dc WHERE dc.id=bids.${column}), 'module_pipeline',false));
    CREATE POLICY subscription_required ON bids AS RESTRICTIVE TO authenticated,tenderflow_mcp_client USING ((SELECT current_setting('test.subscription',true)='yes'));
    CREATE POLICY tenant_subscription_required ON bids AS RESTRICTIVE TO authenticated,tenderflow_mcp_client
      USING (EXISTS(SELECT 1 FROM demand_categories dc WHERE dc.id=bids.${column} AND has_project_subscription(dc.project_id)));
    CREATE POLICY block_oauth_client_direct_access ON bids AS RESTRICTIVE TO authenticated USING ((SELECT current_setting('test.oauth',true)='no'));
    CREATE POLICY mcp_bids_select ON bids FOR SELECT TO tenderflow_mcp_client USING (${column}='owned-category');
    CREATE POLICY write_access ON bids FOR INSERT TO authenticated WITH CHECK (${column}='owned-category');
    COMMENT ON POLICY team_module_bids_select ON bids IS 'keep this comment';
    SET test.org='yes'; SET test.share='yes'; SET test.module='yes'; SET test.subscription='yes'; SET test.oauth='no'; SET test.revoked=''; SET test.hidden_category='';
  `);
  await db.exec(originalVisible);
  return db;
}
const readAs = async (db, role='authenticated') => {
  await db.exec(`SET ROLE ${role}`);
  try { return (await db.query('SELECT id FROM bids ORDER BY id')).rows; }
  finally { await db.exec('RESET ROLE'); }
};
const snapshot = async db => (await db.query(`SELECT jsonb_build_object(
 'rows',(SELECT jsonb_agg(b ORDER BY id) FROM bids b),
 'acl',(SELECT jsonb_agg(jsonb_build_array(relname,relacl,relrowsecurity) ORDER BY relname) FROM pg_class WHERE oid IN ('projects'::regclass,'demand_categories'::regclass,'bids'::regclass)),
 'constraints',(SELECT jsonb_agg(pg_get_constraintdef(oid) ORDER BY conname) FROM pg_constraint WHERE conrelid='bids'::regclass),
 'indexes',(SELECT jsonb_agg(indexdef ORDER BY indexname) FROM pg_indexes WHERE tablename='bids'),
 'other_policies',(SELECT jsonb_agg(p ORDER BY policyname) FROM pg_policies p WHERE policyname NOT IN ('Bids visible through project','team_module_bids_select'))
) state`)).rows[0].state;
for (const column of ['demand_category_id','category_id']) {
  test(`preserves policy decisions and stored data for ${column}`, async () => {
    const db = await fixture(column);
    try {
      const scenarios = [
        '', "SET test.org='no'", "SET test.share='no'", "SET test.module='no'",
        "SET test.subscription='no'", "SET test.oauth='yes'", "SET test.revoked='owned'",
        "SET test.hidden_category='owned-category'",
        `INSERT INTO user_hidden_projects VALUES ('demo','${actor}')`,
      ];
      const before = await snapshot(db);
      const expected=[];
      for(const sql of scenarios) {
        await db.exec('BEGIN'); if(sql) await db.exec(sql);
        expected.push(await readAs(db)); await db.exec('ROLLBACK');
      }
      assert.equal(expected[0].length,400); // owner, organization, shared, demo; foreign and expired denied.
      await db.exec(migration);
      assert.deepEqual(await snapshot(db),before);
      for(let i=0;i<scenarios.length;i++) {
        await db.exec('BEGIN'); if(scenarios[i]) await db.exec(scenarios[i]);
        assert.deepEqual(await readAs(db),expected[i],scenarios[i]); await db.exec('ROLLBACK');
      }
      assert.equal((await readAs(db,'tenderflow_mcp_client')).length,100);
      await assert.rejects(readAs(db,'anon'),{code:'42501'});
      await db.exec('SET ROLE authenticated');
      await assert.rejects(db.exec(`INSERT INTO bids VALUES ('bad','foreign-category',1)`),{code:'42501'});
      await db.exec(`INSERT INTO bids VALUES ('good','owned-category',1); RESET ROLE;`);
      await db.exec(migration); // Idempotent policy alteration, no data writes.
      assert.equal((await db.query("SELECT obj_description(oid,'pg_policy') AS comment FROM pg_policy WHERE polname='team_module_bids_select'")).rows[0].comment,'keep this comment');
    } finally { await db.close(); }
  });
}
test('evaluates category visibility as sets instead of repeating the category lookup per bid',async()=>{
  const db=await fixture('demand_category_id');
  try {
    const measure = async () => {
      await db.exec('SET ROLE authenticated');
      const plan=(await db.query("EXPLAIN (ANALYZE,FORMAT JSON) SELECT * FROM bids WHERE demand_category_id='owned-category'")).rows[0]['QUERY PLAN'][0].Plan;
      await db.exec('RESET ROLE');
      const nodes=[]; const visit=node=>{ nodes.push(node); (node.Plans||[]).forEach(visit); }; visit(plan);
      assert.equal(plan['Actual Rows'],100);
      return nodes.filter(n=>n['Relation Name']==='demand_categories').reduce((sum,n)=>sum+n['Actual Loops'],0);
    };
    const before=await measure();
    await db.exec(migration);
    const after=await measure();
    // The untouched tenant policy may still use a correlated lookup. The two
    // optimized SELECT policies must remove their per-bid category lookups.
    assert.ok(after < before / 2, `category scan loops before=${before}, after=${after}`);
  } finally { await db.close(); }
});
