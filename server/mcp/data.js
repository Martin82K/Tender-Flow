import { createClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl } from './supabaseAuth.js';

let mcpClientSequence = 0;

export const createUserSupabaseClient = (accessToken) =>
  createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `tender-flow-mcp-${mcpClientSequence += 1}`,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

const normalizeSearch = (value) =>
  String(value || '')
    .replace(/[,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const limit = (value, fallback = 8, max = 20) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(Math.floor(parsed), max));
};

const normalizeCurrencyCode = (value) => {
  const upper = String(value || '').trim().toUpperCase();
  if (!upper || upper === 'KČ' || upper === 'KC') return 'CZK';
  return /^[A-Z]{3}$/.test(upper) ? upper : 'CZK';
};

const nullableString = (value) =>
  value == null || value === '' ? null : String(value);

const nullableNumber = (value) => {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const mapContractOverviewAmendments = (value) => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || !item.id) return [];
    return [{
      id: String(item.id),
      amendmentNo: Number(item.amendment_no || 0),
      status: nullableString(item.status),
      signedAt: nullableString(item.signed_at),
      effectiveFrom: nullableString(item.effective_from),
      deltaPrice: Number(item.delta_price || 0),
      hasDocument: Boolean(item.document_url || item.document_storage_path),
      documentFileName: nullableString(item.document_file_name),
    }];
  });
};

const mapContractOverviewRow = (row) => ({
  organizationId: String(row.organization_id),
  projectId: String(row.project_id),
  projectName: String(row.project_name),
  projectStatus: String(row.project_status),
  contractId: String(row.contract_id),
  contractPartner: String(row.contract_partner),
  contractTitle: String(row.contract_title),
  contractNumber: nullableString(row.contract_number),
  contractStatus: String(row.contract_status),
  currency: normalizeCurrencyCode(row.currency),
  basePrice: Number(row.base_price || 0),
  currentTotal: Number(row.current_total || 0),
  approvedDrawdown: Number(row.approved_drawdown || 0),
  remainingAmount: Number(row.remaining_amount || 0),
  retentionPercent: nullableNumber(row.retention_percent),
  retentionShortPercent: nullableNumber(row.retention_short_percent),
  retentionShortAmount: nullableNumber(row.retention_short_amount),
  retentionShortReleaseOn: nullableString(row.retention_short_release_on),
  retentionLongPercent: nullableNumber(row.retention_long_percent),
  retentionLongAmount: nullableNumber(row.retention_long_amount),
  retentionLongReleaseOn: nullableString(row.retention_long_release_on),
  warrantyMonths: nullableNumber(row.warranty_months),
  paymentTerms: nullableString(row.payment_terms),
  signedAt: nullableString(row.signed_at),
  effectiveFrom: nullableString(row.effective_from),
  effectiveTo: nullableString(row.effective_to),
  hasDocument: Boolean(row.document_url || row.document_storage_path),
  documentFileName: nullableString(row.document_file_name),
  amendments: mapContractOverviewAmendments(row.amendments),
});

export const getContractOverview = async (supabase, input = {}) => {
  const { data, error } = await supabase.rpc('get_contract_overview', {
    organization_id_input: input.organizationId || null,
    include_archived: Boolean(input.includeArchived),
  });
  if (error) throw error;
  return (data || []).map(mapContractOverviewRow);
};

