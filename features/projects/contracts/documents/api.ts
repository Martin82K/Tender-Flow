import { dbAdapter } from '@infra/db/dbAdapter';
import { organizationService } from '@features/organization';
import type { ProjectDetails } from '@/types';
import type { DocumentFile, DocumentLogo, DocumentSnapshot, DocumentVersion, HandoverEvent, HandoverResult } from './model';

const BUCKET = 'contract-protocol-files';
const failure = (error: { message: string; code?: string } | null) => {
  if (!error) return;
  if (error.code === 'PGRST205' || error.code === 'PGRST202') throw new Error('Dokumenty zatím nejsou připravené v databázi. Kontaktujte správce aplikace.');
  throw new Error(error.message);
};
export const contractDocumentsApi = {
  async list(contractId: string): Promise<DocumentVersion[]> {
    const { data, error } = await dbAdapter.from('contract_generated_documents').select('*').eq('contract_id', contractId).order('created_at', { ascending: false });
    failure(error); return (data || []) as DocumentVersion[];
  },
  async save(contractId: string, documentId: string, expectedVersion: number, snapshot: DocumentSnapshot): Promise<DocumentVersion> {
    const { data, error } = await dbAdapter.rpc('save_contract_document_version', { contract_id_input: contractId, document_id_input: documentId, expected_version: expectedVersion, snapshot_input: snapshot });
    failure(error); return data as DocumentVersion;
  },
  async files(versionIds: string[]): Promise<DocumentFile[]> {
    if (!versionIds.length) return [];
    const { data, error } = await dbAdapter.from('contract_document_files').select('*').in('version_id', versionIds).order('created_at', { ascending: false });
    failure(error); return (data || []) as DocumentFile[];
  },
  async attach(version: DocumentVersion, file: File): Promise<void> {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx'].includes(extension || '') || file.size > 20 * 1024 * 1024 || !file.size) throw new Error('Vyberte PDF nebo DOCX o velikosti do 20 MB.');
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (extension === 'pdf' ? new TextDecoder().decode(head) !== '%PDF-' : head[0] !== 80 || head[1] !== 75) throw new Error('Obsah souboru neodpovídá příponě PDF/DOCX.');
    const path = `${version.contract_id}/${version.id}/${crypto.randomUUID()}.${extension}`;
    const mime = extension === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const upload = await dbAdapter.storage.from(BUCKET).upload(path, file, { contentType: mime, upsert: false });
    failure(upload.error);
    const result = await dbAdapter.rpc('attach_contract_document_file', { version_id_input: version.id, path_input: path, name_input: file.name });
    if (result.error) {
      // Only unreferenced objects owned by this uploader may be removed by storage policy.
      await dbAdapter.storage.from(BUCKET).remove([path]);
      failure(result.error);
    }
  },
  async download(file: DocumentFile): Promise<Blob> {
    const { data, error } = await dbAdapter.storage.from(BUCKET).download(file.storage_path);
    failure(error); if (!data) throw new Error('Soubor není dostupný.'); return data;
  },
  async events(contractId: string): Promise<HandoverEvent[]> {
    const { data, error } = await dbAdapter.from('contract_handover_events').select('*').eq('contract_id', contractId).order('created_at', { ascending: false });
    failure(error); return (data || []) as HandoverEvent[];
  },
  async confirm(contractId: string, kind: HandoverEvent['kind'], date: string, result: HandoverResult, source: string): Promise<void> {
    const { error } = await dbAdapter.rpc('confirm_contract_handover_event', { contract_id_input: contractId, kind_input: kind, date_input: date, result_input: result, source_input: source });
    failure(error);
  },
  async canWrite(projectId: string): Promise<boolean> {
    const { data, error } = await dbAdapter.rpc('can_project_module_action', { project_id_input: projectId, feature_key_input: 'module_contracts', write_input: true });
    failure(error); return data === true;
  },
  async context(projectId: string, vendorId?: string): Promise<{ project: ProjectDetails; organizationName: string; organizationAddress: string; vendorAddress: string; vendorContacts: string[]; logo: DocumentLogo | null }> {
    const { data, error } = await dbAdapter.from('projects').select('id,name,organization_id,location,site_manager').eq('id', projectId).single();
    failure(error); if (!data) throw new Error('Stavba není dostupná.');
    const vendorResponse = vendorId ? await dbAdapter.from('subcontractors').select('address,city,contacts').eq('id', vendorId).maybeSingle() : null;
    if (vendorResponse?.error) failure(vendorResponse.error);
    const vendor = vendorResponse?.data;
    const vendorContacts = Array.isArray(vendor?.contacts) ? vendor.contacts.filter((contact: unknown): contact is { name: string } => Boolean(contact && typeof contact === 'object' && 'name' in contact && typeof contact.name === 'string')).map((contact: {name:string}) => contact.name) : [];
    const organizations = data.organization_id ? await organizationService.getMyOrganizations() : [];
    const organization = organizations.find(o => o.organization_id === data.organization_id);
    const logoUrl = data.organization_id ? await organizationService.getOrganizationLogoUrl(data.organization_id) : null;
    return { project: { id: data.id, title: data.name, location: data.location || '', siteManager: data.site_manager || '', finishDate: '', categories: [] }, vendorAddress: [vendor?.address, vendor?.city].filter(Boolean).join(', '), vendorContacts, organizationName: organization?.organization_name || '', organizationAddress: organization?.email_signature_company_address || '', logo: logoUrl ? await snapshotLogo(logoUrl) : null };
  },
};

// Decode only the organization-owned storage image; rasterize to remove SVG/external resources from exports.
export const snapshotLogo = async (url: string): Promise<DocumentLogo> => {
  const response = await fetch(url, { credentials: 'omit' });
  if (!response.ok) throw new Error('Logo organizace se nepodařilo načíst. Zkuste to znovu.');
  const blob = await response.blob();
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(blob.type) || blob.size > 2 * 1024 * 1024) throw new Error('Logo musí být obrázek do 2 MB.');
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image(); image.src = objectUrl; await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error('Logo má nepodporované rozměry.');
    const scale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d'); if (!context) throw new Error('Logo nelze připravit pro export.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
  } finally { URL.revokeObjectURL(objectUrl); }
};
export const downloadDocumentBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = fileName; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
