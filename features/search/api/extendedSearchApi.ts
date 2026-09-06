import { dbAdapter } from '@infra/db/dbAdapter';
import type { SearchContract, SearchTask } from '@shared/ui/GlobalSearch/types';

const PAGE_SIZE = 500;
const PROJECT_BATCH_SIZE = 100;
interface TaskRow { id: string; title: string; note: string | null; created_by: string }
interface ContractRow { id: string; project_id: string; title: string; contract_number: string | null; vendor_name: string | null }

export const loadSearchTasks = async (userId: string, signal?: AbortSignal): Promise<SearchTask[]> => {
  if (!userId) return [];
  const tasks = new Map<string, SearchTask>();
  for (let start = 0; ; start += PAGE_SIZE) {
    signal?.throwIfAborted();
    const { data, error } = await dbAdapter.from('tasks')
      .select('id,title,note,created_by').eq('created_by', userId)
      .order('id').range(start, start + PAGE_SIZE - 1);
    signal?.throwIfAborted();
    if (error) throw error;
    const rows = (data ?? []) as TaskRow[];
    for (const row of rows) {
      if (row.created_by === userId) tasks.set(row.id, { id: row.id, title: row.title, note: row.note ?? undefined });
    }
    if (rows.length < PAGE_SIZE) return [...tasks.values()];
  }
};

export const loadSearchContracts = async (projectIds: string[], signal?: AbortSignal): Promise<SearchContract[]> => {
  const contracts = new Map<string, SearchContract>();
  const requestedIds = [...new Set(projectIds)].sort();
  for (let offset = 0; offset < requestedIds.length; offset += PROJECT_BATCH_SIZE) {
    const requested = requestedIds.slice(offset, offset + PROJECT_BATCH_SIZE);
    const allowed = new Set<string>();
    // Revalidate project visibility under the current session before fetching any contract metadata.
    for (let start = 0; ; start += PAGE_SIZE) {
      signal?.throwIfAborted();
      const { data, error } = await dbAdapter.from('projects').select('id')
        .in('id', requested).order('id').range(start, start + PAGE_SIZE - 1);
      signal?.throwIfAborted();
      if (error) throw error;
      const rows = (data ?? []) as { id: string }[];
      for (const row of rows) if (requested.includes(row.id)) allowed.add(row.id);
      if (rows.length < PAGE_SIZE) break;
    }
    if (allowed.size === 0) continue;
    for (let start = 0; ; start += PAGE_SIZE) {
      signal?.throwIfAborted();
      const { data, error } = await dbAdapter.from('contracts')
        .select('id,project_id,title,contract_number,vendor_name')
        .in('project_id', [...allowed]).order('id').range(start, start + PAGE_SIZE - 1);
      signal?.throwIfAborted();
      if (error) throw error;
      const rows = (data ?? []) as ContractRow[];
      for (const row of rows) {
        if (!allowed.has(row.project_id)) continue;
        contracts.set(row.id, { id: row.id, projectId: row.project_id, title: row.title,
          contractNumber: row.contract_number ?? undefined, vendorName: row.vendor_name ?? undefined });
      }
      if (rows.length < PAGE_SIZE) break;
    }
  }
  return [...contracts.values()];
};
