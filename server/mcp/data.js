import { createClient } from '@supabase/supabase-js';
import { getSupabaseMcpSecretKey, getSupabaseUrl } from './supabaseAuth.js';
import { deriveMcpBackendProof } from './backendProof.js';

let mcpClientSequence = 0;

export const createUserSupabaseClient = (accessToken) => {
  const secretKey = getSupabaseMcpSecretKey();
  return createClient(getSupabaseUrl(), secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `tender-flow-mcp-${mcpClientSequence += 1}`,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-tenderflow-mcp-proof': deriveMcpBackendProof(secretKey),
      },
    },
  });
};

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

const normalizedIdentifier = (value) => {
  const normalized = String(value || '').trim();
  return normalized || null;
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
    .select('id,demand_category_id,subcontractor_id,price,price_display,notes,status,contracted')
    .order('created_at', { ascending: false })
    .limit(limit(input.limit, 30, 100));

  if (input.categoryId) query = query.eq('demand_category_id', input.categoryId);
  if (categoryIds) query = query.in('demand_category_id', categoryIds);
  if (input.winnersOnly) query = query.eq('contracted', true);

  const { data, error } = await query;
  if (error) throw error;
  const rows = data || [];
  const subcontractorIds = [...new Set(
    rows.map((row) => row.subcontractor_id).filter(Boolean),
  )];
  let subcontractorsById = new Map();
  if (subcontractorIds.length > 0) {
    const { data: subcontractors, error: subcontractorsError } = await supabase
      .from('subcontractors')
      .select('id,company_name,contact_person_name,email,phone')
      .in('id', subcontractorIds);
    if (subcontractorsError) throw subcontractorsError;
    subcontractorsById = new Map(
      (subcontractors || []).map((subcontractor) => [subcontractor.id, subcontractor]),
    );
  }
  return rows.map((row) => {
    const subcontractor = subcontractorsById.get(row.subcontractor_id);
    return {
      id: row.id,
      tenderId: row.demand_category_id,
      subcontractorId: row.subcontractor_id,
      companyName: subcontractor?.company_name || null,
      contactPerson: subcontractor?.contact_person_name || null,
      email: subcontractor?.email || null,
      phone: subcontractor?.phone || null,
      price: row.price || null,
      priceDisplay: row.price_display || null,
      notes: row.notes || null,
      status: row.status || null,
      contracted: Boolean(row.contracted),
    };
  });
};

