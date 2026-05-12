import * as z from 'zod/v4';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createUserSupabaseClient } from './data.js';
import {
  buildSearchResults,
  getProjectDetail,
  listBids,
  listContacts,
  listContracts,
  listProjects,
  listTenderPlan,
  listTenders,
  listUpcomingDeadlines,
} from './data.js';
import { logMcpAuditEvent, summarizeResultForAudit } from './audit.js';
import { checkMcpRateLimit } from './rateLimit.js';
import { getBaseUrl, unauthorizedMcpResponse, jsonResponse } from './response.js';
import { verifyMcpBearerToken } from './supabaseAuth.js';

const textJson = (value, isError = false) => ({
  content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  structuredContent: value,
  isError,
});

const boundedText = (value, max = 500) => String(value || '').trim().slice(0, max);

const toolResultSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
});

const searchOutputSchema = z.object({
  results: z.array(z.object({
    id: z.string(),
    title: z.string(),
    url: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })),
});

const createTaskProposalSchema = z.object({
  type: z.literal('create_task'),
  title: z.string().min(1).max(500),
  note: z.string().max(10000).optional(),
  dueAt: z.string().optional(),
  priority: z.number().int().min(1).max(4).optional(),
  projectId: z.string().optional(),
});

const prepareChangeSchema = z.object({
  change: z.discriminatedUnion('type', [
    createTaskProposalSchema,
    z.object({
      type: z.enum([
        'create_bid',
        'update_bid',
        'create_contact',
        'update_contact',
        'create_note',
        'update_note',
        'archive_entity',
      ]),
      payload: z.record(z.string(), z.unknown()),
    }),
  ]),
  reason: z.string().max(1000).optional(),
});

const confirmChangeSchema = z.object({
  proposalId: z.string().uuid(),
  confirmationText: z.string().min(1).max(1000),
});

const executeChangeSchema = z.object({
  proposalId: z.string().uuid(),
  executeToken: z.string().min(20).max(500),
  idempotencyKey: z.string().min(8).max(200),
});

const makeConfirmationText = (proposal) =>
  `POTVRZUJI MCP ZMĚNU ${proposal.id}: ${proposal.change_type}`;

