// Run only against an isolated in-memory PostgreSQL instance; no production URL.
// PGLITE_MODULE points to a separately audited @electric-sql/pglite ESM entry.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

assert.ok(process.env.PGLITE_MODULE, 'Set PGLITE_MODULE to an audited local PGlite ESM entry (see docs/development/bid-id-width.md).');
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const read = name => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const migration = read('20260912190251_widen_bid_and_tag_ids.sql');
const initial = read('20251129225023_initial_schema.sql');
const team = read('20260808120000_project_teams_contract_overview.sql');
const teamPolicies = team.slice(team.indexOf('DO $$\nDECLARE spec TEXT[]; relation_name TEXT; parent_kind'),
  team.indexOf('END $$;', team.indexOf('DO $$\nDECLARE spec TEXT[]; relation_name TEXT; parent_kind')) + 7);
const backup = read('20260405180000_backup_restore_system.sql');
const longId = `${'a'.repeat(36)}-restore-123456789`;
assert.equal(longId.length, 54);
const otherId = `${longId.slice(0, -1)}0`;

const snapshotSql = `SELECT jsonb_build_object(
  'rows', (SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM bids b),
  'tags', (SELECT jsonb_agg(to_jsonb(t) ORDER BY bid_id, tag) FROM bid_tags t),
  'acl', (SELECT jsonb_agg(jsonb_build_array(relname, relacl, relrowsecurity, relforcerowsecurity) ORDER BY relname)
    FROM pg_class WHERE oid IN ('bids'::regclass, 'bid_tags'::regclass)),
  'policies', (SELECT jsonb_agg(jsonb_build_array(policyname, permissive, roles, cmd,
    replace(replace(qual, '(b.id)::text', 'b.id'), '(bid_tags.bid_id)::text', 'bid_tags.bid_id'),
    replace(replace(with_check, '(b.id)::text', 'b.id'), '(bid_tags.bid_id)::text', 'bid_tags.bid_id')) ORDER BY policyname)
    FROM pg_policies WHERE tablename IN ('bids', 'bid_tags')),
  'constraints', (SELECT jsonb_agg(jsonb_build_array(conname, pg_get_constraintdef(oid), convalidated) ORDER BY conname)
    FROM pg_constraint WHERE conrelid IN ('bids'::regclass, 'bid_tags'::regclass, 'mcp_private.outlook_message_links'::regclass)),
  'indexes', (SELECT jsonb_agg(jsonb_build_array(indexname, indexdef) ORDER BY indexname)
    FROM pg_indexes WHERE tablename IN ('bids', 'bid_tags', 'outlook_message_links'))
) AS state`;

