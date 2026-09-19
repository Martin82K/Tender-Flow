import { dbAdapter as supabase } from '@infra/db/dbAdapter';
import type { BudgetAllocation, BudgetCatalogEntry, BudgetDocument, BudgetRevision, BudgetSource } from '../model/types';
export interface BudgetPermissions { read: boolean; prices: boolean; edit: boolean; confirm: boolean; allocate: boolean; purge?: boolean }
export type BudgetRevisionSummary = Pick<BudgetRevision, 'id' | 'title' | 'status' | 'version' | 'source_id' | 'created_at' | 'deleted_at' | 'purge_job_id'> & { allocation_count?: number; category_ids?: string[] };
export interface BudgetPurgeJob { id: string; revisionCount: number; sourceCount: number }
export interface BudgetPurgeSelection { revisions: Array<{ id: string; version: number }>; sources: Array<{ id: string; deleted_at: string }> }
export interface BudgetIndex { permissions: BudgetPermissions; revisions: BudgetRevisionSummary[]; purgeJobs?: BudgetPurgeJob[] }
const unwrap = <T>(result: { data: unknown; error: { message: string } | null }): T => { if (result.error) throw new Error(result.error.message); return result.data as T; };
export const budgetApi = {
  async purge(projectId: string, jobId: string, selection: BudgetPurgeSelection): Promise<void> {
    const job = unwrap<BudgetPurgeJob & { paths: string[]; completed: boolean }>(await supabase.rpc('construction_budget_purge_start', {
      project_input: projectId, job_input: jobId, revisions_input: selection.revisions, sources_input: selection.sources,
    }));
    if (job.completed) return;
    // Storage must remove the object bytes. Never delete storage.objects via SQL.
    // Server-side locks and this durable job make retries safe after any failure.
    for (let i = 0; i < job.paths.length; i += 100) {
      const result = await supabase.storage.from('construction-budgets').remove(job.paths.slice(i, i + 100));
      if (result.error) throw new Error('Soubor se nepodařilo odstranit. Mazání je rozpracované; použijte Dokončit mazání v koši.');
    }
    unwrap(await supabase.rpc('construction_budget_purge_finish', { project_input: projectId, job_input: jobId }));
  },
  async trash(projectId: string, targetId: string, kind: 'revision' | 'source', restore: boolean, version?: number): Promise<void> {
    unwrap(await supabase.rpc('construction_budget_trash', { project_input: projectId, target_input: targetId, kind_input: kind, restore_input: restore, version_input: version ?? null }));
  },
  async index(projectId: string): Promise<BudgetIndex> { return unwrap(await supabase.rpc('construction_budget_load', { project_input: projectId })); },
  async revision(projectId: string, revisionId: string): Promise<BudgetRevision> { return unwrap(await supabase.rpc('construction_budget_load', { project_input: projectId, revision_input: revisionId })); },
  async sources(projectId: string): Promise<BudgetSource[]> { return unwrap(await supabase.from('construction_budget_sources').select('*').eq('project_id', projectId).order('created_at', { ascending: false })); },
  async catalog(organizationId: string): Promise<BudgetCatalogEntry[]> { return unwrap(await supabase.from('construction_budget_catalog').select('*').eq('organization_id', organizationId).order('name')); },
  async canManageCatalog(organizationId: string): Promise<boolean> { return unwrap(await supabase.rpc('is_active_org_admin_or_owner', { org_id: organizationId })); },
  async saveCatalog(entry: Omit<BudgetCatalogEntry, 'id'> & { id?: string }): Promise<void> {
    if (entry.id) unwrap(await supabase.from('construction_budget_catalog').update({ name: entry.name, color: entry.color, archived: entry.archived }).eq('id', entry.id).eq('organization_id', entry.organization_id).select('id').single());
    else unwrap(await supabase.from('construction_budget_catalog').insert(entry));
  },
  async registerSource(projectId: string, file: File): Promise<BudgetSource> {
    if (!/\.xlsx$/i.test(file.name) || file.size > 30 * 1024 * 1024) throw new Error('Vyberte XLSX do 30 MB.');
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    const source = unwrap<BudgetSource>(await supabase.rpc('construction_budget_source', { project_input: projectId, filename_input: file.name, hash_input: hash }));
    // No upsert: original files are immutable. A duplicate import reuses the registered source.
    const existing = await supabase.storage.from('construction-budgets').info(source.storage_path);
    if (existing.error) {
      const upload = await supabase.storage.from('construction-budgets').upload(source.storage_path, file, { upsert: false, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      if (upload.error) throw new Error(upload.error.message);
    }
    return source;
  },
  async sourceStatus(source: BudgetSource, status: BudgetSource['status']): Promise<void> {
    unwrap(await supabase.rpc('construction_budget_source', { project_input: source.project_id, filename_input: source.filename, hash_input: source.sha256, status_input: status }));
  },
  async download(source: BudgetSource): Promise<Blob> { return unwrap(await supabase.storage.from('construction-budgets').download(source.storage_path)); },
  async save(args: { projectId: string; sourceId: string; revision?: BudgetRevision; title: string; document: BudgetDocument; allocations: BudgetAllocation[]; confirm?: boolean }): Promise<BudgetRevision> {
    return unwrap(await supabase.rpc('construction_budget_save', { project_input: args.projectId, source_input: args.sourceId, revision_input: args.revision?.id ?? null, version_input: args.revision?.version ?? 0, title_input: args.title, document_input: args.document, allocations_input: args.allocations, confirm_input: args.confirm ?? false }));
  },
  async applyPlan(projectId:string,revisionId:string,categoryId:string,expectedPlan:number):Promise<string> {
    return String(unwrap(await supabase.rpc('construction_budget_apply_plan',{project_input:projectId,revision_input:revisionId,category_input:categoryId,expected_plan:expectedPlan})));
  },
  async history(projectId: string, revisionId: string): Promise<Array<{ id: number; event: string; created_at: string; previous_version: number | null; new_version: number }>> {
    return unwrap(await supabase.from('construction_budget_history').select('id,event,created_at,previous_version,new_version').eq('project_id', projectId).eq('revision_id', revisionId).order('id', { ascending: false }));
  },
};