export const listProjects = async (supabase, input = {}) => {
  const search = normalizeSearch(input.search || input.query);
  let query = supabase
    .from('projects')
    .select('id,name,location,status,finish_date,investor,organization_id')
    .order('created_at', { ascending: false })
    .limit(limit(input.limit, 12));

  if (search) {
    query = query.or(`name.ilike.%${search}%,location.ilike.%${search}%,investor.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    title: row.name,
    name: row.name,
    location: row.location || null,
    status: row.status || null,
    finishDate: row.finish_date || null,
    investor: row.investor || null,
    url: `/app/project/${encodeURIComponent(row.id)}`,
  }));
};

export const listTenders = async (supabase, input = {}) => {
  let query = supabase
    .from('demand_categories')
    .select('id,project_id,title,status,deadline,realization_start,realization_end,budget_display,plan_budget')
    .order('created_at', { ascending: false })
    .limit(limit(input.limit, 20));

  if (input.projectId) query = query.eq('project_id', input.projectId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    status: row.status || null,
    deadline: row.deadline || null,
    realizationStart: row.realization_start || null,
    realizationEnd: row.realization_end || null,
    budgetDisplay: row.budget_display || null,
    planBudget: row.plan_budget || null,
    url: `/app/project/${encodeURIComponent(row.project_id)}?tab=pipeline&categoryId=${encodeURIComponent(row.id)}`,
  }));
};

export const listContacts = async (supabase, input = {}) => {
  const search = normalizeSearch(input.search || input.query);
  let query = supabase
    .from('subcontractors')
    .select('id,company_name,contact_person_name,email,phone,specialization,region,city,ico,status')
    .order('company_name', { ascending: true })
    .limit(limit(input.limit, 20));

  if (search) {
    query = query.or(`company_name.ilike.%${search}%,contact_person_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    title: row.company_name,
    companyName: row.company_name,
    contactPerson: row.contact_person_name || null,
    email: row.email || null,
    phone: row.phone || null,
    specialization: row.specialization || [],
    region: row.region || null,
    city: row.city || null,
    ico: row.ico || null,
    status: row.status || null,
    url: `/app/contacts`,
  }));
};

const getTenderCategoryIds = async (supabase, projectId) => {
  if (!projectId) return null;
  const { data, error } = await supabase
    .from('demand_categories')
    .select('id')
    .eq('project_id', projectId)
    .limit(200);
  if (error) throw error;
  return (data || []).map((row) => row.id);
};

export const listBids = async (supabase, input = {}) => {
  const categoryIds = await getTenderCategoryIds(supabase, input.projectId);
  if (categoryIds && categoryIds.length === 0) return [];

  let query = supabase
    .from('bids')
    .select('id,category_id,subcontractor_id,price,price_display,notes,status,contracted,subcontractors(company_name,contact_person_name,email,phone)')
    .order('created_at', { ascending: false })
    .limit(limit(input.limit, 30, 100));

  if (input.categoryId) query = query.eq('category_id', input.categoryId);
  if (categoryIds) query = query.in('category_id', categoryIds);
  if (input.winnersOnly) query = query.eq('contracted', true);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    tenderId: row.category_id,
    subcontractorId: row.subcontractor_id,
    companyName: row.subcontractors?.company_name || null,
    contactPerson: row.subcontractors?.contact_person_name || null,
    email: row.subcontractors?.email || null,
    phone: row.subcontractors?.phone || null,
    price: row.price || null,
    priceDisplay: row.price_display || null,
    notes: row.notes || null,
    status: row.status || null,
    contracted: Boolean(row.contracted),
  }));
};

export const listContracts = async (supabase, input = {}) => {
  let query = supabase
    .from('contracts')
    .select('id,project_id,title,vendor_name,contract_number,status,base_price,signed_at,effective_from,effective_to,source_bid_id')
    .order('created_at', { ascending: false })
    .limit(limit(input.limit, 30, 100));

  if (input.projectId) query = query.eq('project_id', input.projectId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    vendorName: row.vendor_name || null,
    contractNumber: row.contract_number || null,
    status: row.status || null,
    basePrice: row.base_price || 0,
    signedAt: row.signed_at || null,
    effectiveFrom: row.effective_from || null,
    effectiveTo: row.effective_to || null,
    sourceBidId: row.source_bid_id || null,
  }));
};

export const listTenderPlan = async (supabase, input = {}) => {
  let query = supabase
    .from('tender_plans')
    .select('id,project_id,name,date_from,date_to,category_id')
    .order('date_from', { ascending: true })
    .limit(limit(input.limit, 50, 100));

  if (input.projectId) query = query.eq('project_id', input.projectId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    dateFrom: row.date_from || null,
    dateTo: row.date_to || null,
    categoryId: row.category_id || null,
  }));
};

