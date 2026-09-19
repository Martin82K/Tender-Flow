import type { ContractWithDetails } from '@/types';
import type { DocumentVersion } from '@features/projects/contracts/documents/model';
export function latestDocuments(versions: DocumentVersion[]): DocumentVersion[] {
  const latest = new Map<string, DocumentVersion>();
  for (const version of versions) if (!latest.has(version.document_id) || latest.get(version.document_id)!.version < version.version) latest.set(version.document_id, version);
  return [...latest.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function groupSubcontractorDocuments(contracts: ContractWithDetails[], versions: DocumentVersion[]) {
  const groups = new Map<string, { id: string; name: string; contracts: ContractWithDetails[]; documents: DocumentVersion[] }>();
  const latest = latestDocuments(versions);
  for (const contract of contracts) {
    // A missing registry identity must never merge unrelated companies by their display name.
    const id = contract.vendorId ? 'vendor:' + contract.vendorId : contract.vendorIco ? 'ico:' + contract.vendorIco : 'contract:' + contract.id;
    const group = groups.get(id) || { id, name: contract.vendorName, contracts: [], documents: [] };
    group.contracts.push(contract);
    group.documents.push(...latest.filter(document => document.contract_id === contract.id));
    groups.set(id, group);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'cs'));
}