export const linkOutlookMessage = async (supabase, input) => {
  const { data, error } = await supabase.rpc('link_mcp_outlook_message', {
    bid_id_input: normalizedIdentifier(input.bidId),
    outlook_immutable_id_input: normalizedIdentifier(input.outlookImmutableId),
    internet_message_id_input: normalizedIdentifier(input.internetMessageId),
    conversation_id_input: normalizedIdentifier(input.conversationId),
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Outlook message link was not created.');
  return {
    bidId: String(row.bid_id),
    projectId: String(row.project_id),
    tenderId: String(row.tender_id),
    linked: Boolean(row.linked),
  };
};

export const matchOutlookReply = async (supabase, input = {}) => {
  const { data, error } = await supabase.rpc('match_mcp_outlook_reply', {
    outlook_immutable_id_input: normalizedIdentifier(input.outlookImmutableId),
    internet_message_id_input: normalizedIdentifier(input.internetMessageId),
    in_reply_to_internet_message_id_input: normalizedIdentifier(input.inReplyToInternetMessageId),
    conversation_id_input: normalizedIdentifier(input.conversationId),
  });
  if (error) throw error;
  return (data || []).map((row) => ({
    bidId: String(row.bid_id),
    projectId: String(row.project_id),
    projectName: String(row.project_name),
    tenderId: String(row.tender_id),
    tenderTitle: String(row.tender_title),
    companyName: row.company_name ? String(row.company_name) : null,
    bidStatus: row.bid_status ? String(row.bid_status) : null,
    matchType: String(row.match_type),
  }));
};

export const changeBidStatus = async (supabase, input) => {
  const { data, error } = await supabase.rpc('change_mcp_bid_status', {
    bid_id_input: normalizedIdentifier(input.bidId),
    status_input: normalizedIdentifier(input.status),
    expected_status_input: normalizedIdentifier(input.expectedStatus),
    dry_run_input: Boolean(input.dryRun),
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Bid status change did not return a result.');
  return {
    bidId: String(row.bid_id),
    projectId: String(row.project_id),
    tenderId: String(row.tender_id),
    previousStatus: String(row.previous_status),
    status: String(row.status),
    changed: Boolean(row.changed),
  };
};

export const changeBidOffer = async (supabase, input) => {
  const { data, error } = await supabase.rpc('change_mcp_bid_offer', {
    bid_id_input: normalizedIdentifier(input.bidId),
    price_excluding_vat_input: input.totalPriceExcludingVat,
    notes_appendix_input: normalizedIdentifier(input.notesAppendix),
    selection_round_input: input.selectionRound ?? null,
    expected_updated_at_input: normalizedIdentifier(input.expectedUpdatedAt),
    dry_run_input: Boolean(input.dryRun),
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Bid offer update did not return a result.');
  return {
    bidId: String(row.bid_id),
    projectId: String(row.project_id),
    tenderId: String(row.tender_id),
    previousPrice: row.previous_price == null ? null : Number(row.previous_price),
    price: Number(row.price),
    previousNotes: row.previous_notes == null ? null : String(row.previous_notes),
    notes: row.notes == null ? null : String(row.notes),
    selectionRound: Number(row.selection_round),
    expectedUpdatedAt: String(row.expected_updated_at),
    changed: Boolean(row.changed),
  };
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
      .select('id,demand_category_id,subcontractor_id,price,price_display,notes,status,contracted,subcontractors(company_name,contact_person_name,email,phone)')
      .in('demand_category_id', categoryIds)
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
      tenderId: row.demand_category_id,
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

const PROJECT_SUMMARY_LIMITS = Object.freeze({
  tenders: 200,
  tenderPlan: 200,
  contracts: 100,
  bids: 500,
});

const emptyBidStats = () => ({
  bidCount: 0,
  contractedBidCount: 0,
  pricedBidCount: 0,
  minPrice: null,
  maxPrice: null,
});

const buildBidStatsByTender = (rows) => {
  const statsByTender = new Map();
  for (const row of rows) {
    const tenderId = String(row.demand_category_id || '');
    if (!tenderId) continue;
    const stats = statsByTender.get(tenderId) || emptyBidStats();
    stats.bidCount += 1;
    if (row.contracted) stats.contractedBidCount += 1;
    const price = Number(row.price);
    if (Number.isFinite(price)) {
      stats.pricedBidCount += 1;
      stats.minPrice = stats.minPrice == null ? price : Math.min(stats.minPrice, price);
      stats.maxPrice = stats.maxPrice == null ? price : Math.max(stats.maxPrice, price);
    }
    statsByTender.set(tenderId, stats);
  }
  return statsByTender;
};

export const getProjectSummary = async (supabase, projectId) => {
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
      .order('created_at', { ascending: false })
      .limit(PROJECT_SUMMARY_LIMITS.tenders),
    supabase
      .from('tender_plans')
      .select('id,name,date_from,date_to,category_id')
      .eq('project_id', projectId)
      .order('date_from', { ascending: true })
      .limit(PROJECT_SUMMARY_LIMITS.tenderPlan),
    supabase
      .from('contracts')
      .select('id,title,vendor_name,contract_number,status,base_price,signed_at,effective_from,effective_to,source_bid_id')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(PROJECT_SUMMARY_LIMITS.contracts),
  ]);

  if (projectRes.error) throw projectRes.error;
  if (!projectRes.data) throw new Error('Project not found.');
  if (categoriesRes.error) throw categoriesRes.error;
  if (plansRes.error) throw plansRes.error;
  if (contractsRes.error) throw contractsRes.error;

  const categories = categoriesRes.data || [];
  const categoryIds = categories.map((row) => row.id);
  let bids = [];
  if (categoryIds.length > 0) {
    const bidsRes = await supabase
      .from('bids')
      .select('id,demand_category_id,price,status,contracted')
      .in('demand_category_id', categoryIds)
      .limit(PROJECT_SUMMARY_LIMITS.bids);
    if (bidsRes.error) throw bidsRes.error;
    bids = bidsRes.data || [];
  }
  const statsByTender = buildBidStatsByTender(bids);

  return {
    project: {
      id: projectRes.data.id,
      name: projectRes.data.name,
      location: projectRes.data.location || null,
      status: projectRes.data.status || null,
      finishDate: projectRes.data.finish_date || null,
      investor: projectRes.data.investor || null,
      organizationId: projectRes.data.organization_id || null,
    },
    tenders: categories.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status || null,
      deadline: row.deadline || null,
      realizationStart: row.realization_start || null,
      realizationEnd: row.realization_end || null,
      budgetDisplay: row.budget_display || null,
      planBudget: nullableNumber(row.plan_budget),
      bidStats: statsByTender.get(String(row.id)) || emptyBidStats(),
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
      basePrice: nullableNumber(row.base_price) ?? 0,
      signedAt: row.signed_at || null,
      effectiveFrom: row.effective_from || null,
      effectiveTo: row.effective_to || null,
      sourceBidId: row.source_bid_id || null,
    })),
    potentiallyTruncated: {
      tenders: categories.length >= PROJECT_SUMMARY_LIMITS.tenders,
      tenderPlan: (plansRes.data || []).length >= PROJECT_SUMMARY_LIMITS.tenderPlan,
      contracts: (contractsRes.data || []).length >= PROJECT_SUMMARY_LIMITS.contracts,
      bids: bids.length >= PROJECT_SUMMARY_LIMITS.bids,
    },
  };
};

const MCP_TASK_SELECT = [
  'id',
  'title',
  'note',
  'due_at',
  'reminder_at',
  'priority',
  'project_id',
  'related_entity_type',
  'related_entity_id',
  'parent_task_id',
  'todo_project_id',
  'completed',
  'completed_at',
  'archived_at',
  'created_at',
  'updated_at',
].join(',');

const mapMcpTask = (row) => ({
  id: row.id,
  title: row.title,
  note: row.note || null,
  dueAt: row.due_at || null,
  reminderAt: row.reminder_at || null,
  priority: nullableNumber(row.priority),
  projectId: row.project_id || null,
  relatedEntity: row.related_entity_type && row.related_entity_id
    ? { type: row.related_entity_type, id: row.related_entity_id }
    : null,
  parentTaskId: row.parent_task_id || null,
  todoProjectId: row.todo_project_id || null,
  completed: Boolean(row.completed),
  completedAt: row.completed_at || null,
  archivedAt: row.archived_at || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const listMcpTasks = async (supabase, input = {}) => {
  let query = supabase
    .from('tasks')
    .select(MCP_TASK_SELECT)
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit(input.limit, 30, 100));

  if (typeof input.completed === 'boolean') query = query.eq('completed', input.completed);
  if (input.projectId) query = query.eq('project_id', input.projectId);
  if (!input.includeArchived) query = query.is('archived_at', null);
  const search = normalizeSearch(input.search);
  if (search) query = query.or(`title.ilike.%${search}%,note.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapMcpTask);
};

export const getMcpTask = async (supabase, taskId) => {
  const { data, error } = await supabase
    .from('tasks')
    .select(MCP_TASK_SELECT)
    .eq('id', taskId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Task not found.');
  return mapMcpTask(data);
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

export const buildSearchResults = async (supabase, query, options = {}) => {
  const includeContacts = options.includeContacts === true;
  const [projects, tenders, tasks, contacts] = await Promise.all([
    listProjects(supabase, { search: query, limit: 6 }),
    listTenders(supabase, { limit: 6 }),
    listMcpTasks(supabase, { search: query, completed: false, limit: 6 }),
    includeContacts ? listContacts(supabase, { search: query, limit: 6 }) : [],
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
    ...tasks.map((item) => ({
      id: `task:${item.id}`,
      title: `Úkol: ${item.title}`,
      url: '/app/tasks',
      metadata: { type: 'task', taskId: item.id, projectId: item.projectId },
    })),
    ...contacts.map((item) => ({
      id: `contact:${item.id}`,
      title: `Kontakt: ${item.companyName}`,
      url: item.url,
      metadata: { type: 'contact', contactId: item.id, region: item.region },
    })),
  ].slice(0, 12);
};
