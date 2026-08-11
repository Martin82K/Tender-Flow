import * as z from 'zod/v4';
import {
  listBids,
  listTenderPlan,
  listTenders,
  listUpcomingDeadlines,
} from '../data.js';
import { toolResultSchema } from '../core/schemas.js';

export const registerTendersModule = ({ supabase, tools }) => {
  tools.register(
    'tf_list_tenders',
    {
      title: 'List Tenders',
      description: 'List tenders / demand categories, optionally filtered by project. Read-only.',
      inputSchema: { projectId: z.string().optional(), limit: z.number().optional() },
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args) => ({ ok: true, data: await listTenders(supabase, args) }),
  );

  tools.register(
    'tf_list_bids',
    {
      title: 'List Bids',
      description: 'List supplier bids/offers, optionally filtered by project or tender category. Read-only.',
      inputSchema: { projectId: z.string().optional(), categoryId: z.string().optional(), winnersOnly: z.boolean().optional(), limit: z.number().optional() },
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args) => ({ ok: true, data: await listBids(supabase, args) }),
  );

  tools.register(
    'tf_list_winners',
    {
      title: 'List Winning Bids',
      description: 'List contracted/winning supplier bids, optionally filtered by project or tender category. Read-only.',
      inputSchema: { projectId: z.string().optional(), categoryId: z.string().optional(), limit: z.number().optional() },
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args) => ({ ok: true, data: await listBids(supabase, { ...args, winnersOnly: true }) }),
  );

  tools.register(
    'tf_list_tender_plan',
    {
      title: 'List Tender Plan',
      description: 'List tender plan / schedule entries, optionally filtered by project. Read-only.',
      inputSchema: { projectId: z.string().optional(), limit: z.number().optional() },
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args) => ({ ok: true, data: await listTenderPlan(supabase, args) }),
  );

  tools.register(
    'tf_list_upcoming_deadlines',
    {
      title: 'List Upcoming Deadlines',
      description: 'List upcoming tender deadlines for visible projects. Read-only.',
      inputSchema: { rangeDays: z.number().optional() },
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args) => ({ ok: true, data: await listUpcomingDeadlines(supabase, args) }),
  );
};
