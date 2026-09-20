import { budgetApi } from './budgetApi';
import { tenderNameKey } from '../model/tenderImport';
import type { ProjectTender } from '../model/tenderImport';

/** Read current catalog before append; its RPC rejects concurrent replacements. */
export async function createBudgetTender(projectId: string, name: string): Promise<{ tender: ProjectTender; warning?: string }> {
  const title = name.trim().replace(/\s+/g, ' ');
  if (!title || title.length > 255) throw new Error('Název VŘ musí mít 1 až 255 znaků.');
  const current = await budgetApi.projectTenders(projectId);
  const existing = current.find(t => tenderNameKey(t.title) === tenderNameKey(title));
  // Reusing an existing name makes a retry after a lost response safe.
  if (existing) return { tender: existing };
  const tender = { id: crypto.randomUUID(), title, externalCode: '' };
  const warning = await budgetApi.saveProjectTenders(projectId, current, [...current, tender]);
  return { tender, warning };
}