async function fixture(live, policies) {
  const db = new PGlite();
  await db.exec(initial);
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon;
    ALTER TABLE projects ADD owner_id uuid;
    ALTER TABLE projects ADD organization_id uuid;
    ALTER TABLE bids ADD update_date date;
    ALTER TABLE bids ADD selection_round integer;
    ALTER TABLE bids ADD price_history jsonb;
    ALTER TABLE bids ADD contracted boolean;
    ${live ? 'ALTER TABLE bids ALTER COLUMN id TYPE text;' : ''}
    CREATE TABLE contracts (id text PRIMARY KEY, source_bid_id text);
    CREATE SCHEMA mcp_private;
    CREATE TABLE mcp_private.outlook_message_links (
      id text PRIMARY KEY, bid_id text REFERENCES bids(id) ON DELETE CASCADE
    );
    CREATE FUNCTION public.can_project_module_action(text, text, boolean) RETURNS boolean
    LANGUAGE sql STABLE AS 'SELECT $1 = current_setting(''test.project_id'', true)';
    GRANT USAGE ON SCHEMA public TO authenticated, anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON bids, bid_tags TO authenticated;
    GRANT SELECT ON demand_categories TO authenticated;
    ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
    ALTER TABLE bid_tags ENABLE ROW LEVEL SECURITY;
    CREATE POLICY base_bids ON bids TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY base_tags ON bid_tags TO authenticated USING (true) WITH CHECK (true);
    INSERT INTO projects(id,name,owner_id,organization_id) VALUES
      ('own','Own','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001'),
      ('other','Other','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002');
    INSERT INTO demand_categories(id,project_id,title) VALUES ('own-category','own','Own'),('other-category','other','Other');
    INSERT INTO bids(id,category_id) VALUES ('legacy','own-category'),('foreign-bid','other-category');
    INSERT INTO bid_tags VALUES ('legacy','existing'),('foreign-bid','private');
  `);
  if (policies) {
    await db.exec(teamPolicies);
    await db.exec(`COMMENT ON POLICY team_module_bid_tags_update ON bid_tags IS 'Preserve access and comment';`);
  }
  return db;
}

for (const [name, live, policies] of [
  ['versioned initial schema with RLS dependencies', false, true],
  ['live type drift with RLS dependencies', true, true],
  ['initial schema without dependent policies', false, false],
]) {
  test(`should preserve long bid IDs and relationships: ${name}`, async () => {
    const db = await fixture(live, policies);
    try {
      await assert.rejects(db.query('INSERT INTO bid_tags VALUES ($1,$2)', [longId, 'tag']), { code: '22001' });
      if (!live) await assert.rejects(db.query('INSERT INTO bids(id) VALUES ($1)', [longId]), { code: '22001' });
      const before = (await db.query(snapshotSql)).rows[0].state;
      await db.exec(migration);
      assert.deepEqual((await db.query(snapshotSql)).rows[0].state, before);
      if (policies) assert.equal((await db.query(`SELECT obj_description(oid,'pg_policy') AS comment
        FROM pg_policy WHERE polname='team_module_bid_tags_update'`)).rows[0].comment, 'Preserve access and comment');
      assert.deepEqual((await db.query(`SELECT format_type(atttypid,atttypmod) AS type
        FROM pg_attribute WHERE (attrelid='bids'::regclass AND attname='id')
        OR (attrelid='bid_tags'::regclass AND attname='bid_id') ORDER BY attrelid`)).rows,
      [{ type: 'text' }, { type: 'text' }]);
      await db.query('INSERT INTO bids(id,category_id) VALUES ($1,$3),($2,$3)', [longId, otherId, 'own-category']);
      await db.query('INSERT INTO bid_tags VALUES ($1,$3),($2,$3)', [longId, otherId, 'restored']);
      await db.query('INSERT INTO contracts VALUES ($1,$2)', ['contract', longId]);
      await db.query('INSERT INTO mcp_private.outlook_message_links VALUES ($1,$2)', ['message', longId]);
      assert.equal((await db.query('SELECT count(*)::int AS count FROM bids WHERE length(id)=54')).rows[0].count, 2);
      await assert.rejects(db.query('INSERT INTO bid_tags VALUES ($1,$2)', [longId, 'restored']), { code: '23505' });
      await assert.rejects(db.query('INSERT INTO bid_tags VALUES ($1,$2)', ['missing', 'tag']), { code: '23503' });
      if (policies) {
        await db.exec(`SET ROLE authenticated; SET test.project_id = 'own';`);
        assert.equal((await db.query(`SELECT count(*)::int AS count FROM bid_tags WHERE bid_id='foreign-bid'`)).rows[0].count, 0);
        await assert.rejects(db.exec(`INSERT INTO bid_tags VALUES ('foreign-bid','forbidden')`), { code: '42501' });
        await db.query('INSERT INTO bid_tags VALUES ($1,$2)', [longId, 'allowed']);
        await db.query('UPDATE bid_tags SET tag=$2 WHERE bid_id=$1 AND tag=$3', [longId, 'updated', 'allowed']);
        await db.query('DELETE FROM bid_tags WHERE bid_id=$1 AND tag=$2', [longId, 'updated']);
        await db.exec('RESET ROLE; SET ROLE anon;');
        await assert.rejects(db.exec('SELECT * FROM bid_tags'), { code: '42501' });
        await db.exec('RESET ROLE;');
      }
      // Replay the actual bid/tag loops from both versioned restore functions.
      for (const [start, end] of [['-- 8. Restore bids', '-- 10. Restore tender_plans'], ['-- 8. bids', '-- 10. tender_plans']]) {
        const loops = backup.slice(backup.indexOf(start), backup.indexOf(end, backup.indexOf(start)));
        assert.ok(loops.includes('INSERT INTO public.bids') && loops.includes('INSERT INTO public.bid_tags'));
        await db.exec(`CREATE OR REPLACE FUNCTION public.test_restore(backup_json jsonb) RETURNS void LANGUAGE plpgsql AS $$
          DECLARE item jsonb; uid uuid := '00000000-0000-0000-0000-000000000001';
          target_org_id uuid := uid; cnt_bids int := 0; cnt_bid_tags int := 0;
          BEGIN ${loops} END $$;`);
        const restoredId = `${longId.slice(0, -1)}${start.includes('Restore') ? '1' : '2'}`;
        const payload = { bids: [{ id: restoredId, category_id: 'own-category', status: 'offer' }], bid_tags: [{ bid_id: restoredId, tag: 'backup' }] };
        await db.query('SELECT test_restore($1::jsonb)', [JSON.stringify(payload)]);
        await db.query('SELECT test_restore($1::jsonb)', [JSON.stringify(payload)]);
        assert.equal((await db.query('SELECT bid_id FROM bid_tags WHERE bid_id=$1', [restoredId])).rows[0].bid_id, restoredId);
        await db.query('SELECT test_restore($1::jsonb)', [JSON.stringify({
          bids: [{ id: 'forbidden-restore', category_id: 'other-category', status: 'offer' }],
          bid_tags: [{ bid_id: 'foreign-bid', tag: 'forbidden-restore' }],
        })]);
        assert.equal((await db.query("SELECT * FROM bids WHERE id='forbidden-restore'")).rows.length, 0);
        assert.equal((await db.query("SELECT * FROM bid_tags WHERE tag='forbidden-restore'")).rows.length, 0);
      }
      await db.query('DELETE FROM bids WHERE id=$1', [longId]);
      assert.equal((await db.query('SELECT * FROM bid_tags WHERE bid_id=$1', [longId])).rows.length, 0);
      assert.equal((await db.query('SELECT * FROM mcp_private.outlook_message_links')).rows.length, 0);
      // No new FK is introduced for the existing soft contract reference.
      assert.equal((await db.query('SELECT source_bid_id FROM contracts')).rows[0].source_bid_id, longId);
    } finally { await db.close(); }
  });
}

test('should roll back policy removal when an unexpected view blocks the type change', async () => {
  const db = await fixture(false, true);
  try {
    await db.exec('CREATE VIEW unexpected_bid_dependency AS SELECT id FROM bids');
    const before = (await db.query(snapshotSql)).rows[0].state;
    await assert.rejects(db.exec(migration), { code: '0A000' });
    assert.deepEqual((await db.query(snapshotSql)).rows[0].state, before);
    assert.equal((await db.query(`SELECT format_type(atttypid,atttypmod) AS type FROM pg_attribute
      WHERE attrelid='bids'::regclass AND attname='id'`)).rows[0].type, 'character varying(36)');
  } finally { await db.close(); }
});

test('should accept a long ID through the existing pipeline import RPC', async () => {
  const db = await fixture(false, false);
  try {
    await db.exec(`CREATE ROLE service_role;
      ALTER TABLE bids ADD demand_category_id text;
      ALTER TABLE bids ADD company_name text;
      ALTER TABLE bids ADD contact_person text;
      ALTER TABLE bids ADD email text;
      ALTER TABLE bids ADD phone text;
      ALTER TABLE bids ADD tags text[];
      INSERT INTO subcontractors(id,company_name) VALUES ('supplier','Supplier');`);
    await db.exec(read('20260907093847_idempotent_pipeline_supplier.sql'));
    const payload = JSON.stringify([{ id: longId, demand_category_id: 'own-category', subcontractor_id: 'supplier' }]);
    await assert.rejects(db.query('SELECT id FROM insert_pipeline_bids($1)', [payload]), { code: '22001' });
    await db.exec(migration);
    assert.deepEqual((await db.query('SELECT id FROM insert_pipeline_bids($1)', [payload])).rows, [{ id: longId }]);
    assert.deepEqual((await db.query('SELECT id FROM insert_pipeline_bids($1)', [payload])).rows, []);
  } finally { await db.close(); }
});
