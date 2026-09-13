import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), from: vi.fn() }));
vi.mock('@infra/db/dbAdapter', () => ({ dbAdapter: { rpc: mocks.rpc, from: mocks.from, storage: { from: () => ({ upload: mocks.upload }) } } }));
vi.mock('@features/organization', () => ({ organizationService: {} }));
import { contractDocumentsApi } from '@features/projects/contracts/documents/api';
import type { DocumentVersion } from '@features/projects/contracts/documents/model';
const sql = readFileSync('supabase/migrations/20260913191425_contract_document_workflow.sql', 'utf8');
describe('contract document security boundary', () => {
  it('keeps records immutable for clients and gates every privileged mutation by project permissions', () => {
    for (const table of ['contract_generated_documents', 'contract_document_files', 'contract_handover_events']) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    }
    expect(sql).not.toMatch(/GRANT (?:ALL|INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
    for (const name of ['save_contract_document_version', 'confirm_contract_handover_event', 'attach_contract_document_file']) {
      const body = sql.split(`CREATE FUNCTION public.${name}`)[1].split('$$;')[0];
      expect(body).toContain('auth.uid() IS NULL');
      expect(body).toContain('public.has_active_subscription()');
      expect(body).toContain('public.can_project_module_action(');
      expect(body).toContain("SET search_path = ''");
    }
    expect(sql).toContain('FROM PUBLIC, anon, authenticated');
    expect(sql).not.toContain('user_metadata');
  });
  it('checks contract ownership of document families and optimistic version conflicts', () => {
    expect(sql).toContain('document_id = document_id_input AND contract_id <> c.id');
    expect(sql).toContain('latest <> expected_version');
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain('UNIQUE(document_id, version)');
    expect(sql).toContain("'createdAt',now(),'version',latest+1");
  });
  it('does not confirm business events while saving or attaching a document', () => {
    for (const name of ['save_contract_document_version', 'attach_contract_document_file']) {
      const body = sql.split(`CREATE FUNCTION public.${name}`)[1].split('$$;')[0];
      expect(body).not.toContain('UPDATE public.contracts');
      expect(body).not.toContain('INSERT INTO public.contract_handover_events');
    }
    expect(sql).toContain('CREATE TRIGGER guard_confirmed_contract_warranty');
    expect(sql).not.toMatch(/SET completion_date|SET signed_at|SET retention_/i);
  });
  it('prevents overwrites and limits file storage to accessible document versions', () => {
    expect(sql).toContain("'contract-protocol-files',false,20971520");
    expect(sql).toContain("d.id::text = split_part(name,'/',2)");
    expect(sql).toContain("owner_id=auth.uid()::text");
    expect(sql).not.toMatch(/protocol_files[^;]+FOR UPDATE/);
  });
  it('rejects executable uploads before network access', async () => {
    await expect(contractDocumentsApi.attach({} as DocumentVersion, new File(['code'], 'payload.exe'))).rejects.toThrow(/PDF nebo DOCX/);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('surfaces missing migration instead of reporting a successful save', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: {code:'PGRST202',message:'missing'} });
    await expect(contractDocumentsApi.confirm('c','warranty','2026-09-01','','Zdroj')).rejects.toThrow(/databázi/);
  });
});
