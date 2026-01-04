/**
 * Contact Status Service
 * Manages contact statuses in the database
 * Per-tenant: statuses are filtered by organization_id
 * RLS handles access control, but we need to provide organization_id for inserts
 */

import { supabase } from './supabase';
import { StatusConfig } from '../types';

/**
 * Get the current user's organization ID
 */
async function getCurrentUserOrgId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

    return data?.organization_id || null;
}

/**
 * Load all contact statuses from database
 * RLS will automatically filter to user's org + global statuses
 */
export async function loadContactStatuses(): Promise<StatusConfig[]> {
    const { data, error } = await supabase
        .from('subcontractor_statuses')
        .select('*')
        .order('sort_order', { ascending: true });

    if (error) {
        console.error('Error loading contact statuses:', error);
        // Return default statuses as fallback
        return [
            { id: 'available', label: 'K dispozici', color: 'green' },
            { id: 'busy', label: 'Zaneprázdněn', color: 'red' },
            { id: 'waiting', label: 'Čeká', color: 'yellow' },
        ];
    }

    return (data || []).map((s) => ({
        id: s.id,
        label: s.label,
        color: s.color as StatusConfig['color'],
    }));
}

/**
 * Add a new contact status (per-tenant)
 * Status will be created for the user's organization
 */
export async function addContactStatus(status: StatusConfig): Promise<boolean> {
    // Get user's organization ID
    const orgId = await getCurrentUserOrgId();
    if (!orgId) {
        console.error('Error adding contact status: No organization found for user');
        return false;
    }

    // Get max sort_order for this org's statuses
    const { data: maxData } = await supabase
        .from('subcontractor_statuses')
        .select('sort_order')
        .eq('organization_id', orgId)
        .order('sort_order', { ascending: false })
        .limit(1);

    const maxOrder = maxData?.[0]?.sort_order || 0;

    // Create unique ID with org prefix to avoid collisions
    const statusId = `${orgId}_${status.id}`;

    const { error } = await supabase.from('subcontractor_statuses').insert({
        id: statusId,
        label: status.label,
        color: status.color,
        sort_order: maxOrder + 1,
        organization_id: orgId,
    });

    if (error) {
        console.error('Error adding contact status:', error);
        return false;
    }

    return true;
}

/**
 * Update an existing contact status
 * RLS ensures user can only update their org's statuses
 */
export async function updateContactStatus(
    id: string,
    updates: Partial<Pick<StatusConfig, 'label' | 'color'>>
): Promise<boolean> {
    const { error } = await supabase
        .from('subcontractor_statuses')
        .update(updates)
        .eq('id', id);

    if (error) {
        console.error('Error updating contact status:', error);
        return false;
    }

    return true;
}

/**
 * Delete a contact status
 * RLS ensures user can only delete their org's statuses
 */
export async function deleteContactStatus(id: string): Promise<boolean> {
    const { error } = await supabase
        .from('subcontractor_statuses')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting contact status:', error);
        return false;
    }

    return true;
}
