import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('@infra/db/dbAdapter', () => ({ dbAdapter: mocks }));
vi.mock('@features/organization', () => ({ organizationService: {} }));
import { contractDocumentsApi } from '@features/projects/contracts/documents/api';

beforeEach(() => vi.clearAllMocks());
describe('document CRUD API', () => {
  it('deletes only the selected contract document at its expected version', async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    await contractDocumentsApi.remove('contract', 'document', 3);
    expect(mocks.rpc).toHaveBeenCalledWith('delete_contract_document', { contract_id_input: 'contract', document_id_input: 'document', expected_version: 3 });
  });
  it('preserves version conflicts instead of reporting deletion success', async () => {
    mocks.rpc.mockResolvedValue({ error: { code: '40001', message: 'Dokument má novější verzi.' } });
    await expect(contractDocumentsApi.remove('contract', 'document', 3)).rejects.toThrow('Dokument má novější verzi.');
  });
  it('excludes logically deleted records in both project and contract lists', async () => {
    const query = { select: vi.fn(), is: vi.fn(), in: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn() };
    for (const method of [query.select, query.is, query.in, query.eq, query.order]) method.mockReturnValue(query);
    query.range.mockResolvedValue({ data: [], error: null }); mocks.from.mockReturnValue(query);
    expect(await contractDocumentsApi.projectVersions(['contract'])).toEqual([]);
    expect(query.is).toHaveBeenCalledWith('deleted_at', null);
    query.is.mockClear(); query.order.mockResolvedValue({ data: [], error: null });
    expect(await contractDocumentsApi.list('contract')).toEqual([]);
    expect(query.is).toHaveBeenCalledWith('deleted_at', null);
  });
});
