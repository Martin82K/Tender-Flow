import * as z from 'zod/v4';
import { listContacts } from '../data.js';
import { toolResultSchema } from '../core/schemas.js';

export const registerSubcontractorsModule = ({ supabase, tools }) => {
  tools.register(
    'tf_list_contacts',
    {
      title: 'List Contacts',
      description: 'Find subcontractors/contacts by company, person, or email. Read-only.',
      inputSchema: { search: z.string().max(200).optional(), limit: z.number().optional() },
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args) => ({ ok: true, data: await listContacts(supabase, args) }),
  );
};
