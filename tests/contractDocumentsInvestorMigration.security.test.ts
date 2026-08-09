import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260807204541_20260807201421_extend_contract_documents_and_investor_billing.sql',
  ),
  'utf8',
);

describe('contract documents and investor billing migration', () => {
  it('vytváří privátní omezený bucket pro PDF a DOCX', () => {
    expect(migration).toContain("'contract-documents'");
    expect(migration).toMatch(/public\s*,[^\n]*false/i);
    expect(migration).toContain("application/pdf");
    expect(migration).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
  });

  it('omezuje storage operace na oprávněné projekty a editory', () => {
    expect(migration).toContain('ON storage.objects');
    expect(migration).toContain("public.user_has_feature('module_contracts')");
    expect(migration).toContain('public.is_project_shared_with_user');
    expect(migration).toContain('public.has_project_share_permission');
    expect(migration).toContain("document_storage_path LIKE 'projects/' || project_id || '/contracts/%'");
    expect(migration).not.toMatch(/WITH CHECK\s*\(\s*true\s*\)/i);
  });

  it('přidává období, snapshot pozastávek a kontrolní omezení faktury', () => {
    expect(migration).toContain('period');
    expect(migration).toContain('retention_a_percent');
    expect(migration).toContain('retention_b_percent');
    expect(migration).toContain('paid_amount');
    expect(migration).toMatch(/retention_a_percent\s*\+\s*retention_b_percent\s*<=\s*100/i);
    expect(migration).toContain('ALTER TABLE public.project_investor_invoices ENABLE ROW LEVEL SECURITY');
    expect(migration).not.toContain('p.owner_id IS NULL');
  });
});
