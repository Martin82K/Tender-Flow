/**
 * Contact Status Service
 * Manages contact statuses in the database
 * Only admins can modify statuses, everyone can read
 */

import { supabase } from './supabase';
import { StatusConfig } from '../types';

/**
 * Load all contact statuses from database
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
 * Add a new contact status (admin only)
 */
export async function addContactStatus(status: StatusConfig): Promise<boolean> {
    // Get max sort_order
    const { data: maxData } = await supabase
        .from('subcontractor_statuses')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1);

    const maxOrder = maxData?.[0]?.sort_order || 0;

    const { error } = await supabase.from('subcontractor_statuses').insert({
        id: status.id,
        label: status.label,
        color: status.color,
        sort_order: maxOrder + 1,
    });

    if (error) {
        console.error('Error adding contact status:', error);
        return false;
    }

    return true;
}

/**
 * Update an existing contact status (admin only)
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
 * Delete a contact status (admin only)
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
