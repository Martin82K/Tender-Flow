export type BudgetNodeKind = 'object' | 'sheet' | 'section' | 'K' | 'M' | 'VV' | 'note' | 'subtotal';
export interface SourceCell { value: string | number | boolean | null; formula?: string }
export interface BudgetNode {
  id: string; parentId: string | null; sheetId: string; kind: BudgetNodeKind; order: number;
  code: string; description: string; unit: string; quantity: string | null; unitPrice: string | null; total: string | null;
  source: { sheet: string; row: number; cells: Record<string, SourceCell> };
  sourceType: string; tags: string[]; tenders: string[];
  [key: string]: unknown;
}
export interface BudgetSheet { id: string; name: string; role: 'items' | 'figures' | 'summary' | 'instructions' | 'unknown'; object: string; title: string; headerRow: number; columns?: Record<string, number>; selected: boolean }
export interface ImportIssue { sheet: string; row: number; severity: 'warning' | 'error'; message: string; kind?: 'ambiguous-figures'; figures?: Array<{ code: string; values: string[] }> }
export interface BudgetDocument { schemaVersion: 1; origin?: 'import' | 'copy'; importKey?: string; sheets: BudgetSheet[]; nodes: BudgetNode[]; issues: ImportIssue[]; figures: Record<string, string> }
export interface BudgetAllocation { itemId: string; categoryId: string; quantity: string }
export interface BudgetRevision { id: string; project_id: string; organization_id: string; source_id: string; title: string; status: 'draft' | 'confirmed'; version: number; created_at: string; document: BudgetDocument; allocations: BudgetAllocation[]; deleted_at?: string | null; purge_job_id?: string | null }
export interface BudgetSource { id: string; project_id: string; filename: string; storage_path: string; sha256: string; status: 'attachment' | 'processing' | 'ready' | 'failed' | 'cancelled'; first_converted_at?: string | null; last_converted_at?: string | null; created_at: string; deleted_at?: string | null; purge_job_id?: string | null }
export interface BudgetCatalogEntry { id: string; organization_id: string; kind: 'tag' | 'profession' | 'unit' | 'type'; name: string; color: string; archived: boolean }
export const isPriced = (node: BudgetNode) => node.kind === 'K' || node.kind === 'M';