export const getProjectDetail = async (supabase, projectId) => {
  if (!projectId) throw new Error('Missing projectId.');

  const [projectRes, categoriesRes, plansRes, contractsRes] = await Promise.all([
    supabase
      .from('projects')
      .select('id,name,location,status,finish_date,investor,organization_id')
      .eq('id', projectId)
      .maybeSingle(),
    supabase
      .from('demand_categories')
      .select('id,title,status,deadline,realization_start,realization_end,budget_display,plan_budget')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
    supabase
      .from('tender_plans')
      .select('id,name,date_from,date_to,category_id')
      .eq('project_id', projectId)
      .order('date_from', { ascending: true }),
    supabase
      .from('contracts')
      .select('id,title,vendor_name,contract_number,status,base_price,signed_at,effective_from,effective_to,source_bid_id')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
  ]);

  if (projectRes.error) throw projectRes.error;
  if (!projectRes.data) throw new Error('Project not found.');
  if (categoriesRes.error) throw categoriesRes.error;
  if (plansRes.error) throw plansRes.error;
  if (contractsRes.error) throw contractsRes.error;

  const categoryIds = (categoriesRes.data || []).map((row) => row.id);
  let bids = [];
  if (categoryIds.length > 0) {
    const bidsRes = await supabase
      .from('bids')
      .select('id,category_id,subcontractor_id,price,price_display,notes,status,contracted,subcontractors(company_name,contact_person_name,email,phone)')
      .in('category_id', categoryIds)
      .limit(200);
    if (bidsRes.error) throw bidsRes.error;
    bids = bidsRes.data || [];
  }

  return {
    project: {
      id: projectRes.data.id,
      name: projectRes.data.name,
      location: projectRes.data.location || null,
      status: projectRes.data.status || null,
      finishDate: projectRes.data.finish_date || null,
      investor: projectRes.data.investor || null,
    },
    tenders: (categoriesRes.data || []).map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status || null,
      deadline: row.deadline || null,
      realizationStart: row.realization_start || null,
      realizationEnd: row.realization_end || null,
      budgetDisplay: row.budget_display || null,
      planBudget: row.plan_budget || null,
    })),
    bids: bids.map((row) => ({
      id: row.id,
      tenderId: row.category_id,
      subcontractorId: row.subcontractor_id,
      companyName: row.subcontractors?.company_name || null,
      contactPerson: row.subcontractors?.contact_person_name || null,
      email: row.subcontractors?.email || null,
      phone: row.subcontractors?.phone || null,
      price: row.price || null,
      priceDisplay: row.price_display || null,
      notes: row.notes || null,
      status: row.status || null,
      contracted: Boolean(row.contracted),
    })),
    tenderPlan: (plansRes.data || []).map((row) => ({
      id: row.id,
      name: row.name,
      dateFrom: row.date_from || null,
      dateTo: row.date_to || null,
      categoryId: row.category_id || null,
    })),
    contracts: (contractsRes.data || []).map((row) => ({
      id: row.id,
      title: row.title,
      vendorName: row.vendor_name || null,
      contractNumber: row.contract_number || null,
      status: row.status || null,
      basePrice: row.base_price || 0,
      signedAt: row.signed_at || null,
      effectiveFrom: row.effective_from || null,
      effectiveTo: row.effective_to || null,
      sourceBidId: row.source_bid_id || null,
    })),
  };
};

export const listUpcomingDeadlines = async (supabase, input = {}) => {
  const days = limit(input.rangeDays, 30, 180);
  const now = new Date();
  const to = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const { data, error } = await supabase
    .from('demand_categories')
    .select('id,project_id,title,deadline,status')
    .gte('deadline', now.toISOString().slice(0, 10))
    .lte('deadline', to.toISOString().slice(0, 10))
    .order('deadline', { ascending: true })
    .limit(50);
  if (error) throw error;
  return data || [];
};

export const buildSearchResults = async (supabase, query) => {
  const [projects, tenders, contacts] = await Promise.all([
    listProjects(supabase, { search: query, limit: 6 }),
    listTenders(supabase, { limit: 6 }),
    listContacts(supabase, { search: query, limit: 6 }),
  ]);

  return [
    ...projects.map((item) => ({
      id: `project:${item.id}`,
      title: `Projekt: ${item.name}`,
      url: item.url,
      metadata: { type: 'project', projectId: item.id, status: item.status },
    })),
    ...tenders
      .filter((item) => !query || item.title.toLowerCase().includes(String(query).toLowerCase()))
      .slice(0, 6)
      .map((item) => ({
        id: `tender:${item.projectId}:${item.id}`,
        title: `VŘ: ${item.title}`,
        url: item.url,
        metadata: { type: 'tender', projectId: item.projectId, tenderId: item.id, status: item.status },
      })),
    ...contacts.map((item) => ({
      id: `contact:${item.id}`,
      title: `Kontakt: ${item.companyName}`,
      url: item.url,
      metadata: { type: 'contact', contactId: item.id, region: item.region },
    })),
  ].slice(0, 12);
};
