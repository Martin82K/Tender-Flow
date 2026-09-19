// Usage: node supabase/tests/org-signup-domain-concurrency.cjs <isolated-container>
// This test is deliberately restricted to a local Docker container and synthetic users.
const { spawnSync, spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const container = process.argv[2];
if (!container || !/^[a-zA-Z0-9_-]+$/.test(container)) throw Error('Provide an isolated local test container');
const docker = process.env.DOCKER_BIN || 'docker';
const args = ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq'];
const sql = query => {
  const result = spawnSync(docker, args, { input: query, encoding: 'utf8' });
  if (result.status) throw Error(result.stderr);
  return result.stdout.trim();
};
const firstId = randomUUID(), secondId = randomUUID();
const domain = `race-${randomUUID()}.invalid`;
const run = (query, onData) => new Promise((resolve, reject) => {
  const child = spawn(docker, args); let output = '', error = '';
  child.stdout.on('data', chunk => { output += chunk; onData?.(output); });
  child.stderr.on('data', chunk => { error += chunk; });
  child.on('error', reject);
  child.on('exit', code => code ? reject(Error(error)) : resolve(output));
  child.stdin.end(query);
});
(async () => {
  try {
    sql(`INSERT INTO auth.users(id,email) VALUES('${firstId}','first@${domain}'),('${secondId}','second@${domain}');`);
    let second;
    const first = run(`BEGIN; UPDATE auth.users SET email_confirmed_at=now() WHERE id='${firstId}'; SELECT 'provisioned'; SELECT pg_sleep(1.5); COMMIT;`, output => {
      if (!second && output.includes('provisioned')) second = run(`UPDATE auth.users SET email_confirmed_at=now() WHERE id='${secondId}';`);
    });
    await first;
    if (!second) throw Error('Second confirmation did not start');
    await second;
    const count = sql(`SELECT count(*) FROM public.organizations WHERE '${domain}'=ANY(domain_whitelist);`);
    if (count !== '1') throw Error(`Concurrent confirmations created ${count} organizations instead of one`);
    const memberships = sql(`SELECT count(*) FROM public.organization_members WHERE user_id IN('${firstId}','${secondId}');`);
    if (memberships !== '2') throw Error('Both confirmed users must have membership');
    console.log('PASS: simultaneous first confirmations share one organization');
  } finally {
    sql(`DELETE FROM public.organizations WHERE owner_user_id IN('${firstId}','${secondId}'); DELETE FROM auth.users WHERE id IN('${firstId}','${secondId}');`);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
