import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('../services/functionsClient', () => ({
  invokeAuthedFunction: (...args: any[]) => invokeMock(...args),
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
    },
    storage: {
      from: vi.fn(),
    },
  },
}));

import { contractService } from '../services/contractService';

describe('contractService markdown versions', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('getMarkdownVersions vola secure edge function a mapuje verze', async () => {
    invokeMock.mockResolvedValue({
      versions: [
        {
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
          encryption_version: 1,
          encryption_key_id: 'v1',
          content_sha256: 'abc',
          metadata: { a: 1 },
          created_by: 'u1',
          created_at: '2026-02-15T10:00:00.000Z',
        },
      ],
    });

    const versions = await contractService.getMarkdownVersions({
      entityType: 'contract',
      entityId: 'c1',
    });

    expect(invokeMock).toHaveBeenCalledWith(
      'contract-markdown-secure',
      expect.objectContaining({
        body: expect.objectContaining({
          action: 'list',
          entityType: 'contract',
          entityId: 'c1',
        }),
      }),
    );
    expect(versions[0].versionNo).toBe(2);
    expect(versions[0].contentMd).toBe('# Obsah');
    expect(versions[0].encryptionKeyId).toBe('v1');
  });

  it('getLatestMarkdownVersion vola latest action', async () => {
    invokeMock.mockResolvedValue({
      version: {
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
        encryption_version: 1,
        encryption_key_id: 'v1',
        content_sha256: 'hash',
        metadata: {},
        created_by: 'u1',
        created_at: '2026-02-15T10:00:00.000Z',
      },
    });

    const latest = await contractService.getLatestMarkdownVersion({
      entityType: 'contract',
      entityId: 'c1',
    });

    expect(invokeMock).toHaveBeenCalledWith(
      'contract-markdown-secure',
      expect.objectContaining({
        body: expect.objectContaining({
          action: 'latest',
          entityType: 'contract',
          entityId: 'c1',
        }),
      }),
    );
    expect(latest?.id).toBe('v2');
    expect(latest?.versionNo).toBe(5);
  });

  it('createMarkdownVersion vola secure create action', async () => {
    invokeMock.mockResolvedValue({
      version: {
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
        encryption_version: 1,
        encryption_key_id: 'v1',
        content_sha256: 'hash',
        metadata: { confidence: 0.9 },
        created_by: 'u1',
        created_at: '2026-02-15T10:00:00.000Z',
      },
    });

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

    expect(invokeMock).toHaveBeenCalledWith(
      'contract-markdown-secure',
      expect.objectContaining({
        body: expect.objectContaining({
          action: 'create',
          entityType: 'amendment',
          amendmentId: 'a1',
          sourceKind: 'ocr',
        }),
      }),
    );
    expect(created.entityType).toBe('amendment');
    expect(created.versionNo).toBe(1);
    expect((created as any).content_md_ciphertext).toBeUndefined();
  });

  it('logMarkdownAccess vola log_access action', async () => {
    invokeMock.mockResolvedValue({ ok: true });

    await contractService.logMarkdownAccess({
      markdownVersionId: 'v1',
      accessKind: 'download',
    });

    expect(invokeMock).toHaveBeenCalledWith(
      'contract-markdown-secure',
      expect.objectContaining({
        body: expect.objectContaining({
          action: 'log_access',
          markdownVersionId: 'v1',
          accessKind: 'download',
        }),
      }),
    );
  });
});
