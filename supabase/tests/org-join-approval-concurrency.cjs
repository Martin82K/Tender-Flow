// Usage: node supabase/tests/org-join-approval-concurrency.cjs <isolated-container> [database]
// Synthetic fixtures only, local Docker; never connects to a production database.
const { spawnSync, spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const container = process.argv[2], database = process.argv[3] || 'postgres';
if (!container || ![container, database].every(v => /^[a-zA-Z0-9_-]+$/.test(v))) throw Error('Provide an isolated local container/database');
const args = ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-Atq'];
const sql = query => {
  const r = spawnSync('docker', args, { input: query, encoding: 'utf8', timeout: 15000 });
  if (r.error || r.status) throw Error(r.error?.message || r.stderr);
  return r.stdout.trim();
};
const run = (query, onData) => new Promise((resolve, reject) => {
  const child = spawn('docker', args); let output = '', error = '';
  child.stdout.on('data', chunk => { output += chunk; onData?.(output); });
  child.stderr.on('data', chunk => { error += chunk; });
  child.on('error', reject);
  child.on('close', code => resolve({ code, output, error }));
  child.stdin.end(query);
});
(async () => {
  for (const mode of (process.env.APPROVAL_RACE_MODE ? [process.env.APPROVAL_RACE_MODE] : ['email_first', 'revoke_first', 'registry_delete_first', 'approval_first_email', 'approval_first_revoke', 'direct_vs_auth', 'direct_vs_domain', 'manual_add_first'])) {
    const owner = randomUUID(), user = randomUUID(), org = randomUUID(), domain = `approval-${randomUUID()}.invalid`;
    try {
      sql(`INSERT INTO auth.users(id,email,email_confirmed_at) VALUES('${owner}','${owner}@gmail.com',now()),('${user}','${user}@gmail.com',now());
        INSERT INTO public.organizations(id,name,type,subscription_tier,subscription_status,max_seats) VALUES('${org}','Approval race','business','enterprise','active',1);
        INSERT INTO public.organization_members(organization_id,user_id,role) VALUES('${org}','${owner}','owner');
        INSERT INTO private.verified_organization_domains(domain,organization_id,evidence) VALUES('${domain}','${org}','Synthetic DNS verification');
        UPDATE auth.users SET email='candidate@${domain}' WHERE id='${user}';
        UPDATE public.organizations SET max_seats=2 WHERE id='${org}';`);
      const request = sql(`SELECT id FROM public.organization_join_requests WHERE organization_id='${org}' AND user_id='${user}';`);
      assert.match(request, /^[a-f0-9-]{36}$/);
      const auth = `SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"${owner}"}',true);`;
      const approve = `${auth} SELECT public.approve_org_join_request('${request}');`;
      const email = `UPDATE auth.users SET email='outside-${user}@gmail.com' WHERE id='${user}';`;
      const revoke = `SELECT set_config('request.jwt.claims','{"role":"service_role"}',true); SELECT public.admin_set_verified_org_domain('${org}','${domain}',NULL,false);`;
      const direct = `${auth} UPDATE public.organization_join_requests SET status='approved' WHERE id='${request}';`;
      const firstQuery = mode === 'manual_add_first' ? `SELECT id FROM public.organizations WHERE id='${org}' FOR UPDATE; ${auth}` : mode.startsWith('approval_first') ? approve
        : mode === 'email_first' ? email
        : mode === 'revoke_first' ? revoke
        : mode === 'registry_delete_first' ? `DELETE FROM private.verified_organization_domains WHERE domain='${domain}';`
        : mode === 'direct_vs_auth' ? `SELECT id FROM auth.users WHERE id='${user}' FOR UPDATE;`
        : `SELECT pg_advisory_xact_lock(hashtextextended('tenderflow.org-domain:${domain}',0));`;
      const secondQuery = mode === 'approval_first_email' ? email : mode === 'approval_first_revoke' ? revoke
        : mode.startsWith('direct_') ? direct : approve;
      let second;
      const first = run(`BEGIN; SET LOCAL statement_timeout='8s'; ${firstQuery} SELECT 'locked'; SELECT pg_sleep(2); ${mode === 'manual_add_first' ? `SELECT public.add_org_member('${org}','${user}');` : ''} COMMIT;`, output => {
        if (!second && output.includes('locked')) second = run(`BEGIN; SET LOCAL statement_timeout='8s'; SET LOCAL application_name='approval-race-${org}'; ${secondQuery} COMMIT;`);
      });
      const nonblocking = mode.startsWith('direct_') || mode === 'registry_delete_first';
      let waited = false;
      if (!nonblocking) for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 50));
        if (second && sql(`SELECT count(*) FROM pg_stat_activity WHERE application_name='approval-race-${org}' AND wait_event_type='Lock';`) === '1') { waited = true; break; }
      }
      const a = await first;
      assert.equal(a.code, 0, a.error);
      assert.ok(second, 'Contending transaction must start');
      const b = await second;
      assert.doesNotMatch(b.error, /deadlock|statement timeout/i);
      if (mode.startsWith('approval_first') || mode === 'manual_add_first') {
        assert.equal(b.code, 0, b.error);
        assert.equal(sql(`SELECT count(*) FROM public.organization_members WHERE organization_id='${org}' AND user_id='${user}';`), '1');
      } else {
        assert.notEqual(b.code, 0, 'Stale or conflicting approval must not succeed');
        assert.match(b.error, nonblocking ? /could not obtain lock|retry approval/ : /no longer verified/);
        assert.equal(sql(`SELECT status FROM public.organization_join_requests WHERE id='${request}';`), 'pending');
        assert.equal(sql(`SELECT count(*) FROM public.organization_members WHERE organization_id='${org}' AND user_id='${user}';`), '0');
      }
      if (!nonblocking) assert.ok(waited, 'Expected serialization must acquire a real database lock');
      console.log(`PASS: ${mode} preserves approval identity without deadlock`);
    } finally {
      sql(`DELETE FROM public.organizations WHERE id='${org}' OR owner_user_id IN('${owner}','${user}'); DELETE FROM auth.users WHERE id IN('${owner}','${user}');`);
    }
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
