import type { ContractWithDetails, ProjectDetails } from '@/types';
import { formatDate } from '../utils/format';

export type HandoverResult = '' | 'accepted' | 'with_defects' | 'rejected';
export type DocumentKind = 'sub_work_handover' | 'sub_site_handover';
export const documentKindLabels: Record<DocumentKind, string> = { sub_work_handover: 'Předání díla', sub_site_handover: 'Předání staveniště' };
export interface HandoverFields {
  recordTitle?: string;
  plannedDate?: string;
  note?: string;
  siteConditions?: string;
  siteSafety?: string;
  siteFacilities?: string;
  organizationName: string;
  organizationAddress: string;
  vendorName: string;
  vendorIco: string;
  vendorAddress: string;
  contractNumber: string;
  projectName: string;
  siteLocation: string;
  issuerRepresentative: string;
  vendorRepresentative: string;
  scope: string;
  scopeKind: 'whole' | 'part';
  actualDate: string;
  result: HandoverResult;
  defects: string;
  defectsDeadline: string;
  attachments: string;
  handwritingLines: 0 | 5 | 10;
}
export interface DocumentLogo { dataUrl: string; width: number; height: number }
export interface DocumentSnapshot {
  schemaVersion: 1;
  templateVersion: 1;
  kind: DocumentKind;
  createdAt: string;
  version: number;
  fields: HandoverFields;
  logo: DocumentLogo | null;
}
export interface DocumentVersion {
  id: string;
  contract_id: string;
  document_id: string;
  version: number;
  snapshot: DocumentSnapshot;
  created_at: string;
  created_by: string;
}
export interface DocumentFile {
  id: string;
  version_id: string;
  file_name: string;
  storage_path: string;
  created_at: string;
}
export interface HandoverEvent {
  id: string;
  kind: 'handover' | 'site_handover' | 'warranty';
  contract_id?: string;
  document_version_id?: string | null;
  effective_date: string;
  result: HandoverResult;
  source_note: string;
  created_at: string;
  created_by: string;
}
export const resultLabels: Record<HandoverResult, string> = {
  '': 'Nevyplněno', accepted: 'Převzato bez vad', with_defects: 'Převzato s vadami a nedodělky', rejected: 'Nepřevzato',
};
export const createHandoverDraft = (contract: ContractWithDetails, project?: ProjectDetails, organizationName = ''): HandoverFields => ({
  organizationName, organizationAddress: '', vendorName: contract.vendorName, vendorIco: contract.vendorIco || '', vendorAddress: '',
  contractNumber: contract.contractNumber || '', projectName: project?.title || '', siteLocation: project?.location || '',
  issuerRepresentative: project?.siteManager || '', vendorRepresentative: '', scope: contract.scopeSummary || contract.title,
  scopeKind: 'whole', actualDate: '', result: '', defects: '', defectsDeadline: '', attachments: '', handwritingLines: 0,
});
export const freezeDocument = (fields: HandoverFields, createdAt: string, version: number, logo: DocumentLogo | null = null, kind: DocumentKind = 'sub_work_handover'): DocumentSnapshot => ({
  schemaVersion: 1, templateVersion: 1, kind, createdAt, version, fields: { ...fields }, logo: logo ? { ...logo } : null,
});
export const documentSections = (snapshot: DocumentSnapshot): { title: string; text: string; handwritingLines?: number }[] => {
  const f = snapshot.fields;
  return [
    { title: 'Smluvní strany a stavba', text: [
      `Organizace: ${f.organizationName || '________________'}`, f.organizationAddress,
      `Subdodavatel: ${f.vendorName}${f.vendorIco ? ` · IČ ${f.vendorIco}` : ''}`, f.vendorAddress,
      `Stavba: ${f.projectName}${f.siteLocation ? ` · ${f.siteLocation}` : ''}`, `Smlouva: ${f.contractNumber || '________________'}`,
    ].filter(Boolean).join('\n') },
    { title: '1. Předmět a rozsah předání', text: `${snapshot.kind === 'sub_site_handover' ? (f.scopeKind === 'part' ? 'Část staveniště' : 'Celé staveniště') : (f.scopeKind === 'part' ? 'Část díla' : 'Celé dílo')}: ${f.scope}` },
    { title: '2. Průběh převzetí', text: `Skutečné datum předání: ${f.actualDate ? formatDate(f.actualDate) : '________________'}\nVýsledek: ${f.result ? resultLabels[f.result] : '________________'}` },
    { title: '3. Vady a nedodělky', text: [f.defects, f.defectsDeadline ? `Termín odstranění: ${formatDate(f.defectsDeadline)}` : ''].filter(Boolean).join('\n'), handwritingLines: f.handwritingLines },
    ...(snapshot.kind === 'sub_site_handover' ? [
      { title: 'Podmínky a přístup na staveniště', text: f.siteConditions || '________________' },
      { title: 'Bezpečnost a BOZP', text: f.siteSafety || '________________' },
      { title: 'Zařízení staveniště a přípojky', text: f.siteFacilities || '________________' },
    ] : []),
    { title: '4. Předané doklady a přílohy', text: f.attachments || '________________' },
  ];
};
export const documentFooter = (snapshot: DocumentSnapshot) => `Vytvořeno v Tender Flow · ${formatDate(snapshot.createdAt)} · Verze ${snapshot.version}`;
export const documentFileName = (snapshot: DocumentSnapshot, extension: 'pdf' | 'docx') =>
  `predavaci-protokol-${snapshot.fields.contractNumber.replace(/[^\p{L}\p{N}_-]/gu, '-').slice(0, 60) || 'smlouva'}-v${snapshot.version}.${extension}`;
