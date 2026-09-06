import { supabase } from './supabase';
import { invokeAuthedFunction } from './functionsClient';
import { validateContractDocument } from '@/shared/contracts/contractDocument';
import {
  Contract,
  ContractAmendment,
  ContractInvoice,
  ContractInvoiceStatus,
  ContractMarkdownAccessKind,
  ContractDrawdown,
  ContractMarkdownEntityType,
  ContractMarkdownSourceKind,
  ContractMarkdownVersion,
  ContractRetentionStatus,
  ContractWithDetails,
} from '../types';

// Helper: Map DB row to Contract type
const mapContract = (row: Record<string, unknown>): Contract => ({
  id: row.id as string,
  projectId: row.project_id as string,
  vendorId: row.vendor_id as string | undefined,
  vendorName: row.vendor_name as string,
  vendorIco: row.vendor_ico as string | undefined,
  title: row.title as string,
  contractNumber: row.contract_number as string | undefined,
  status: row.status as Contract['status'],
  signedAt: row.signed_at as string | undefined,
  effectiveFrom: row.effective_from as string | undefined,
  effectiveTo: row.effective_to as string | undefined,
  completionDate: row.completion_date as string | undefined,
  currency: row.currency as string,
  basePrice: parseFloat(row.base_price as string) || 0,
  retentionPercent: row.retention_percent ? parseFloat(row.retention_percent as string) : undefined,
  retentionAmount: row.retention_amount ? parseFloat(row.retention_amount as string) : undefined,
  retentionShortPercent: row.retention_short_percent
    ? parseFloat(row.retention_short_percent as string)
    : undefined,
  retentionShortAmount: row.retention_short_amount
    ? parseFloat(row.retention_short_amount as string)
    : undefined,
  retentionShortReleaseOn: (row.retention_short_release_on as string | null | undefined) ?? undefined,
  retentionShortStatus:
    (row.retention_short_status as ContractRetentionStatus | null | undefined) ?? undefined,
  retentionLongPercent: row.retention_long_percent
    ? parseFloat(row.retention_long_percent as string)
    : undefined,
  retentionLongAmount: row.retention_long_amount
    ? parseFloat(row.retention_long_amount as string)
    : undefined,
  retentionLongReleaseOn: (row.retention_long_release_on as string | null | undefined) ?? undefined,
  retentionLongStatus:
    (row.retention_long_status as ContractRetentionStatus | null | undefined) ?? undefined,
  siteSetupPercent: row.site_setup_percent ? parseFloat(row.site_setup_percent as string) : undefined,
  warrantyMonths: row.warranty_months as number | undefined,
  paymentTerms: row.payment_terms as string | undefined,
  scopeSummary: row.scope_summary as string | undefined,
  source: row.source as Contract['source'],
  sourceBidId: row.source_bid_id as string | undefined,
  documentUrl: row.document_url as string | undefined,
  documentStoragePath: row.document_storage_path as string | undefined,
  documentFileName: row.document_file_name as string | undefined,
  documentMimeType: row.document_mime_type as string | undefined,
  documentSize:
    row.document_size === null || row.document_size === undefined
      ? undefined
      : Number(row.document_size),
  extractionConfidence: row.extraction_confidence as number | undefined,
  extractionJson: row.extraction_json as Record<string, unknown> | undefined,
  vendorRating:
    row.vendor_rating === null || row.vendor_rating === undefined
      ? null
      : Number.parseFloat(row.vendor_rating as string),
  vendorRatingNote: (row.vendor_rating_note as string | null | undefined) ?? null,
  vendorRatingAt: (row.vendor_rating_at as string | null | undefined) ?? null,
  vendorRatingBy: (row.vendor_rating_by as string | null | undefined) ?? null,
  createdBy: row.created_by as string | undefined,
  createdAt: row.created_at as string | undefined,
  updatedAt: row.updated_at as string | undefined,
});

const mapAmendment = (row: Record<string, unknown>): ContractAmendment => ({
  id: row.id as string,
  contractId: row.contract_id as string,
  amendmentNo: row.amendment_no as number,
  signedAt: row.signed_at as string | undefined,
  effectiveFrom: row.effective_from as string | undefined,
  deltaPrice: parseFloat(row.delta_price as string) || 0,
  deltaDeadline: row.delta_deadline as string | undefined,
  reason: row.reason as string | undefined,
  documentUrl: row.document_url as string | undefined,
  documentStoragePath: row.document_storage_path as string | undefined,
  documentFileName: row.document_file_name as string | undefined,
  documentMimeType: row.document_mime_type as string | undefined,
  documentSize:
    row.document_size === null || row.document_size === undefined
      ? undefined
      : Number(row.document_size),
  extractionJson: row.extraction_json as Record<string, unknown> | undefined,
  extractionConfidence: row.extraction_confidence as number | undefined,
  createdBy: row.created_by as string | undefined,
  createdAt: row.created_at as string | undefined,
});

