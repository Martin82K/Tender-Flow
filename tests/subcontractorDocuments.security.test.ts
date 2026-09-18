import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const sql=readFileSync('supabase/migrations/20260918083859_subcontractor_document_workspace.sql','utf8');
describe('document handover authorization and history',()=>{
  it('authorizes both entrypoints and locks the same contract before version checks',()=>{
    for(const name of ['save_contract_document_version','confirm_document_handover']){
      const body=sql.slice(sql.indexOf(`FUNCTION public.${name}`)).split('END; $$;')[0];
      expect(body).toContain("SECURITY DEFINER SET search_path = ''");
      expect(body).toContain('auth.uid() IS NULL');
      expect(body).toContain('public.has_active_subscription()');
      expect(body).toContain("public.can_project_module_action(c.project_id::text, 'module_contracts', true)");
      expect(body).toContain('FOR UPDATE');
      expect(body).toContain("ERRCODE = '40001'");
    }
  });
  it('links exact versions, disallows kind changes and leaves warranty untouched',()=>{
    expect(sql).toContain('document_version_id uuid REFERENCES public.contract_generated_documents(id)');
    expect(sql).toContain("snapshot->>'kind' IS DISTINCT FROM snapshot_input->>'kind'");
    expect(sql).toContain('version > d.version');
    expect(sql).not.toMatch(/UPDATE public.contracts SET warranty/);
    expect(sql).not.toMatch(/DISABLE ROW LEVEL SECURITY|GRANT ALL.*authenticated/);
    expect(sql).toContain('FROM PUBLIC, anon, authenticated');
    expect(sql).toContain('TO authenticated');
  });
});