const hashToken = async (token) => {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const assertProjectVisible = async (supabase, projectId) => {
  if (!projectId) return;
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Project is not visible to the authenticated user.');
};

const createProposal = async (supabase, auth, args) => {
  const change = args.change;
  if (change.type === 'create_task') {
    await assertProjectVisible(supabase, change.projectId);
  }
  const riskLevel = change.type === 'create_task' ? 'medium' : 'high';
  const supported = change.type === 'create_task';
  const summary = supported
    ? `Vytvořit úkol "${change.title}".`
    : `Připravit změnu typu ${change.type}; provedení zatím není v MCP MVP povoleno.`;

  const { data, error } = await supabase
    .from('mcp_change_proposals')
    .insert({
      user_id: auth.userId,
      client_id: auth.clientId,
      change_type: change.type,
      change_payload: change,
      status: 'prepared',
      risk_level: riskLevel,
      summary,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
    .select('*')
    .single();

  if (error) throw error;
  const confirmationText = makeConfirmationText(data);
  await supabase
    .from('mcp_change_proposals')
    .update({ confirmation_text: confirmationText })
    .eq('id', data.id);

  return {
    ok: true,
    data: {
      proposalId: data.id,
      status: 'prepared',
      supported,
      riskLevel,
      summary,
      expiresAt: data.expires_at,
      confirmationText,
      diff: {
        before: null,
        after: change,
      },
      executeNote: supported
        ? 'Zavolej tf_confirm_change s přesným confirmationText. Teprve potom lze provést tf_execute_change.'
        : 'Tento typ změny je ve vzdáleném MCP zatím pouze návrh; proveď ho ručně v aplikaci.',
    },
  };
};

const confirmProposal = async (supabase, auth, args) => {
  const { data: proposal, error } = await supabase
    .from('mcp_change_proposals')
    .select('*')
    .eq('id', args.proposalId)
    .eq('user_id', auth.userId)
    .eq('client_id', auth.clientId)
    .maybeSingle();

  if (error) throw error;
  if (!proposal) throw new Error('Proposal not found.');
  if (proposal.status !== 'prepared') throw new Error(`Proposal is not confirmable in status ${proposal.status}.`);
  if (new Date(proposal.expires_at).getTime() < Date.now()) throw new Error('Proposal expired.');
  if (args.confirmationText.trim() !== proposal.confirmation_text) {
    throw new Error('Confirmation text does not match exactly.');
  }

  const executeToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const executeTokenHash = await hashToken(executeToken);
  const { error: updateError } = await supabase
    .from('mcp_change_proposals')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      execute_token_hash: executeTokenHash,
    })
    .eq('id', proposal.id)
    .eq('status', 'prepared');

  if (updateError) throw updateError;

  return {
    ok: true,
    data: {
      proposalId: proposal.id,
      status: 'confirmed',
      executeToken,
      expiresAt: proposal.expires_at,
      warning: 'Token je jednorázový a krátkodobý. Neposílej ho mimo MCP execute call.',
    },
  };
};

const executeProposal = async (supabase, auth, args) => {
  const tokenHash = await hashToken(args.executeToken);
  const { data: proposal, error } = await supabase
    .from('mcp_change_proposals')
    .select('*')
    .eq('id', args.proposalId)
    .eq('user_id', auth.userId)
    .eq('client_id', auth.clientId)
    .maybeSingle();

  if (error) throw error;
  if (!proposal) throw new Error('Proposal not found.');
  if (proposal.status === 'executed') {
    return { ok: true, data: { proposalId: proposal.id, status: 'executed', result: proposal.execution_result } };
  }
  if (proposal.status !== 'confirmed') throw new Error(`Proposal is not executable in status ${proposal.status}.`);
  if (proposal.execute_token_hash !== tokenHash) throw new Error('Invalid execute token.');
  if (new Date(proposal.expires_at).getTime() < Date.now()) throw new Error('Proposal expired.');
  if (proposal.change_type !== 'create_task') {
    throw new Error('Only create_task execution is enabled in MCP MVP.');
  }

  const payload = proposal.change_payload;
  await assertProjectVisible(supabase, payload.projectId);
  const taskPayload = {
    title: boundedText(payload.title, 500),
    note: payload.note ? boundedText(payload.note, 10000) : null,
    due_at: payload.dueAt || null,
    priority: payload.priority || null,
    project_id: payload.projectId || null,
    related_entity_type: null,
    related_entity_id: null,
    created_by: auth.userId,
  };

  const { data: existing } = await supabase
    .from('mcp_idempotency_keys')
    .select('result')
    .eq('user_id', auth.userId)
    .eq('client_id', auth.clientId)
    .eq('idempotency_key', args.idempotencyKey)
    .maybeSingle();
  if (existing?.result) return { ok: true, data: existing.result };

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert(taskPayload)
    .select('*')
    .single();
  if (taskError) throw taskError;

  const result = { proposalId: proposal.id, status: 'executed', task };
  await supabase.from('mcp_idempotency_keys').insert({
    user_id: auth.userId,
    client_id: auth.clientId,
    idempotency_key: args.idempotencyKey,
    proposal_id: proposal.id,
    result,
  });
  await supabase
    .from('mcp_change_proposals')
    .update({
      status: 'executed',
      executed_at: new Date().toISOString(),
      execution_result: result,
      execute_token_hash: null,
    })
    .eq('id', proposal.id);

  return { ok: true, data: result };
};

const withAudit = (auth, supabase, toolName, action, handler, riskLevel = 'low') => async (args) => {
  try {
    checkMcpRateLimit(auth, toolName, riskLevel);
    const result = await handler(args);
    await logMcpAuditEvent(supabase, {
      userId: auth.userId,
      clientId: auth.clientId,
      toolName,
      action,
      riskLevel,
      success: true,
      requestSummary: args,
      resultSummary: summarizeResultForAudit(result),
    });
    return textJson(result);
  } catch (error) {
    await logMcpAuditEvent(supabase, {
      userId: auth.userId,
      clientId: auth.clientId,
      toolName,
      action,
      riskLevel,
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
      requestSummary: args,
    });
    return textJson({ ok: false, error: error instanceof Error ? error.message : String(error) }, true);
  }
};

export const createTenderFlowMcpServer = (auth, options = {}) => {
  const includeWriteTools = options.includeWriteTools !== false;
  const supabase = createUserSupabaseClient(auth.token);
  const server = new McpServer(
    {
      name: 'Tender Flow MCP',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false },
      },
    },
  );

  server.registerTool(
    'search',
    {
      title: 'Tender Flow Search',
      description: 'Search Tender Flow projects, tenders, contacts, and contract-related records. Use this first for ChatGPT connector and deep research discovery.',
      inputSchema: {
        query: z.string().min(1).max(500).describe('Search text.'),
      },
      outputSchema: searchOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    withAudit(auth, supabase, 'search', 'search', async ({ query }) => ({
      results: await buildSearchResults(supabase, query),
    })),
  );

  server.registerTool(
    'fetch',
    {
      title: 'Tender Flow Fetch',
      description: 'Fetch one Tender Flow search result by id returned from search. Returns citation-friendly JSON text.',
      inputSchema: {
        id: z.string().min(1).max(200).describe('Search result id, for example project:<id> or tender:<projectId>:<tenderId>.'),
      },
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    withAudit(auth, supabase, 'fetch', 'fetch', async ({ id }) => {
      const parts = id.split(':');
      if (parts[0] === 'project' && parts[1]) {
        const detail = await getProjectDetail(supabase, parts[1]);
        return { ok: true, data: { id, title: detail.project.name, text: JSON.stringify(detail, null, 2), url: `/app/project/${parts[1]}` } };
      }
      if (parts[0] === 'tender' && parts[1] && parts[2]) {
        const detail = await getProjectDetail(supabase, parts[1]);
        const tender = detail.tenders.find((item) => item.id === parts[2]);
        return { ok: Boolean(tender), data: { id, title: tender?.title || 'Tender', text: JSON.stringify({ project: detail.project, tender, bids: detail.bids.filter((bid) => bid.tenderId === parts[2]) }, null, 2), url: `/app/project/${parts[1]}?tab=pipeline&categoryId=${parts[2]}` } };
      }
      if (parts[0] === 'contact' && parts[1]) {
        const contacts = await listContacts(supabase, { limit: 20 });
        const contact = contacts.find((item) => item.id === parts[1]);
        return { ok: Boolean(contact), data: { id, title: contact?.companyName || 'Contact', text: JSON.stringify(contact, null, 2), url: '/app/contacts' } };
      }
      return { ok: false, error: 'Unknown fetch id.' };
    }),
  );

  server.registerTool(
    'tf_list_projects',
    {
      title: 'List Projects',
      description: 'List Tender Flow construction projects visible to the authenticated user. Read-only.',
      inputSchema: { search: z.string().max(200).optional(), limit: z.number().optional() },
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    withAudit(auth, supabase, 'tf_list_projects', 'read', async (args) => ({ ok: true, data: await listProjects(supabase, args) })),
  );

  server.registerTool(
    'tf_get_project_detail',
    {
      title: 'Get Project Detail',
      description: 'Get project detail including tenders, bids, contracts, and tender plan. Read-only.',
      inputSchema: { projectId: z.string().min(1) },
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    withAudit(auth, supabase, 'tf_get_project_detail', 'read', async ({ projectId }) => ({ ok: true, data: await getProjectDetail(supabase, projectId) })),
  );

  server.registerTool(
    'tf_list_tenders',
    {
      title: 'List Tenders',
      description: 'List tenders / demand categories, optionally filtered by project. Read-only.',
      inputSchema: { projectId: z.string().optional(), limit: z.number().optional() },
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    withAudit(auth, supabase, 'tf_list_tenders', 'read', async (args) => ({ ok: true, data: await listTenders(supabase, args) })),
  );

  server.registerTool(
    'tf_list_bids',
    {
      title: 'List Bids',
      description: 'List supplier bids/offers, optionally filtered by project or tender category. Read-only.',
      inputSchema: { projectId: z.string().optional(), categoryId: z.string().optional(), winnersOnly: z.boolean().optional(), limit: z.number().optional() },
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    withAudit(auth, supabase, 'tf_list_bids', 'read', async (args) => ({ ok: true, data: await listBids(supabase, args) })),
  );

  server.registerTool(
    'tf_list_winners',
    {
      title: 'List Winning Bids',
      description: 'List contracted/winning supplier bids, optionally filtered by project or tender category. Read-only.',
      inputSchema: { projectId: z.string().optional(), categoryId: z.string().optional(), limit: z.number().optional() },
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    withAudit(auth, supabase, 'tf_list_winners', 'read', async (args) => ({ ok: true, data: await listBids(supabase, { ...args, winnersOnly: true }) })),
  );

  server.registerTool(
    'tf_list_contracts',
    {
      title: 'List Contracts',
      description: 'List contracts visible to the authenticated user, optionally filtered by project. Read-only.',
      inputSchema: { projectId: z.string().optional(), limit: z.number().optional() },
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    withAudit(auth, supabase, 'tf_list_contracts', 'read', async (args) => ({ ok: true, data: await listContracts(supabase, args) })),
  );

  server.registerTool(
    'tf_list_tender_plan',
    {
      title: 'List Tender Plan',
      description: 'List tender plan / schedule entries, optionally filtered by project. Read-only.',
      inputSchema: { projectId: z.string().optional(), limit: z.number().optional() },
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    withAudit(auth, supabase, 'tf_list_tender_plan', 'read', async (args) => ({ ok: true, data: await listTenderPlan(supabase, args) })),
  );

  server.registerTool(
    'tf_list_contacts',
    {
      title: 'List Contacts',
      description: 'Find subcontractors/contacts by company, person, or email. Read-only.',
      inputSchema: { search: z.string().max(200).optional(), limit: z.number().optional() },
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    withAudit(auth, supabase, 'tf_list_contacts', 'read', async (args) => ({ ok: true, data: await listContacts(supabase, args) })),
  );

  server.registerTool(
    'tf_list_upcoming_deadlines',
    {
      title: 'List Upcoming Deadlines',
      description: 'List upcoming tender deadlines for visible projects. Read-only.',
      inputSchema: { rangeDays: z.number().optional() },
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    withAudit(auth, supabase, 'tf_list_upcoming_deadlines', 'read', async (args) => ({ ok: true, data: await listUpcomingDeadlines(supabase, args) })),
  );

  if (!includeWriteTools) {
    return server;
  }

  server.registerTool(
    'tf_prepare_change',
    {
      title: 'Prepare Tender Flow Change',
      description: 'Prepare a proposed Tender Flow write action. Does not mutate business data. Use before any create/update/archive request.',
      inputSchema: prepareChangeSchema,
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withAudit(auth, supabase, 'tf_prepare_change', 'prepare_write', async (args) => createProposal(supabase, auth, args), 'medium'),
  );

  server.registerTool(
    'tf_confirm_change',
    {
      title: 'Confirm Tender Flow Change',
      description: 'Confirm an existing prepared change by sending the exact confirmation text shown by tf_prepare_change. Returns a one-time execute token.',
      inputSchema: confirmChangeSchema,
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withAudit(auth, supabase, 'tf_confirm_change', 'confirm_write', async (args) => confirmProposal(supabase, auth, args), 'high'),
  );

  server.registerTool(
    'tf_execute_change',
    {
      title: 'Execute Tender Flow Change',
      description: 'Execute a confirmed change using a one-time token and idempotency key. MVP executes only create_task.',
      inputSchema: executeChangeSchema,
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    withAudit(auth, supabase, 'tf_execute_change', 'execute_write', async (args) => executeProposal(supabase, auth, args), 'high'),
  );

  return server;
};

export const handleMcpWebRequest = async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
        'access-control-allow-headers': 'authorization,content-type,mcp-session-id,mcp-protocol-version,last-event-id',
        'access-control-expose-headers': 'mcp-session-id,mcp-protocol-version,www-authenticate',
      },
    });
  }

  let auth;
  try {
    auth = await verifyMcpBearerToken(request.headers.get('authorization'), {
      expectedResource: `${getBaseUrl(request)}/api/mcp`,
    });
  } catch (error) {
    return unauthorizedMcpResponse(request, error instanceof Error ? error.message : String(error));
  }

  try {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const server = createTenderFlowMcpServer(auth);
    await server.connect(transport);
    const response = await transport.handleRequest(request, {
      authInfo: {
        token: auth.token,
        clientId: auth.clientId,
        scopes: auth.scopes,
        expiresAt: auth.expiresAt,
        extra: { userId: auth.userId, email: auth.email },
      },
    });
    response.headers.set('access-control-allow-origin', '*');
    response.headers.set('access-control-expose-headers', 'mcp-session-id,mcp-protocol-version,www-authenticate');
    return response;
  } catch (error) {
    return jsonResponse(500, {
      error: 'mcp_server_error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
