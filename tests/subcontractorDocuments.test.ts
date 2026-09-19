import { describe, expect, it } from 'vitest';
import { createHandoverDraft, freezeDocument, documentSections } from '@features/projects/contracts/documents/model';
import { groupSubcontractorDocuments, latestDocuments } from '@features/projects/documents/model/subcontractorDocuments';
import type { ContractWithDetails } from '@/types';
const a = { id: 'a', projectId: 'p', vendorId: 'vendor', vendorName: 'Firma', title: 'Most' } as ContractWithDetails;
const b = { ...a, id: 'b' };
const version = (id: string, contractId: string, n: number) => ({ id: `${id}-${n}`, document_id: id, contract_id: contractId, version: n, created_at: '2026-09-18', created_by: 'user', snapshot: freezeDocument(createHandoverDraft(a), '2026-09-18', n) });
describe('subcontractor documents', () => {
  it('retains only latest versions regardless of input order', () => {
    expect(latestDocuments([version('d', 'a', 1), version('d', 'a', 3), version('d', 'a', 2)]).map(v => v.version)).toEqual([3]);
  });
  it('groups multiple contracts by vendor identity and counts documents, not versions', () => {
    const groups = groupSubcontractorDocuments([a, b], [version('d', 'a', 1), version('d', 'a', 2), version('e', 'b', 1)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].contracts).toHaveLength(2);
    expect(groups[0].documents).toHaveLength(2);
  });
  it('does not merge distinct vendors with identical names', () => {
    expect(groupSubcontractorDocuments([a, {...b, vendorId: 'other'}], [])).toHaveLength(2);
  });
  it('exports site-specific conditions and never changes the work template', () => {
    const fields = {...createHandoverDraft(a), siteConditions: 'Přístup branou A', siteSafety: 'Ochranná přilba', siteFacilities: 'Voda u brány'};
    const site = freezeDocument(fields, '2026-09-18', 1, null, 'sub_site_handover');
    expect(site.kind).toBe('sub_site_handover');
    expect(documentSections(site).map(s => s.text).join('\n')).toContain('Přístup branou A');
    expect(documentSections(site).map(s => s.text).join('\n')).toContain('Ochranná přilba');
    expect(documentSections(freezeDocument(fields, '2026-09-18', 1)).map(s => s.text).join('\n')).not.toContain('Přístup branou A');
  });
});
