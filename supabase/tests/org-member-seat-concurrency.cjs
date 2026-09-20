// Usage: node supabase/tests/org-member-seat-concurrency.cjs <isolated-container>
// Local Docker only, synthetic accounts, no production database connection.
const { spawnSync, spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const container = process.argv[2];
if (!container || !/^[a-zA-Z0-9_-]+$/.test(container)) throw Error('Provide an isolated local test container');
const docker = process.env.DOCKER_BIN || 'docker';
const args = ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq'];
const sql = query => {
  const result = spawnSync(docker, args, { input: query, encoding: 'utf8', timeout: 15000 });
  if (result.error || result.status) throw Error(result.error?.message || result.stderr);
  return result.stdout.trim();
};
const run = (query, onData) => new Promise((resolve, reject) => {
  const child = spawn(docker, args); let output = '', error = '';
  child.stdout.on('data', chunk => { output += chunk; onData?.(output); });
  child.stderr.on('data', chunk => { error += chunk; });
  child.on('error', reject);
  child.on('close', code => resolve({ code, output, error }));
  child.stdin.end(query);
});
const owner = randomUUID(), firstUser = randomUUID(), secondUser = randomUUID(), org = randomUUID();
const auth = `SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"${owner}"}',true);`;
(async () => {
  try {
    sql(`INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
      ('${owner}','${owner}@gmail.com',now()),('${firstUser}','${firstUser}@gmail.com',now()),('${secondUser}','${secondUser}@gmail.com',now());
      INSERT INTO public.organizations(id,name,type,subscription_tier,subscription_status,max_seats)
      VALUES('${org}','Seat race fixture','business','enterprise','trial',2);
      INSERT INTO public.organization_members(organization_id,user_id,role) VALUES('${org}','${owner}','owner');`);
    sql(`INSERT INTO public.platform_admins(user_id,grant_source) VALUES('${owner}','manual_grant');`);
    for (const mode of ['uuid', 'email', 'activation', 'duplicate', 'replace_email', 'replace_approval', 'admin_limit']) {
      sql(`DELETE FROM public.organization_members WHERE organization_id='${org}' AND user_id <> '${owner}';`);
      if (mode === 'activation') sql(`INSERT INTO public.organization_members(organization_id,user_id,role,is_active,is_billable) VALUES('${org}','${secondUser}','member',true,false);`);
      const replacing = mode.startsWith('replace_');
      if (replacing) sql(`INSERT INTO public.organization_members(organization_id,user_id,role) VALUES('${org}','${secondUser}','member');`);
      const request = randomUUID();
      if (mode === 'replace_approval') sql(`INSERT INTO public.organization_join_requests(id,organization_id,user_id,email) VALUES('${request}','${org}','${secondUser}','${secondUser}@gmail.com');`);
      let second;
      const contender = mode === 'admin_limit'
        ? `public.admin_update_org_subscription(target_org_id=>'${org}',new_max_seats=>1)`
        : mode === 'replace_approval'
        ? `public.approve_org_join_request('${request}')`
        : mode === 'activation'
        ? `public.activate_org_member('${org}','${secondUser}')`
        : (mode === 'email' || mode === 'replace_email')
          ? `public.add_org_member_by_email('${org}','${secondUser}@gmail.com')`
          : `public.add_org_member('${org}','${mode === 'duplicate' ? firstUser : secondUser}')`;
      const first = run(`BEGIN; SET LOCAL statement_timeout='10s'; ${auth}
        ${replacing ? `SELECT public.remove_org_member('${org}','${secondUser}');` : ''}
        SELECT public.add_org_member('${org}','${firstUser}'); SELECT 'reserved'; SELECT pg_sleep(2); COMMIT;`, output => {
        if (!second && output.includes('reserved')) second = run(`BEGIN; SET LOCAL statement_timeout='10s'; SET LOCAL application_name='seat-race-${org}'; ${auth} SELECT ${contender}; COMMIT;`);
      });
      // Confirm the competing RPC really waits for the organization lock.
      let waited = false;
      for (let attempt = 0; attempt < 35; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 50));
        if (second && sql(`SELECT count(*) FROM pg_stat_activity WHERE application_name='seat-race-${org}' AND wait_event_type='Lock';`) === '1') { waited = true; break; }
      }
      const firstResult = await first;
      assert.equal(firstResult.code, 0, firstResult.error);
      assert.ok(second, 'Competing RPC must start');
      const secondResult = await second;
      assert.ok(waited, `${mode}: competing reservation must wait on a database lock`);
      if (mode === 'duplicate') assert.equal(secondResult.code, 0, secondResult.error);
      else {
        assert.notEqual(secondResult.code, 0, 'Competing seat must be rejected');
        assert.match(secondResult.error, mode === 'admin_limit' ? /Cannot reduce seats below/ : /Seat limit reached/);
      }
      assert.equal(sql(`SELECT count(*) FROM public.organization_members WHERE organization_id='${org}' AND is_active AND is_billable;`), '2');
      sql(`DELETE FROM public.organization_join_requests WHERE id='${request}';`);
      console.log(`PASS: UUID add vs ${mode} waits, preserves capacity and duplicate semantics`);
    }
  } finally {
    sql(`DELETE FROM public.organizations WHERE id='${org}' OR owner_user_id IN('${owner}','${firstUser}','${secondUser}'); DELETE FROM auth.users WHERE id IN('${owner}','${firstUser}','${secondUser}');`);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
