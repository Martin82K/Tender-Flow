import * as z from 'zod/v4';
import { changeBidStatus } from '../data.js';
import { toolResultSchema } from '../core/schemas.js';

export const KANBAN_WRITE_INSTRUCTIONS = 'To move a supplier bid card in the Tender Flow kanban, first call tf_prepare_bid_status_change. Show its before/after diff to the user, then use tf_confirm_change and tf_execute_change only after explicit confirmation.';

const boundedText = (value, max = 500) => String(value || '').trim().slice(0, max);

const createTaskProposalSchema = z.object({
  type: z.literal('create_task'),
  title: z.string().min(1).max(500),
  note: z.string().max(10000).optional(),
  dueAt: z.string().optional(),
  priority: z.number().int().min(1).max(4).optional(),
  projectId: z.string().optional(),
});

const bidStatusSchema = z.enum([
  'contacted',
  'sent',
  'offer',
  'shortlist',
  'sod',
  'rejected',
]);

const updateBidProposalSchema = z.object({
  type: z.literal('update_bid'),
  payload: z.object({
    bidId: z.string().trim().min(1).max(100),
    status: bidStatusSchema,
  }).strict(),
});

const prepareBidStatusChangeSchema = z.object({
  bidId: z.string().trim().min(1).max(100),
  status: bidStatusSchema,
}).strict();

const storedUpdateBidProposalSchema = z.object({
  type: z.literal('update_bid'),
  payload: z.object({
    bidId: z.string().trim().min(1).max(100),
    status: bidStatusSchema,
    expectedStatus: bidStatusSchema,
  }).strict(),
}).strict();

const prepareChangeSchema = z.object({
  change: z.discriminatedUnion('type', [
    createTaskProposalSchema,
    updateBidProposalSchema,
    z.object({
      type: z.enum([
        'create_bid',
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
  confirmationText: z.string().min(1).max(1000).optional(),
  executeToken: z.string().min(20).max(500).optional(),
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

export const createProposal = async (supabase, auth, args) => {
  const change = args.change;
  let storedChange = change;
  let diff = { before: null, after: change };
  if (change.type === 'create_task') {
    await assertProjectVisible(supabase, change.projectId);
  }
  if (change.type === 'update_bid') {
    const preview = await changeBidStatus(supabase, {
      ...change.payload,
      dryRun: true,
    });
    storedChange = {
      ...change,
      payload: {
        ...change.payload,
        expectedStatus: preview.previousStatus,
      },
    };
    diff = {
      before: { bidId: preview.bidId, status: preview.previousStatus },
      after: { bidId: preview.bidId, status: preview.status },
    };
  }
  const supported = ['create_task', 'update_bid'].includes(change.type);
  const riskLevel = change.type === 'update_bid' ? 'high' : supported ? 'medium' : 'high';
  const summary = change.type === 'create_task'
    ? `Vytvořit úkol "${change.title}".`
    : change.type === 'update_bid'
      ? `Změnit stav nabídky ${change.payload.bidId} na ${change.payload.status}.`
      : `Připravit změnu typu ${change.type}; provedení zatím není v MCP povoleno.`;

  const { data, error } = await supabase
    .from('mcp_change_proposals')
    .insert({
      user_id: auth.userId,
      client_id: auth.clientId,
      change_type: change.type,
      change_payload: storedChange,
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
      diff,
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

  const { error: updateError } = await supabase
    .from('mcp_change_proposals')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      execute_token_hash: null,
    })
    .eq('id', proposal.id)
    .eq('status', 'prepared');

  if (updateError) throw updateError;

  return {
    ok: true,
    data: {
      proposalId: proposal.id,
      status: 'confirmed',
      confirmationText: proposal.confirmation_text,
      expiresAt: proposal.expires_at,
      warning: 'Pro execute znovu použij přesný confirmationText a nový idempotencyKey.',
    },
  };
};

export const isExecutionConfirmed = async (proposal, args) => {
  const confirmationMatches = typeof args.confirmationText === 'string'
    && args.confirmationText.trim() === proposal.confirmation_text;
  if (confirmationMatches) return true;
  if (!args.executeToken || !proposal.execute_token_hash) return false;
  return proposal.execute_token_hash === await hashToken(args.executeToken);
};

export const executeProposal = async (supabase, auth, args) => {
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
  if (!await isExecutionConfirmed(proposal, args)) {
    throw new Error('Invalid execution confirmation.');
  }
  if (new Date(proposal.expires_at).getTime() < Date.now()) throw new Error('Proposal expired.');
  if (!['create_task', 'update_bid'].includes(proposal.change_type)) {
    throw new Error('Only create_task and status-only update_bid execution are enabled in MCP.');
  }

  const payload = proposal.change_type === 'update_bid'
    ? storedUpdateBidProposalSchema.parse(proposal.change_payload).payload
    : createTaskProposalSchema.parse(proposal.change_payload);

  const { data: existing } = await supabase
    .from('mcp_idempotency_keys')
    .select('result')
    .eq('user_id', auth.userId)
    .eq('client_id', auth.clientId)
    .eq('idempotency_key', args.idempotencyKey)
    .maybeSingle();
  if (existing?.result) return { ok: true, data: existing.result };

  let result;
  if (proposal.change_type === 'create_task') {
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
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert(taskPayload)
      .select('*')
      .single();
    if (taskError) throw taskError;
    result = { proposalId: proposal.id, status: 'executed', task };
  } else {
    const bid = await changeBidStatus(supabase, {
      bidId: payload.bidId,
      status: payload.status,
      expectedStatus: payload.expectedStatus,
      dryRun: false,
    });
    result = { proposalId: proposal.id, status: 'executed', bid };
  }
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

export const registerChangesModule = ({ auth, supabase, tools, includeWriteTools }) => {
  if (!includeWriteTools) return;

  tools.register(
    'tf_prepare_bid_status_change',
    {
      title: 'Prepare Supplier Bid Status Change',
      description: 'Use this when the user wants to move one supplier bid card to another Tender Flow kanban status. This only prepares an authorized before/after proposal; it does not change the card until tf_confirm_change and tf_execute_change succeed.',
      inputSchema: prepareBidStatusChangeSchema,
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ bidId, status }) => createProposal(supabase, auth, {
      change: { type: 'update_bid', payload: { bidId, status } },
    }),
    { action: 'prepare_write', riskLevel: 'medium' },
  );

  tools.register(
    'tf_prepare_change',
    {
      title: 'Prepare Tender Flow Change',
      description: 'Prepare a proposed Tender Flow write action. Does not mutate business data. Use before any create/update/archive request.',
      inputSchema: prepareChangeSchema,
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => createProposal(supabase, auth, args),
    { action: 'prepare_write', riskLevel: 'medium' },
  );

  tools.register(
    'tf_confirm_change',
    {
      title: 'Confirm Tender Flow Change',
      description: 'Confirm an existing prepared change by sending the exact confirmation text shown by tf_prepare_change or tf_prepare_bid_status_change. The same text is required again for execute.',
      inputSchema: confirmChangeSchema,
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => confirmProposal(supabase, auth, args),
    { action: 'confirm_write', riskLevel: 'high' },
  );

  tools.register(
    'tf_execute_change',
    {
      title: 'Execute Tender Flow Change',
      description: 'Execute a confirmed create_task or status-only update_bid using the exact confirmation text and an idempotency key. Legacy one-time execute tokens remain accepted.',
      inputSchema: executeChangeSchema,
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args) => executeProposal(supabase, auth, args),
    { action: 'execute_write', riskLevel: 'high' },
  );
};