const mapInvoice = (row: Record<string, unknown>): ContractInvoice => ({
  id: row.id as string,
  contractId: row.contract_id as string,
  invoiceNumber: row.invoice_number as string,
  issueDate: row.issue_date as string,
  dueDate: row.due_date as string,
  amount: parseFloat(row.amount as string) || 0,
  currency: (row.currency as string) || 'CZK',
  status: (row.status as ContractInvoiceStatus) || 'issued',
  paidAt: (row.paid_at as string | null | undefined) ?? undefined,
  documentUrl: (row.document_url as string | null | undefined) ?? undefined,
  note: (row.note as string | null | undefined) ?? undefined,
  createdBy: (row.created_by as string | null | undefined) ?? undefined,
  createdAt: (row.created_at as string | null | undefined) ?? undefined,
  updatedAt: (row.updated_at as string | null | undefined) ?? undefined,
});

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const sanitizeDocumentUrl = (value: string | null | undefined): string | null => {
  if (!value) return null;

  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  try {
    const parsed = new URL(trimmedValue);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

const deriveInvoiceStatus = (invoice: ContractInvoice): ContractInvoiceStatus => {
  if (invoice.status === 'issued' && invoice.dueDate && invoice.dueDate < todayIso()) {
    return 'overdue';
  }
  return invoice.status;
};

const computeInvoiceAggregates = (invoices: ContractInvoice[]) => {
  let invoicedSum = 0;
  let paidSum = 0;
  let overdueSum = 0;
  for (const inv of invoices) {
    invoicedSum += inv.amount;
    const effective = deriveInvoiceStatus(inv);
    if (effective === 'paid') paidSum += inv.amount;
    if (effective === 'overdue') overdueSum += inv.amount;
  }
  return { invoicedSum, paidSum, overdueSum };
};

const mapDrawdown = (row: Record<string, unknown>): ContractDrawdown => ({
  id: row.id as string,
  contractId: row.contract_id as string,
  period: row.period as string,
  claimedAmount: parseFloat(row.claimed_amount as string) || 0,
  approvedAmount: parseFloat(row.approved_amount as string) || 0,
  note: row.note as string | undefined,
  documentUrl: row.document_url as string | undefined,
  extractionJson: row.extraction_json as Record<string, unknown> | undefined,
  extractionConfidence: row.extraction_confidence as number | undefined,
  createdBy: row.created_by as string | undefined,
  createdAt: row.created_at as string | undefined,
});

const mapMarkdownVersion = (
  row: Record<string, unknown>,
): ContractMarkdownVersion => ({
  id: row.id as string,
  entityType: row.entity_type as ContractMarkdownEntityType,
  contractId: row.contract_id as string | undefined,
  amendmentId: row.amendment_id as string | undefined,
  projectId: row.project_id as string,
  vendorId: row.vendor_id as string | undefined,
  versionNo: Number.parseInt(String(row.version_no), 10) || 0,
  sourceKind: row.source_kind as ContractMarkdownSourceKind,
  sourceFileName: row.source_file_name as string | undefined,
  sourceDocumentUrl: row.source_document_url as string | undefined,
  ocrProvider: row.ocr_provider as string | undefined,
  ocrModel: row.ocr_model as string | undefined,
  contentMd: (row.content_md as string | null | undefined) || '',
  encryptionVersion:
    row.encryption_version === null || row.encryption_version === undefined
      ? undefined
      : Number.parseInt(String(row.encryption_version), 10),
  encryptionKeyId: row.encryption_key_id as string | undefined,
  contentSha256: row.content_sha256 as string | undefined,
  metadata: (row.metadata as Record<string, unknown> | null) || {},
  createdBy: row.created_by as string | undefined,
  createdAt: row.created_at as string | undefined,
});

interface MarkdownVersionsResponse {
  versions: Record<string, unknown>[];
}

interface MarkdownLatestResponse {
  version: Record<string, unknown> | null;
}

interface MarkdownCreateResponse {
  version: Record<string, unknown>;
}

const CONTRACT_PAGE_SIZE = 500;
const CONTRACT_RELATION_BATCH_SIZE = 100;
interface ProjectContractRow extends Record<string, unknown> { id: string; project_id: string }
interface ContractRelationRow extends Record<string, unknown> { id: string; contract_id: string }

const loadContractRelationRows = async (
  table: 'contract_amendments' | 'contract_drawdowns' | 'contract_invoices',
  contractIds: string[],
  orderColumn: string,
): Promise<ContractRelationRow[]> => {
  const result = new Map<string, ContractRelationRow>();
  for (let offset = 0; offset < contractIds.length; offset += CONTRACT_RELATION_BATCH_SIZE) {
    const batch = contractIds.slice(offset, offset + CONTRACT_RELATION_BATCH_SIZE);
    const allowed = new Set(batch);
    for (let start = 0; ; start += CONTRACT_PAGE_SIZE) {
      const { data, error } = await supabase.from(table).select('*').in('contract_id', batch)
        .order(orderColumn, { ascending: true }).order('id', { ascending: true })
        .range(start, start + CONTRACT_PAGE_SIZE - 1);
      if (error) throw error;
      const rows = (data ?? []) as ContractRelationRow[];
      for (const row of rows) if (allowed.has(row.contract_id)) result.set(row.id, row);
      if (rows.length < CONTRACT_PAGE_SIZE) break;
    }
  }
  return [...result.values()];
};

export const contractService = {
  // ============== CONTRACTS ==============

  getContractsByProject: async (projectId: string): Promise<ContractWithDetails[]> => {
    const byId = new Map<string, ProjectContractRow>();
    for (let start = 0; ; start += CONTRACT_PAGE_SIZE) {
      const { data, error } = await supabase.from('contracts').select('*').eq('project_id', projectId)
        .order('created_at', { ascending: false }).order('id', { ascending: true })
        .range(start, start + CONTRACT_PAGE_SIZE - 1);
      if (error) throw error;
      const rows = (data ?? []) as ProjectContractRow[];
      for (const row of rows) if (row.project_id === projectId) byId.set(row.id, row);
      if (rows.length < CONTRACT_PAGE_SIZE) break;
    }
    const contracts = [...byId.values()];
    if (!contracts.length) return [];
    const contractIds = contracts.map(contract => contract.id);
    const [amendmentRows, drawdownRows, invoiceRows] = await Promise.all([
      loadContractRelationRows('contract_amendments', contractIds, 'amendment_no'),
      loadContractRelationRows('contract_drawdowns', contractIds, 'period'),
      loadContractRelationRows('contract_invoices', contractIds, 'due_date'),
    ]);

    const amendmentsByContract: Record<string, ContractAmendment[]> = {};
    const drawdownsByContract: Record<string, ContractDrawdown[]> = {};
    const invoicesByContract: Record<string, ContractInvoice[]> = {};

    amendmentRows.forEach(a => {
      if (!amendmentsByContract[a.contract_id]) amendmentsByContract[a.contract_id] = [];
      amendmentsByContract[a.contract_id].push(mapAmendment(a));
    });

    drawdownRows.forEach(d => {
      if (!drawdownsByContract[d.contract_id]) drawdownsByContract[d.contract_id] = [];
      drawdownsByContract[d.contract_id].push(mapDrawdown(d));
    });

    invoiceRows.forEach(i => {
      if (!invoicesByContract[i.contract_id]) invoicesByContract[i.contract_id] = [];
      invoicesByContract[i.contract_id].push(mapInvoice(i));
    });

    return contracts.map(c => {
      const contract = mapContract(c);
      const amendments = amendmentsByContract[c.id] || [];
      const drawdowns = drawdownsByContract[c.id] || [];
      const invoices = invoicesByContract[c.id] || [];

      const currentTotal = contract.basePrice + amendments.reduce((sum, a) => sum + a.deltaPrice, 0);
      const approvedSum = drawdowns.reduce((sum, d) => sum + d.approvedAmount, 0);
      const { invoicedSum, paidSum, overdueSum } = computeInvoiceAggregates(invoices);

      return {
        ...contract,
        amendments,
        drawdowns,
        invoices,
        currentTotal,
        approvedSum,
        remaining: currentTotal - approvedSum,
        invoicedSum,
        paidSum,
        overdueSum,
      };
    });
  },

  listContractsByProjectIds: async (projectIds: string[]): Promise<ContractWithDetails[]> => {
    if (projectIds.length === 0) return [];

    const { data: contracts, error } = await supabase
      .from('contracts')
      .select('*')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!contracts?.length) return [];

    const contractIds = contracts.map(c => c.id);

    const [amendmentsRes, drawdownsRes, invoicesRes] = await Promise.all([
      supabase.from('contract_amendments').select('*').in('contract_id', contractIds).order('amendment_no', { ascending: true }),
      supabase.from('contract_drawdowns').select('*').in('contract_id', contractIds).order('period', { ascending: true }),
      supabase.from('contract_invoices').select('*').in('contract_id', contractIds).order('due_date', { ascending: true }),
    ]);

    const amendmentsByContract: Record<string, ContractAmendment[]> = {};
    const drawdownsByContract: Record<string, ContractDrawdown[]> = {};
    const invoicesByContract: Record<string, ContractInvoice[]> = {};

    (amendmentsRes.data || []).forEach(a => {
      (amendmentsByContract[a.contract_id] ??= []).push(mapAmendment(a));
    });
    (drawdownsRes.data || []).forEach(d => {
      (drawdownsByContract[d.contract_id] ??= []).push(mapDrawdown(d));
    });
    (invoicesRes.data || []).forEach(i => {
      (invoicesByContract[i.contract_id] ??= []).push(mapInvoice(i));
    });

    return contracts.map(c => {
      const contract = mapContract(c);
      const amendments = amendmentsByContract[c.id] || [];
      const drawdowns = drawdownsByContract[c.id] || [];
      const invoices = invoicesByContract[c.id] || [];

      const currentTotal = contract.basePrice + amendments.reduce((sum, a) => sum + a.deltaPrice, 0);
      const approvedSum = drawdowns.reduce((sum, d) => sum + d.approvedAmount, 0);
      const { invoicedSum, paidSum, overdueSum } = computeInvoiceAggregates(invoices);

      return {
        ...contract,
        amendments,
        drawdowns,
        invoices,
        currentTotal,
        approvedSum,
        remaining: currentTotal - approvedSum,
        invoicedSum,
        paidSum,
        overdueSum,
      };
    });
  },

  getContractById: async (contractId: string): Promise<ContractWithDetails | null> => {
    const { data: contract, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    if (!contract) return null;

    const [amendmentsRes, drawdownsRes, invoicesRes] = await Promise.all([
      supabase.from('contract_amendments').select('*').eq('contract_id', contractId).order('amendment_no', { ascending: true }),
      supabase.from('contract_drawdowns').select('*').eq('contract_id', contractId).order('period', { ascending: true }),
      supabase.from('contract_invoices').select('*').eq('contract_id', contractId).order('due_date', { ascending: true }),
    ]);

    const mappedContract = mapContract(contract);
    const amendments = (amendmentsRes.data || []).map(mapAmendment);
    const drawdowns = (drawdownsRes.data || []).map(mapDrawdown);
    const invoices = (invoicesRes.data || []).map(mapInvoice);

    const currentTotal = mappedContract.basePrice + amendments.reduce((sum, a) => sum + a.deltaPrice, 0);
    const approvedSum = drawdowns.reduce((sum, d) => sum + d.approvedAmount, 0);
    const { invoicedSum, paidSum, overdueSum } = computeInvoiceAggregates(invoices);

    return {
      ...mappedContract,
      amendments,
      drawdowns,
      invoices,
      currentTotal,
      approvedSum,
      remaining: currentTotal - approvedSum,
      invoicedSum,
      paidSum,
      overdueSum,
    };
  },

  createContract: async (contract: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contract> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('contracts')
      .insert({
        project_id: contract.projectId,
        vendor_id: contract.vendorId || null,
        vendor_name: contract.vendorName,
        vendor_ico: contract.vendorIco || null,
        title: contract.title,
        contract_number: contract.contractNumber || null,
        status: contract.status,
        signed_at: contract.signedAt || null,
        effective_from: contract.effectiveFrom || null,
        effective_to: contract.effectiveTo || null,
        completion_date: contract.completionDate || null,
        currency: contract.currency || 'CZK',
        base_price: contract.basePrice,
        retention_percent: contract.retentionPercent ?? null,
        retention_amount: contract.retentionAmount ?? null,
        retention_short_percent: contract.retentionShortPercent ?? null,
        retention_short_amount: contract.retentionShortAmount ?? null,
        retention_short_release_on: contract.retentionShortReleaseOn || null,
        retention_short_status: contract.retentionShortStatus ?? 'held',
        retention_long_percent: contract.retentionLongPercent ?? null,
        retention_long_amount: contract.retentionLongAmount ?? null,
        retention_long_release_on: contract.retentionLongReleaseOn || null,
        retention_long_status: contract.retentionLongStatus ?? 'held',
        site_setup_percent: contract.siteSetupPercent ?? null,
        warranty_months: contract.warrantyMonths || null,
        payment_terms: contract.paymentTerms || null,
        scope_summary: contract.scopeSummary || null,
        source: contract.source,
        source_bid_id: contract.sourceBidId || null,
        document_url: sanitizeDocumentUrl(contract.documentUrl),
        document_storage_path: contract.documentStoragePath || null,
        document_file_name: contract.documentFileName || null,
        document_mime_type: contract.documentMimeType || null,
        document_size: contract.documentSize ?? null,
        extraction_confidence: contract.extractionConfidence || null,
        extraction_json: contract.extractionJson || null,
        owner_id: user.id,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return mapContract(data);
  },

  createContractFromBid: async (
    projectId: string,
    bid: { id: string; subcontractorId: string; companyName: string; price?: string },
    categoryTitle: string
  ): Promise<Contract> => {
    const price = bid.price ? parseFloat(bid.price.replace(/[^\d.-]/g, '')) || 0 : 0;

    return contractService.createContract({
      projectId,
      vendorId: bid.subcontractorId,
      vendorName: bid.companyName,
      title: `SOD - ${categoryTitle} - ${bid.companyName}`,
      status: 'draft',
      currency: 'CZK',
      basePrice: price,
      source: 'from_tender_winner',
      sourceBidId: bid.id,
    });
  },

  updateContract: async (id: string, updates: Partial<Contract>): Promise<void> => {
    const dbUpdates: Record<string, unknown> = {};
    const has = (key: keyof Contract): boolean => Object.prototype.hasOwnProperty.call(updates, key);

    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (has('contractNumber')) dbUpdates.contract_number = updates.contractNumber || null;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (has('signedAt')) dbUpdates.signed_at = updates.signedAt || null;
    if (has('effectiveFrom')) dbUpdates.effective_from = updates.effectiveFrom || null;
    if (has('effectiveTo')) dbUpdates.effective_to = updates.effectiveTo || null;
    if (has('completionDate')) dbUpdates.completion_date = updates.completionDate || null;
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
    if (updates.basePrice !== undefined) dbUpdates.base_price = updates.basePrice;
    if (has('retentionPercent')) dbUpdates.retention_percent = updates.retentionPercent ?? null;
    if (has('retentionAmount')) dbUpdates.retention_amount = updates.retentionAmount ?? null;
    if (has('retentionShortPercent')) dbUpdates.retention_short_percent = updates.retentionShortPercent ?? null;
    if (has('retentionShortAmount')) dbUpdates.retention_short_amount = updates.retentionShortAmount ?? null;
    if (has('retentionShortReleaseOn')) dbUpdates.retention_short_release_on = updates.retentionShortReleaseOn || null;
    if (updates.retentionShortStatus !== undefined) dbUpdates.retention_short_status = updates.retentionShortStatus;
    if (has('retentionLongPercent')) dbUpdates.retention_long_percent = updates.retentionLongPercent ?? null;
    if (has('retentionLongAmount')) dbUpdates.retention_long_amount = updates.retentionLongAmount ?? null;
    if (has('retentionLongReleaseOn')) dbUpdates.retention_long_release_on = updates.retentionLongReleaseOn || null;
    if (updates.retentionLongStatus !== undefined) dbUpdates.retention_long_status = updates.retentionLongStatus;
    if (has('siteSetupPercent')) dbUpdates.site_setup_percent = updates.siteSetupPercent ?? null;
    if (has('warrantyMonths')) dbUpdates.warranty_months = updates.warrantyMonths ?? null;
    if (has('paymentTerms')) dbUpdates.payment_terms = updates.paymentTerms || null;
    if (has('scopeSummary')) dbUpdates.scope_summary = updates.scopeSummary || null;
    if (has('documentUrl')) {
      dbUpdates.document_url = sanitizeDocumentUrl(updates.documentUrl);
    }
    if (has('documentStoragePath')) dbUpdates.document_storage_path = updates.documentStoragePath || null;
    if (has('documentFileName')) dbUpdates.document_file_name = updates.documentFileName || null;
    if (has('documentMimeType')) dbUpdates.document_mime_type = updates.documentMimeType || null;
    if (has('documentSize')) dbUpdates.document_size = updates.documentSize || null;
    if (has('extractionConfidence')) dbUpdates.extraction_confidence = updates.extractionConfidence ?? null;
    if (has('extractionJson')) dbUpdates.extraction_json = updates.extractionJson ?? null;
    if (has('vendorId')) dbUpdates.vendor_id = updates.vendorId || null;
    if (updates.vendorName !== undefined) dbUpdates.vendor_name = updates.vendorName;
    if (has('vendorIco')) dbUpdates.vendor_ico = updates.vendorIco || null;
    if (updates.vendorRating !== undefined) dbUpdates.vendor_rating = updates.vendorRating;
    if (updates.vendorRatingNote !== undefined) dbUpdates.vendor_rating_note = updates.vendorRatingNote;
    if (updates.vendorRatingAt !== undefined) dbUpdates.vendor_rating_at = updates.vendorRatingAt;
    if (updates.vendorRatingBy !== undefined) dbUpdates.vendor_rating_by = updates.vendorRatingBy;

    if (Object.keys(dbUpdates).length === 0) return;

    const { data, error } = await supabase
      .from('contracts')
      .update(dbUpdates)
      .eq('id', id)
      .select('id');
    if (error) throw error;
    if (!data?.length) {
      throw new Error('Smlouva nebyla nalezena nebo nemáte oprávnění ji upravit.');
    }
  },

  updateVendorRating: async (
    id: string,
    update: { rating: number | null; note: string | null },
  ): Promise<void> => {
    const { error } = await supabase.rpc('update_contract_vendor_rating', {
      contract_id_input: id,
      rating_input: update.rating,
      note_input: update.note,
    });
    if (error) throw error;
  },

  deleteContract: async (id: string): Promise<void> => {
    const { data, error } = await supabase
      .from('contracts')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) throw error;
    if (!data?.length) {
      throw new Error('Smlouva nebyla nalezena nebo nemáte oprávnění ji smazat.');
    }
  },

  // ============== AMENDMENTS ==============

  createAmendment: async (amendment: Omit<ContractAmendment, 'id' | 'amendmentNo' | 'createdAt'>): Promise<ContractAmendment> => {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('contract_amendments')
      .insert({
        contract_id: amendment.contractId,
        signed_at: amendment.signedAt || null,
        effective_from: amendment.effectiveFrom || null,
        delta_price: amendment.deltaPrice,
        delta_deadline: amendment.deltaDeadline || null,
        reason: amendment.reason || null,
        document_url: amendment.documentUrl || null,
        extraction_json: amendment.extractionJson || null,
        extraction_confidence: amendment.extractionConfidence || null,
        created_by: user?.id || null,
      })
      .select()
      .single();

    if (error) throw error;
    return mapAmendment(data);
  },

  updateAmendment: async (id: string, updates: Partial<ContractAmendment>): Promise<void> => {
    const dbUpdates: Record<string, unknown> = {};

    if (updates.signedAt !== undefined) dbUpdates.signed_at = updates.signedAt;
    if (updates.effectiveFrom !== undefined) dbUpdates.effective_from = updates.effectiveFrom;
    if (updates.deltaPrice !== undefined) dbUpdates.delta_price = updates.deltaPrice;
    if (updates.deltaDeadline !== undefined) dbUpdates.delta_deadline = updates.deltaDeadline;
    if (updates.reason !== undefined) dbUpdates.reason = updates.reason;
    if (updates.documentUrl !== undefined) dbUpdates.document_url = updates.documentUrl;
    if (updates.documentStoragePath !== undefined) dbUpdates.document_storage_path = updates.documentStoragePath || null;
    if (updates.documentFileName !== undefined) dbUpdates.document_file_name = updates.documentFileName || null;
    if (updates.documentMimeType !== undefined) dbUpdates.document_mime_type = updates.documentMimeType || null;
    if (updates.documentSize !== undefined) dbUpdates.document_size = updates.documentSize || null;
    if (updates.extractionJson !== undefined) dbUpdates.extraction_json = updates.extractionJson;
    if (updates.extractionConfidence !== undefined) dbUpdates.extraction_confidence = updates.extractionConfidence;

    if (Object.keys(dbUpdates).length === 0) return;

    const { error } = await supabase.from('contract_amendments').update(dbUpdates).eq('id', id);
    if (error) throw error;
  },

  deleteAmendment: async (id: string): Promise<void> => {
    const { error } = await supabase.from('contract_amendments').delete().eq('id', id);
    if (error) throw error;
  },

  // ============== DRAWDOWNS ==============

  createDrawdown: async (drawdown: Omit<ContractDrawdown, 'id' | 'createdAt'>): Promise<ContractDrawdown> => {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('contract_drawdowns')
      .insert({
        contract_id: drawdown.contractId,
        period: drawdown.period,
        claimed_amount: drawdown.claimedAmount,
        approved_amount: drawdown.approvedAmount,
        note: drawdown.note || null,
        document_url: drawdown.documentUrl || null,
        extraction_json: drawdown.extractionJson || null,
        extraction_confidence: drawdown.extractionConfidence || null,
        created_by: user?.id || null,
      })
      .select()
      .single();

    if (error) throw error;
    return mapDrawdown(data);
  },

  updateDrawdown: async (id: string, updates: Partial<ContractDrawdown>): Promise<void> => {
    const dbUpdates: Record<string, unknown> = {};

    if (updates.claimedAmount !== undefined) dbUpdates.claimed_amount = updates.claimedAmount;
    if (updates.approvedAmount !== undefined) dbUpdates.approved_amount = updates.approvedAmount;
    if (updates.note !== undefined) dbUpdates.note = updates.note;
    if (updates.period !== undefined) dbUpdates.period = updates.period;
    if (updates.documentUrl !== undefined) dbUpdates.document_url = updates.documentUrl;

    if (Object.keys(dbUpdates).length === 0) return;

    const { error } = await supabase.from('contract_drawdowns').update(dbUpdates).eq('id', id);
    if (error) throw error;
  },

  deleteDrawdown: async (id: string): Promise<void> => {
    const { error } = await supabase.from('contract_drawdowns').delete().eq('id', id);
    if (error) throw error;
  },

  // ============== MARKDOWN VERSIONS ==============

  getMarkdownVersions: async ({
    entityType,
    entityId,
    limit,
  }: {
    entityType: ContractMarkdownEntityType;
    entityId: string;
    limit?: number;
  }): Promise<ContractMarkdownVersion[]> => {
    const response = await invokeAuthedFunction<MarkdownVersionsResponse>(
      'contract-markdown-secure',
      {
        body: {
          action: 'list',
          entityType,
          entityId,
          ...(limit && limit > 0 ? { limit } : {}),
        },
      },
    );

    return (response.versions || []).map((row) => mapMarkdownVersion(row));
  },

  getLatestMarkdownVersion: async ({
    entityType,
    entityId,
  }: {
    entityType: ContractMarkdownEntityType;
    entityId: string;
  }): Promise<ContractMarkdownVersion | null> => {
    const response = await invokeAuthedFunction<MarkdownLatestResponse>(
      'contract-markdown-secure',
      {
        body: {
          action: 'latest',
          entityType,
          entityId,
        },
      },
    );

    return response.version ? mapMarkdownVersion(response.version) : null;
  },

  createMarkdownVersion: async (input: {
    entityType: ContractMarkdownEntityType;
    contractId?: string;
    amendmentId?: string;
    sourceKind: ContractMarkdownSourceKind;
    contentMd: string;
    sourceFileName?: string;
    sourceDocumentUrl?: string;
    ocrProvider?: string;
    ocrModel?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ContractMarkdownVersion> => {
    const response = await invokeAuthedFunction<MarkdownCreateResponse>(
      'contract-markdown-secure',
      {
        body: {
          action: 'create',
          entityType: input.entityType,
          contractId: input.contractId || null,
          amendmentId: input.amendmentId || null,
          sourceKind: input.sourceKind,
          contentMd: input.contentMd,
          sourceFileName: input.sourceFileName || null,
          sourceDocumentUrl: input.sourceDocumentUrl || null,
          ocrProvider: input.ocrProvider || null,
          ocrModel: input.ocrModel || null,
          metadata: input.metadata || {},
        },
      },
    );

    if (!response.version) {
      throw new Error('Nepodařilo se vytvořit verzi markdownu');
    }

    return mapMarkdownVersion(response.version);
  },

  logMarkdownAccess: async ({
    markdownVersionId,
    accessKind,
    accessSource = 'panel',
  }: {
    markdownVersionId: string;
    accessKind: ContractMarkdownAccessKind;
    accessSource?: string;
  }): Promise<void> => {
    await invokeAuthedFunction<{ ok: boolean }>('contract-markdown-secure', {
      body: {
        action: 'log_access',
        markdownVersionId,
        accessKind,
        accessSource,
      },
    });
  },

  // ============== INVOICES ==============

  getInvoicesByContract: async (contractId: string): Promise<ContractInvoice[]> => {
    const { data, error } = await supabase
      .from('contract_invoices')
      .select('*')
      .eq('contract_id', contractId)
      .order('due_date', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapInvoice);
  },

  createInvoice: async (
    invoice: Omit<ContractInvoice, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ContractInvoice> => {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('contract_invoices')
      .insert({
        contract_id: invoice.contractId,
        invoice_number: invoice.invoiceNumber,
        issue_date: invoice.issueDate,
        due_date: invoice.dueDate,
        amount: invoice.amount,
        currency: invoice.currency || 'CZK',
        status: invoice.status || 'issued',
        paid_at: invoice.paidAt || null,
        document_url: invoice.documentUrl || null,
        note: invoice.note || null,
        created_by: user?.id || null,
      })
      .select()
      .single();

    if (error) throw error;
    return mapInvoice(data);
  },

  updateInvoice: async (id: string, updates: Partial<ContractInvoice>): Promise<void> => {
    const dbUpdates: Record<string, unknown> = {};

    if (updates.invoiceNumber !== undefined) dbUpdates.invoice_number = updates.invoiceNumber;
    if (updates.issueDate !== undefined) dbUpdates.issue_date = updates.issueDate;
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.paidAt !== undefined) dbUpdates.paid_at = updates.paidAt || null;
    if (updates.documentUrl !== undefined) dbUpdates.document_url = updates.documentUrl || null;
    if (updates.note !== undefined) dbUpdates.note = updates.note || null;

    if (Object.keys(dbUpdates).length === 0) return;

    const { error } = await supabase.from('contract_invoices').update(dbUpdates).eq('id', id);
    if (error) throw error;
  },

  deleteInvoice: async (id: string): Promise<void> => {
    const { error } = await supabase.from('contract_invoices').delete().eq('id', id);
    if (error) throw error;
  },

  markInvoicePaid: async (id: string, paidAt?: string): Promise<void> => {
    const effectivePaidAt = paidAt || todayIso();
    const { error } = await supabase
      .from('contract_invoices')
      .update({ status: 'paid', paid_at: effectivePaidAt })
      .eq('id', id);
    if (error) throw error;
  },

  uploadContractDocument: async (
    file: File,
    projectId: string,
  ): Promise<Pick<Contract, 'documentStoragePath' | 'documentFileName' | 'documentMimeType' | 'documentSize'>> => {
    const metadata = await validateContractDocument(file);
    const path = `projects/${projectId}/contracts/${crypto.randomUUID()}.${metadata.extension}`;
    const { error } = await supabase.storage
      .from('contract-documents')
      .upload(path, file, {
        cacheControl: '3600',
        contentType: metadata.mimeType,
        upsert: false,
      });
    if (error) {
      console.error('Contract document upload failed:', error.message);
      throw new Error('Dokument smlouvy se nepodařilo bezpečně uložit.');
    }
    return {
      documentStoragePath: path,
      documentFileName: metadata.fileName,
      documentMimeType: metadata.mimeType,
      documentSize: metadata.size,
    };
  },

  deleteContractDocument: async (storagePath: string): Promise<void> => {
    const pathParts = storagePath.split('/');
    const isSafeContractPath =
      pathParts.length === 4
      && pathParts[0] === 'projects'
      && Boolean(pathParts[1])
      && pathParts[2] === 'contracts'
      && /^[A-Za-z0-9-]+\.(pdf|docx)$/i.test(pathParts[3]);
    if (!isSafeContractPath) {
      throw new Error('Neplatná cesta přílohy smlouvy.');
    }
    const { error } = await supabase.storage.from('contract-documents').remove([storagePath]);
    if (error) {
      console.error('Contract document cleanup failed:', error.message);
      throw new Error('Přílohu smlouvy se nepodařilo odstranit z úložiště.');
    }
  },

  uploadAmendmentDocument: async (
    file: File,
    projectId: string,
  ): Promise<Pick<ContractAmendment, 'documentStoragePath' | 'documentFileName' | 'documentMimeType' | 'documentSize'>> => {
    const metadata = await validateContractDocument(file);
    const path = `projects/${projectId}/contracts/${crypto.randomUUID()}.${metadata.extension}`;
    const { error } = await supabase.storage
      .from('contract-documents')
      .upload(path, file, {
        cacheControl: '3600',
        contentType: metadata.mimeType,
        upsert: false,
      });
    if (error) {
      console.error('Amendment document upload failed:', error.message);
      throw new Error('Dokument dodatku se nepodařilo bezpečně uložit.');
    }
    return {
      documentStoragePath: path,
      documentFileName: metadata.fileName,
      documentMimeType: metadata.mimeType,
      documentSize: metadata.size,
    };
  },

  deleteAmendmentDocument: async (storagePath: string): Promise<void> => {
    if (!storagePath.startsWith('projects/') || !storagePath.includes('/contracts/')) return;
    const { error } = await supabase.storage.from('contract-documents').remove([storagePath]);
    if (error) console.error('Amendment document cleanup failed:', error.message);
  },

  getContractDocumentUrl: async (contract: Pick<Contract, 'documentStoragePath' | 'documentUrl'>): Promise<string> => {
    if (contract.documentStoragePath) {
      const { data, error } = await supabase.storage
        .from('contract-documents')
        .createSignedUrl(contract.documentStoragePath, 15 * 60);
      if (error || !data?.signedUrl) {
        throw new Error('Dokument smlouvy se nepodařilo otevřít.');
      }
      return data.signedUrl;
    }
    const legacyUrl = sanitizeDocumentUrl(contract.documentUrl);
    if (!legacyUrl) throw new Error('Smlouva nemá platný dokument.');
    return legacyUrl;
  },

  getAmendmentDocumentUrl: async (
    amendment: Pick<ContractAmendment, 'documentStoragePath' | 'documentUrl'>,
  ): Promise<string> => {
    if (amendment.documentStoragePath) {
      const { data, error } = await supabase.storage
        .from('contract-documents')
        .createSignedUrl(amendment.documentStoragePath, 15 * 60);
      if (error || !data?.signedUrl) {
        throw new Error('Dokument dodatku se nepodařilo otevřít.');
      }
      return data.signedUrl;
    }
    const legacyUrl = sanitizeDocumentUrl(amendment.documentUrl);
    if (!legacyUrl) throw new Error('Dodatek nemá platný dokument.');
    return legacyUrl;
  },

  // ============== RETENTION HELPERS ==============

  releaseRetention: async (
    contractId: string,
    kind: 'short' | 'long',
    releaseOn?: string,
  ): Promise<void> => {
    const column = kind === 'short' ? 'retention_short_status' : 'retention_long_status';
    const dateColumn = kind === 'short' ? 'retention_short_release_on' : 'retention_long_release_on';
    const { error } = await supabase
      .from('contracts')
      .update({
        [column]: 'released',
        [dateColumn]: releaseOn || todayIso(),
      })
      .eq('id', contractId);
    if (error) throw error;
  },

};
