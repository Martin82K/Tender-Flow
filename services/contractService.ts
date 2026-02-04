import { supabase } from './supabase';
import { Contract, ContractAmendment, ContractDrawdown, ContractWithDetails } from '../types';

// Helper: Map DB row to Contract type
const mapContract = (row: Record<string, unknown>): Contract => ({
  id: row.id as string,
  projectId: row.project_id as string,
  vendorId: row.vendor_id as string | undefined,
  vendorName: row.vendor_name as string,
  title: row.title as string,
  contractNumber: row.contract_number as string | undefined,
  status: row.status as Contract['status'],
  signedAt: row.signed_at as string | undefined,
  effectiveFrom: row.effective_from as string | undefined,
  effectiveTo: row.effective_to as string | undefined,
  currency: row.currency as string,
  basePrice: parseFloat(row.base_price as string) || 0,
  retentionPercent: row.retention_percent ? parseFloat(row.retention_percent as string) : undefined,
  retentionAmount: row.retention_amount ? parseFloat(row.retention_amount as string) : undefined,
  siteSetupPercent: row.site_setup_percent ? parseFloat(row.site_setup_percent as string) : undefined,
  warrantyMonths: row.warranty_months as number | undefined,
  paymentTerms: row.payment_terms as string | undefined,
  scopeSummary: row.scope_summary as string | undefined,
  source: row.source as Contract['source'],
  sourceBidId: row.source_bid_id as string | undefined,
  documentUrl: row.document_url as string | undefined,
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
  extractionJson: row.extraction_json as Record<string, unknown> | undefined,
  extractionConfidence: row.extraction_confidence as number | undefined,
  createdBy: row.created_by as string | undefined,
  createdAt: row.created_at as string | undefined,
});

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

