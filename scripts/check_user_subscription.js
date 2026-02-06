
import { createClient } from '@supabase/supabase-js';

// From the project .env
const SUPABASE_URL = 'https://vpvowigatikngnaflkyk.supabase.co';
// Using service role key from environment or fallback to the one in .env.local
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
    console.log('Usage: SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/check_user_subscription.js');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkUserSubscription(email) {
    console.log(`\n=== Checking subscription for: ${email} ===\n`);

    // 1. Get user from auth.users
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) {
        console.error('Error getting users:', userError);
        return;
    }

    const user = users.users.find(u => u.email === email);
    if (!user) {
        console.log(`User with email ${email} NOT FOUND in auth.users`);
        return;
    }

    console.log('1. AUTH.USERS:');
    console.log(`   - ID: ${user.id}`);
    console.log(`   - Email: ${user.email}`);
    console.log(`   - Created: ${user.created_at}`);
    console.log(`   - Last Sign In: ${user.last_sign_in_at}`);

    // 2. Get user_profiles
    const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

    console.log('\n2. USER_PROFILES:');
    if (profileError) {
        console.log(`   - ERROR: ${profileError.message}`);
        console.log(`   - CRITICAL: No user_profiles row exists for this user!`);
    } else if (!profile) {
        console.log('   - NO PROFILE FOUND');
    } else {
        console.log(`   - subscription_tier_override: ${profile.subscription_tier_override || 'NULL'}`);
        console.log(`   - stripe_subscription_tier: ${profile.stripe_subscription_tier || 'NULL'}`);
        console.log(`   - subscription_status: ${profile.subscription_status || 'NULL'}`);
        console.log(`   - subscription_expires_at: ${profile.subscription_expires_at || 'NULL'}`);
        console.log(`   - trial_ends_at: ${profile.trial_ends_at || 'NULL'}`);
        console.log(`   - billing_customer_id: ${profile.billing_customer_id || 'NULL'}`);
    }

    // 3. Check organization membership
    const { data: orgMembership, error: orgError } = await supabase
        .from('organization_members')
        .select('organization_id, organizations(name, subscription_tier)')
        .eq('user_id', user.id);

    console.log('\n3. ORGANIZATION MEMBERSHIP:');
    if (orgError) {
        console.log(`   - ERROR: ${orgError.message}`);
    } else if (!orgMembership || orgMembership.length === 0) {
        console.log('   - No organization membership');
    } else {
        orgMembership.forEach((m, i) => {
            console.log(`   - Org ${i + 1}: ${m.organizations?.name || 'Unknown'} (tier: ${m.organizations?.subscription_tier || 'NULL'})`);
        });
    }

    // 4. Test get_user_subscription_tier RPC for this user
    const { data: tier, error: tierError } = await supabase.rpc('get_user_subscription_tier', {
        target_user_id: user.id
    });

    console.log('\n4. RPC get_user_subscription_tier RESULT:');
    if (tierError) {
        console.log(`   - ERROR: ${tierError.message}`);
    } else {
        console.log(`   - Effective tier: ${tier}`);
    }

    console.log('\n=== END OF CHECK ===\n');
}

const targetEmail = process.argv[2] || 'kalkus@baustav.cz';
checkUserSubscription(targetEmail);
