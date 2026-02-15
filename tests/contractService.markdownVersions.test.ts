import { beforeEach, describe, expect, it, vi } from 'vitest';
import { contractService } from '../services/contractService';

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  auth: {
    getUser: vi.fn(),
  },
  storage: {
    from: vi.fn(),
  },
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    from: supabaseMocks.from,
    rpc: supabaseMocks.rpc,
    auth: supabaseMocks.auth,
    storage: supabaseMocks.storage,
  },
}));

describe('contractService markdown versions', () => {
  beforeEach(() => {
    supabaseMocks.from.mockReset();
    supabaseMocks.rpc.mockReset();
  });

  it('getMarkdownVersions nacita a mapuje verze pro smlouvu', async () => {
    const row = {
      id: 'v1',
      entity_type: 'contract',
      contract_id: 'c1',
      amendment_id: null,
      project_id: 'p1',
      vendor_id: 'ven1',
      version_no: 2,
      source_kind: 'manual_edit',
      source_file_name: 'smlouva.md',
      source_document_url: null,
      ocr_provider: null,
      ocr_model: null,
      content_md: '# Obsah',
      metadata: { a: 1 },
      created_by: 'u1',
      created_at: '2026-02-15T10:00:00.000Z',
    };

    const orderResult: any = Promise.resolve({ data: [row], error: null });
    orderResult.limit = vi.fn().mockResolvedValue({ data: [row], error: null });

    const order = vi.fn(() => orderResult);
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    supabaseMocks.from.mockReturnValue({ select });

    const versions = await contractService.getMarkdownVersions({
      entityType: 'contract',
      entityId: 'c1',
    });

    expect(supabaseMocks.from).toHaveBeenCalledWith('contract_markdown_versions');
    expect(eq).toHaveBeenCalledWith('contract_id', 'c1');
    expect(order).toHaveBeenCalledWith('version_no', { ascending: false });
    expect(versions[0].versionNo).toBe(2);
    expect(versions[0].contentMd).toBe('# Obsah');
  });

  it('getLatestMarkdownVersion vraci prvni verzi dle DESC poradi', async () => {
    const row = {
      id: 'v2',
      entity_type: 'contract',
      contract_id: 'c1',
      amendment_id: null,
      project_id: 'p1',
      vendor_id: 'ven1',
      version_no: 5,
      source_kind: 'ocr',
      source_file_name: 'scan.pdf',
      source_document_url: null,
      ocr_provider: 'mistral-ocr',
      ocr_model: 'mistral-ocr-latest',
      content_md: '# OCR',
      metadata: {},
      created_by: 'u1',
      created_at: '2026-02-15T10:00:00.000Z',
    };

    const orderResult: any = Promise.resolve({ data: [row], error: null });
    orderResult.limit = vi.fn().mockResolvedValue({ data: [row], error: null });

    const order = vi.fn(() => orderResult);
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    supabaseMocks.from.mockReturnValue({ select });

    const latest = await contractService.getLatestMarkdownVersion({
      entityType: 'contract',
      entityId: 'c1',
    });

    expect(orderResult.limit).toHaveBeenCalledWith(1);
    expect(latest?.id).toBe('v2');
    expect(latest?.versionNo).toBe(5);
  });

  it('createMarkdownVersion vola rpc a vraci namapovany vysledek', async () => {
    const row = {
      id: 'v3',
      entity_type: 'amendment',
      contract_id: null,
      amendment_id: 'a1',
      project_id: 'p1',
      vendor_id: 'ven1',
      version_no: 1,
      source_kind: 'ocr',
      source_file_name: 'dodatek.pdf',
      source_document_url: null,
      ocr_provider: 'mistral-ocr',
      ocr_model: 'mistral-ocr-latest',
      content_md: '# Dodatek',
      metadata: { confidence: 0.9 },
      created_by: 'u1',
      created_at: '2026-02-15T10:00:00.000Z',
    };

    supabaseMocks.rpc.mockResolvedValue({ data: row, error: null });

    const created = await contractService.createMarkdownVersion({
      entityType: 'amendment',
      amendmentId: 'a1',
      sourceKind: 'ocr',
      contentMd: '# Dodatek',
      sourceFileName: 'dodatek.pdf',
      ocrProvider: 'mistral-ocr',
      ocrModel: 'mistral-ocr-latest',
      metadata: { confidence: 0.9 },
    });

    expect(supabaseMocks.rpc).toHaveBeenCalledWith(
      'insert_contract_markdown_version',
      expect.objectContaining({
        p_entity_type: 'amendment',
        p_amendment_id: 'a1',
        p_source_kind: 'ocr',
      }),
    );
    expect(created.entityType).toBe('amendment');
    expect(created.versionNo).toBe(1);
  });
});
