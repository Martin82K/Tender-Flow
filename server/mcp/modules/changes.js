import * as z from 'zod/v4';
import { changeBidOffer, changeBidStatus } from '../data.js';
import { toolResultSchema } from '../core/schemas.js';

export const KANBAN_WRITE_INSTRUCTIONS = 'To move a supplier bid card in the Tender Flow kanban, first call tf_prepare_bid_status_change. To write a total offer price excluding VAT and append offer conditions, use tf_prepare_bid_offer_update when its dedicated financial-write permission makes it available. Show the before/after diff to the user, then use tf_confirm_change and tf_execute_change only after explicit confirmation.';

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

const bidOfferUpdateFieldsSchema = z.object({
  bidId: z.string().trim().min(1).max(100),
  totalPriceExcludingVat: z.number().finite().positive().max(1_000_000_000_000),
  currency: z.literal('CZK').optional(),
  additionalInformation: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  sourceReference: z.string().trim().min(1).max(500).optional(),
  selectionRound: z.number().int().min(0).max(3).optional(),
}).strict();

const updateBidOfferProposalSchema = bidOfferUpdateFieldsSchema.extend({
  type: z.literal('update_bid_offer'),
});

const prepareBidOfferUpdateSchema = bidOfferUpdateFieldsSchema;

const storedUpdateBidOfferProposalSchema = updateBidOfferProposalSchema.extend({
  expectedUpdatedAt: z.string().min(1).max(100),
  notesAppendix: z.string().max(5000).nullable(),
}).strict();

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

const buildBidOfferNotesAppendix = (change) => {
  const information = (change.additionalInformation || []).map((item) => item.trim());
  const lines = information.length > 0
    ? ['Cenová nabídka – doplňující informace:', ...information.map((item) => `- ${item}`)]
    : [];
  if (change.sourceReference) lines.push(`Zdroj: ${change.sourceReference.trim()}`);
  return lines.length > 0 ? lines.join('\n') : null;
};

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
  if (change.type === 'update_bid_offer') {
    const notesAppendix = buildBidOfferNotesAppendix(change);
    const preview = await changeBidOffer(supabase, {
      ...change,
      notesAppendix,
      dryRun: true,
    });
    storedChange = {
      ...change,
      currency: 'CZK',
      selectionRound: preview.selectionRound,
      expectedUpdatedAt: preview.expectedUpdatedAt,
      notesAppendix,
    };
    diff = {
      before: {
        bidId: preview.bidId,
        totalPriceExcludingVat: preview.previousPrice,
        currency: 'CZK',
        notes: preview.previousNotes,
      },
      after: {
        bidId: preview.bidId,
        totalPriceExcludingVat: preview.price,
        currency: 'CZK',
        notes: preview.notes,
        selectionRound: preview.selectionRound,
      },
    };
  }
  const supported = ['create_task', 'update_bid', 'update_bid_offer'].includes(change.type);
  const riskLevel = ['update_bid', 'update_bid_offer'].includes(change.type) ? 'high' : supported ? 'medium' : 'high';
  const summary = change.type === 'create_task'
    ? `Vytvořit úkol "${change.title}".`
    : change.type === 'update_bid'
      ? `Změnit stav nabídky ${change.payload.bidId} na ${change.payload.status}.`
      : change.type === 'update_bid_offer'
        ? `Zapsat cenu nabídky bez DPH ${change.totalPriceExcludingVat} CZK na kartu ${change.bidId}.`
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

