import { beforeEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
const mocks = vi.hoisted(() => ({ download: vi.fn(), upload: vi.fn() }));
vi.mock('@infra/db/dbAdapter', () => ({ dbAdapter: { storage: { from: () => mocks } } }));
import { attachBudgetBackupFiles, validateBudgetBackupFiles, restoreBudgetBackupFiles } from '@features/backup/api/budgetBackupFiles';
import type { BackupManifest } from '@features/backup/model/backupTypes';
const id = '12345678-1234-1234-1234-123456789012';
const hash = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const manifest = { organization_id: 'org', construction_budgets: [{ payload: JSON.stringify({ organization_id: 'org', sources: [{ id, storage_path: `org/${id}/source.xlsx`, sha256: hash, file_present: true }] }), signature: 'signed-by-server' }] } as BackupManifest;
const blob = { size: 3, arrayBuffer: async () => new TextEncoder().encode('abc').buffer };
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal('crypto', webcrypto); mocks.download.mockResolvedValue({ data: blob, error: null }); mocks.upload.mockResolvedValue({ error: null }); });
it('includes source bytes and preserves the signed payload unchanged', async () => {
  const result = await attachBudgetBackupFiles(manifest);
  expect(result.construction_budget_files).toEqual({ [id]: 'YWJj' });
  expect(result.construction_budgets).toEqual(manifest.construction_budgets);
  await expect(validateBudgetBackupFiles(result)).resolves.toBeUndefined();
});
it('rejects a missing or corrupt source before database restore', async () => {
  await expect(validateBudgetBackupFiles(manifest)).rejects.toThrow('poškozený');
  await expect(validateBudgetBackupFiles({ ...manifest, construction_budget_files: { [id]: 'YWJk' } })).rejects.toThrow('poškozený');
});
it('never reports a complete export after a failed file download', async () => {
  mocks.download.mockResolvedValue({ data: null, error: { message: 'offline' } });
  await expect(attachBudgetBackupFiles(manifest)).rejects.toThrow('nebyla dokončena');
});
it('does not overwrite an existing immutable original and supports retry', async () => {
  const complete = { ...manifest, construction_budget_files: { [id]: 'YWJj' } };
  await restoreBudgetBackupFiles(complete);
  expect(mocks.upload).not.toHaveBeenCalled();
  mocks.download.mockResolvedValue({ data: null, error: { message: 'missing' } });
  mocks.upload.mockResolvedValueOnce({ error: { message: 'offline' } });
  await expect(restoreBudgetBackupFiles(complete)).rejects.toThrow('Opakujte obnovu');
  await expect(restoreBudgetBackupFiles(complete)).resolves.toBeUndefined();
  expect(mocks.upload).toHaveBeenLastCalledWith(`org/${id}/source.xlsx`, new Uint8Array([97,98,99]), expect.objectContaining({ upsert: false }));
});
it('rejects paths outside the signed source identity before touching Storage', async () => {
  const malicious = { ...manifest, construction_budgets: [{ payload: JSON.stringify({ organization_id: 'org', sources: [{ id, storage_path: '../foreign', sha256: hash, file_present: true }] }), signature: '' }] };
  await expect(attachBudgetBackupFiles(malicious)).rejects.toThrow('Neplatný zdroj');
  expect(mocks.download).not.toHaveBeenCalled();
});
