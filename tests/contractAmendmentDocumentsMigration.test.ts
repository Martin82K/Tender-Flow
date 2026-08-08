import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  `${process.cwd()}/supabase/migrations/20260808145453_add_contract_amendment_documents.sql`,
  'utf8',
);

describe('contract amendment documents migration', () => {
  it('přidává bezpečná metadata dokumentu dodatku bez oslabení RLS', () => {
    expect(migration).toContain('ALTER TABLE public.contract_amendments');
    expect(migration).toContain('document_storage_path');
    expect(migration).toContain('document_file_name');
    expect(migration).toContain('document_mime_type');
    expect(migration).toContain('document_size');
    expect(migration).toContain('contract_amendments_document_size_check');
    expect(migration).toContain('contract_amendments_document_mime_type_check');
    expect(migration).toContain('contract_amendments_document_metadata_check');
    expect(migration).not.toMatch(/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i);
  });
});