export const claimProposalExecution = async (supabase, proposal, auth) => {
  const { data: claimed, error } = await supabase
    .from('mcp_change_proposals')
    .update({ status: 'executing' })
    .eq('id', proposal.id)
    .eq('user_id', auth.userId)
    .eq('client_id', auth.clientId)
    .eq('status', 'confirmed')
    .select('*')
    .maybeSingle();

  if (error) throw error;
  if (!claimed) {
    throw new Error('Proposal execution is already in progress or was completed.');
  }
  return claimed;
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
  if (proposal.status === 'executing') {
    const { data: existing, error: existingError } = await supabase
      .from('mcp_idempotency_keys')
      .select('result')
      .eq('user_id', auth.userId)
      .eq('client_id', auth.clientId)
      .eq('proposal_id', proposal.id)
      .eq('idempotency_key', args.idempotencyKey)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing?.result) return { ok: true, data: existing.result };
    throw new Error('Proposal execution is already in progress.');
  }
  if (proposal.status !== 'confirmed') throw new Error(`Proposal is not executable in status ${proposal.status}.`);
  if (!await isExecutionConfirmed(proposal, args)) {
    throw new Error('Invalid execution confirmation.');
  }
  if (new Date(proposal.expires_at).getTime() < Date.now()) throw new Error('Proposal expired.');
  if (!['create_task', 'update_bid', 'update_bid_offer'].includes(proposal.change_type)) {
    throw new Error('Only create_task, status-only update_bid, and update_bid_offer execution are enabled in MCP.');
  }

  const payload = proposal.change_type === 'update_bid'
    ? storedUpdateBidProposalSchema.parse(proposal.change_payload).payload
    : proposal.change_type === 'update_bid_offer'
      ? storedUpdateBidOfferProposalSchema.parse(proposal.change_payload)
    : createTaskProposalSchema.parse(proposal.change_payload);

  const { data: existing, error: existingError } = await supabase
    .from('mcp_idempotency_keys')
    .select('result')
    .eq('user_id', auth.userId)
    .eq('client_id', auth.clientId)
    .eq('proposal_id', proposal.id)
    .eq('idempotency_key', args.idempotencyKey)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.result) return { ok: true, data: existing.result };

  const claimedProposal = await claimProposalExecution(supabase, proposal, auth);

  let result;
  if (claimedProposal.change_type === 'create_task') {
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
    result = { proposalId: claimedProposal.id, status: 'executed', task };
  } else if (claimedProposal.change_type === 'update_bid') {
    const bid = await changeBidStatus(supabase, {
      bidId: payload.bidId,
      status: payload.status,
      expectedStatus: payload.expectedStatus,
      dryRun: false,
    });
    result = { proposalId: claimedProposal.id, status: 'executed', bid };
  } else {
    const bid = await changeBidOffer(supabase, {
      bidId: payload.bidId,
      totalPriceExcludingVat: payload.totalPriceExcludingVat,
      notesAppendix: payload.notesAppendix,
      selectionRound: payload.selectionRound,
      expectedUpdatedAt: payload.expectedUpdatedAt,
      dryRun: false,
    });
    result = { proposalId: claimedProposal.id, status: 'executed', bid };
  }
  const { error: idempotencyError } = await supabase.from('mcp_idempotency_keys').insert({
    user_id: auth.userId,
    client_id: auth.clientId,
    idempotency_key: args.idempotencyKey,
    proposal_id: claimedProposal.id,
    result,
  });
  if (idempotencyError) throw idempotencyError;

  const { data: finalized, error: finalizationError } = await supabase
    .from('mcp_change_proposals')
    .update({
      status: 'executed',
      executed_at: new Date().toISOString(),
      execution_result: result,
      execute_token_hash: null,
    })
    .eq('id', claimedProposal.id)
    .eq('user_id', auth.userId)
    .eq('client_id', auth.clientId)
    .eq('status', 'executing')
    .select('id')
    .maybeSingle();
  if (finalizationError) throw finalizationError;
  if (!finalized) throw new Error('Proposal execution could not be finalized safely.');

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
    'tf_prepare_bid_offer_update',
    {
      title: 'Prepare Supplier Bid Offer Update',
      description: 'Prepare an authorized before/after proposal that writes one total bid price excluding VAT in CZK and appends selected offer conditions to the existing bid notes. It does not change the card until tf_confirm_change and tf_execute_change succeed.',
      inputSchema: prepareBidOfferUpdateSchema,
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => createProposal(supabase, auth, {
      change: { type: 'update_bid_offer', ...args },
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
      description: 'Confirm an existing prepared change by sending the exact confirmation text shown by tf_prepare_change, tf_prepare_bid_status_change, or tf_prepare_bid_offer_update. The same text is required again for execute.',
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
      description: 'Execute a confirmed create_task, status-only update_bid, or update_bid_offer using the exact confirmation text and an idempotency key. Legacy one-time execute tokens remain accepted.',
      inputSchema: executeChangeSchema,
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args) => executeProposal(supabase, auth, args),
    { action: 'execute_write', riskLevel: 'high' },
  );
};
