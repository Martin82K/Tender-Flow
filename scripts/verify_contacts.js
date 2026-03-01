
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyContacts() {
    console.log('Verifying contacts...');

    // 1. Check for contacts with a specific owner (should be 0 if migration worked)
    const { count: ownedCount, error: ownedError } = await supabase
        .from('subcontractors')
        .select('*', { count: 'exact', head: true })
        .not('owner_id', 'is', null);

    if (ownedError) {
        console.error('Error checking owned contacts:', ownedError);
    } else {
        console.log(`Contacts with specific owner (non-NULL): ${ownedCount}`);
    }

    // 2. Check for contacts with NULL owner (should be ALL contacts if migration worked)
    const { count: publicCount, error: publicError } = await supabase
        .from('subcontractors')
        .select('*', { count: 'exact', head: true })
        .is('owner_id', null);

    if (publicError) {
        console.error('Error checking public contacts:', publicError);
    } else {
        console.log(`Contacts with NULL owner (Organization Shared): ${publicCount}`);
    }

    // 3. Check for contacts NOT in Baustav organization
    // First, we need to know what Baustav ID is, but let's just check for any organization_id IS NULL
    const { count: orphanCount, error: orphanError } = await supabase
        .from('subcontractors')
        .select('*', { count: 'exact', head: true })
        .is('organization_id', null);

    if (orphanError) {
        console.error('Error checking orphan contacts:', orphanError);
    } else {
        console.log(`Contacts with no Organization (Orphans): ${orphanCount}`);
    }
}

verifyContacts();
