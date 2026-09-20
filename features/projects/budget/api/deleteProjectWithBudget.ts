import { dbAdapter } from '@infra/db/dbAdapter';

/** The durable server job locks budget writes and makes retries safe after Storage failure. */
export async function deleteProjectWithBudget(projectId: string): Promise<void> {
  const { data, error } = await dbAdapter.rpc<{ id: string; completed: boolean; paths: string[] }>('construction_budget_project_delete_start', { project_input: projectId });
  if (error) throw error;
  if (!data) throw new Error('Mazání projektu se nepodařilo zahájit.');
  if (data.completed) return;
  for (let offset = 0; offset < data.paths.length; offset += 100) {
    const result = await dbAdapter.storage.from('construction-budgets').remove(data.paths.slice(offset, offset + 100));
    if (result.error) throw new Error('Soubory rozpočtu se nepodařilo odstranit. Opakujte mazání projektu.');
  }
  const result = await dbAdapter.rpc('construction_budget_project_delete_finish', { project_input: projectId, job_input: data.id });
  if (result.error) throw result.error;
}
