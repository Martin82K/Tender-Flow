
import { createClient } from '@supabase/supabase-js';

// Hardcoded from .env output
const SUPABASE_URL = 'https://vpvowigatikngnaflkyk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdm93aWdhdGlrbmduYWZsa3lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MjEwNDIsImV4cCI6MjA3OTk5NzA0Mn0.cHop7cftChzb_PgNUbeD4cxqWQAavfwZ6qU4A0DGV3U';

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