export const contractService = {
  // ============== CONTRACTS ==============

  getContractsByProject: async (projectId: string): Promise<ContractWithDetails[]> => {
    const { data: contracts, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!contracts?.length) return [];

    // Fetch amendments and drawdowns for all contracts
    const contractIds = contracts.map(c => c.id);

    const [amendmentsRes, drawdownsRes] = await Promise.all([
      supabase.from('contract_amendments').select('*').in('contract_id', contractIds).order('amendment_no', { ascending: true }),
      supabase.from('contract_drawdowns').select('*').in('contract_id', contractIds).order('period', { ascending: true }),
    ]);

    const amendmentsByContract: Record<string, ContractAmendment[]> = {};
    const drawdownsByContract: Record<string, ContractDrawdown[]> = {};

    (amendmentsRes.data || []).forEach(a => {
      if (!amendmentsByContract[a.contract_id]) amendmentsByContract[a.contract_id] = [];
      amendmentsByContract[a.contract_id].push(mapAmendment(a));
    });

    (drawdownsRes.data || []).forEach(d => {
      if (!drawdownsByContract[d.contract_id]) drawdownsByContract[d.contract_id] = [];
      drawdownsByContract[d.contract_id].push(mapDrawdown(d));
    });

    return contracts.map(c => {
      const contract = mapContract(c);
      const amendments = amendmentsByContract[c.id] || [];
      const drawdowns = drawdownsByContract[c.id] || [];

      const currentTotal = contract.basePrice + amendments.reduce((sum, a) => sum + a.deltaPrice, 0);
      const approvedSum = drawdowns.reduce((sum, d) => sum + d.approvedAmount, 0);

      return {
        ...contract,
        amendments,
        drawdowns,
        currentTotal,
        approvedSum,
        remaining: currentTotal - approvedSum,
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

    const [amendmentsRes, drawdownsRes] = await Promise.all([
      supabase.from('contract_amendments').select('*').eq('contract_id', contractId).order('amendment_no', { ascending: true }),
      supabase.from('contract_drawdowns').select('*').eq('contract_id', contractId).order('period', { ascending: true }),
    ]);

    const mappedContract = mapContract(contract);
    const amendments = (amendmentsRes.data || []).map(mapAmendment);
    const drawdowns = (drawdownsRes.data || []).map(mapDrawdown);

    const currentTotal = mappedContract.basePrice + amendments.reduce((sum, a) => sum + a.deltaPrice, 0);
    const approvedSum = drawdowns.reduce((sum, d) => sum + d.approvedAmount, 0);

    return {
      ...mappedContract,
      amendments,
      drawdowns,
      currentTotal,
      approvedSum,
      remaining: currentTotal - approvedSum,
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
        title: contract.title,
        contract_number: contract.contractNumber || null,
        status: contract.status,
        signed_at: contract.signedAt || null,
        effective_from: contract.effectiveFrom || null,
        effective_to: contract.effectiveTo || null,
        currency: contract.currency || 'CZK',
        base_price: contract.basePrice,
        retention_percent: contract.retentionPercent || null,
        retention_amount: contract.retentionAmount || null,
        site_setup_percent: contract.siteSetupPercent || null,
        warranty_months: contract.warrantyMonths || null,
        payment_terms: contract.paymentTerms || null,
        scope_summary: contract.scopeSummary || null,
        source: contract.source,
        source_bid_id: contract.sourceBidId || null,
        document_url: contract.documentUrl || null,
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

    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.contractNumber !== undefined) dbUpdates.contract_number = updates.contractNumber;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.signedAt !== undefined) dbUpdates.signed_at = updates.signedAt;
    if (updates.effectiveFrom !== undefined) dbUpdates.effective_from = updates.effectiveFrom;
    if (updates.effectiveTo !== undefined) dbUpdates.effective_to = updates.effectiveTo;
    if (updates.basePrice !== undefined) dbUpdates.base_price = updates.basePrice;
    if (updates.retentionPercent !== undefined) dbUpdates.retention_percent = updates.retentionPercent;
    if (updates.retentionAmount !== undefined) dbUpdates.retention_amount = updates.retentionAmount;
    if (updates.siteSetupPercent !== undefined) dbUpdates.site_setup_percent = updates.siteSetupPercent;
    if (updates.warrantyMonths !== undefined) dbUpdates.warranty_months = updates.warrantyMonths;
    if (updates.paymentTerms !== undefined) dbUpdates.payment_terms = updates.paymentTerms;
    if (updates.scopeSummary !== undefined) dbUpdates.scope_summary = updates.scopeSummary;
    if (updates.documentUrl !== undefined) dbUpdates.document_url = updates.documentUrl;
    if (updates.extractionConfidence !== undefined) dbUpdates.extraction_confidence = updates.extractionConfidence;
    if (updates.extractionJson !== undefined) dbUpdates.extraction_json = updates.extractionJson;
    if (updates.vendorId !== undefined) dbUpdates.vendor_id = updates.vendorId;
    if (updates.vendorName !== undefined) dbUpdates.vendor_name = updates.vendorName;
    if (updates.vendorRating !== undefined) dbUpdates.vendor_rating = updates.vendorRating;
    if (updates.vendorRatingNote !== undefined) dbUpdates.vendor_rating_note = updates.vendorRatingNote;
    if (updates.vendorRatingAt !== undefined) dbUpdates.vendor_rating_at = updates.vendorRatingAt;
    if (updates.vendorRatingBy !== undefined) dbUpdates.vendor_rating_by = updates.vendorRatingBy;

    if (Object.keys(dbUpdates).length === 0) return;

    const { error } = await supabase.from('contracts').update(dbUpdates).eq('id', id);
    if (error) throw error;
  },

  deleteContract: async (id: string): Promise<void> => {
    const { error } = await supabase.from('contracts').delete().eq('id', id);
    if (error) throw error;
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

  // ============== DOCUMENT UPLOAD ==============

  uploadContractDocument: async (file: File, contractId: string): Promise<string> => {
    const fileExt = file.name.split('.').pop() || 'pdf';
    const fileName = `${contractId}/${Date.now()}_${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('contract-documents')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('contract-documents')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  },
};
