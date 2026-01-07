/**
 * Excel Indexer Service
 * Manages index entries (code → description mappings) in the database
 * Per-tenant: entries are filtered by organization_id
 * RLS handles access control
 */

import { supabase } from './supabase';

export interface IndexEntry {
  id: string;
  code: string;
  description: string;
  created_at?: string;
  updated_at?: string;
}

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
 * Load all index entries from database
 * RLS will automatically filter to user's org
 */
export async function loadIndexEntries(): Promise<IndexEntry[]> {
  const { data, error } = await supabase
    .from('excel_indexer_entries')
    .select('*')
    .order('code', { ascending: true });

  if (error) {
    console.error('Error loading index entries:', error);
    return [];
  }

  return (data || []).map((entry) => ({
    id: entry.id,
    code: entry.code,
    description: entry.description,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  }));
}

/**
 * Add a new index entry (per-tenant)
 */
export async function addIndexEntry(entry: { code: string; description: string }): Promise<IndexEntry | null> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) {
    console.error('Error adding index entry: No organization found for user');
    return null;
  }

  const { data, error } = await supabase
    .from('excel_indexer_entries')
    .insert({
      code: entry.code.trim(),
      description: entry.description.trim(),
      organization_id: orgId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding index entry:', error);
    return null;
  }

  return {
    id: data.id,
    code: data.code,
    description: data.description,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * Add multiple index entries at once (for imports)
 */
export async function addIndexEntriesBulk(entries: { code: string; description: string }[]): Promise<number> {
  if (entries.length === 0) return 0;

  const orgId = await getCurrentUserOrgId();
  if (!orgId) {
    console.error('Error adding index entries: No organization found for user');
    return 0;
  }

  const toInsert = entries.map((e) => ({
    code: e.code.trim(),
    description: e.description.trim(),
    organization_id: orgId,
  }));

  const { data, error } = await supabase
    .from('excel_indexer_entries')
    .upsert(toInsert, { onConflict: 'organization_id,code', ignoreDuplicates: false })
    .select();

  if (error) {
    console.error('Error bulk adding index entries:', error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Update an existing index entry
 * RLS ensures user can only update their org's entries
 */
export async function updateIndexEntry(
  id: string,
  updates: { code?: string; description?: string }
): Promise<boolean> {
  const cleanUpdates: Record<string, string> = {};
  if (updates.code !== undefined) cleanUpdates.code = updates.code.trim();
  if (updates.description !== undefined) cleanUpdates.description = updates.description.trim();

  const { error } = await supabase
    .from('excel_indexer_entries')
    .update(cleanUpdates)
    .eq('id', id);

  if (error) {
    console.error('Error updating index entry:', error);
    return false;
  }

  return true;
}

/**
 * Delete an index entry
 * RLS ensures user can only delete their org's entries
 */
export async function deleteIndexEntry(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('excel_indexer_entries')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting index entry:', error);
    return false;
  }

  return true;
}

/**
 * Delete all index entries for the current organization
 */
export async function deleteAllIndexEntries(): Promise<boolean> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) {
    console.error('Error deleting index entries: No organization found for user');
    return false;
  }

  const { error } = await supabase
    .from('excel_indexer_entries')
    .delete()
    .eq('organization_id', orgId);

  if (error) {
    console.error('Error deleting all index entries:', error);
    return false;
  }

  return true;
}
