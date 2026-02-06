import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fetchUserIds() {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id');

  if (error) throw error;
  return (data || []).map((row) => row.user_id);
}

async function checkFeature(userId, featureKey) {
  const { data, error } = await supabase.rpc('user_id_has_feature', {
    target_user_id: userId,
    feature_key: featureKey,
  });
  if (error) throw error;
  return data;
}

async function getEffectiveTier(userId) {
  const { data, error } = await supabase.rpc('get_user_subscription_tier', {
    target_user_id: userId,
  });
  if (error) throw error;
  return data;
}

async function getExpectedFeatureEnabled(tier, featureKey) {
  const { data, error } = await supabase
    .from('subscription_tier_features')
    .select('enabled')
    .eq('tier', tier)
    .eq('feature_key', featureKey)
    .maybeSingle();

  if (error) throw error;
  return data?.enabled ?? false;
}

async function main() {
  const featureKey = 'dynamic_templates';
  const userIds = await fetchUserIds();

  const mismatches = [];
  for (const userId of userIds) {
    const [tier, hasFeature] = await Promise.all([
      getEffectiveTier(userId),
      checkFeature(userId, featureKey),
    ]);
    const expected = await getExpectedFeatureEnabled(tier, featureKey);

    if (hasFeature !== expected) {
      mismatches.push({ userId, tier, hasFeature, expected });
    }
  }

  if (mismatches.length === 0) {
    console.log('OK: No mismatches found for feature:', featureKey);
    return;
  }

  console.log('MISMATCHES:', mismatches.length);
  for (const row of mismatches) {
    console.log(
      `user_id=${row.userId} tier=${row.tier} expected=${row.expected} actual=${row.hasFeature}`
    );
  }
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
