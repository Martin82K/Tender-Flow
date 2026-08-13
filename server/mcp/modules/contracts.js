import * as z from 'zod/v4';
import { ResourceTemplate } from '@modelcontextprotocol/server';
import { getContractOverview, listContracts } from '../data.js';
import { MCP_PERMISSIONS, hasMcpPermissions } from '../scopePolicy.js';
import { resourceJson } from '../core/resourceRuntime.js';
import { toolResultSchema } from '../core/schemas.js';

export const registerContractsModule = ({ auth, supabase, tools, resources }) => {
  if (hasMcpPermissions(auth.permissions, [MCP_PERMISSIONS.read])) {
    resources.register(
      'tender-flow-contract-overview',
      new ResourceTemplate(
        'tenderflow://organizations/{organizationId}/contracts/overview',
        { list: undefined },
      ),
      {
        title: 'Tender Flow Contract Overview',
        description: 'Authorized organization contract overview with minimized document metadata.',
        mimeType: 'application/json',
        cacheHint: { cacheScope: 'private', ttlMs: 60_000 },
      },
      { permissions: [MCP_PERMISSIONS.read] },
      async (uri, variables) => resourceJson(uri, await getContractOverview(supabase, {
        organizationId: z.string().uuid().parse(variables.organizationId),
        includeArchived: false,
      })),
      { auditName: 'contract-overview' },
    );
  }

  tools.register(
    'tf_list_contracts',
    {
      title: 'List Contracts',
      description: 'List contracts visible to the authenticated user, optionally filtered by project. Read-only.',
      inputSchema: { projectId: z.string().optional(), limit: z.number().optional() },
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args) => ({ ok: true, data: await listContracts(supabase, args) }),
  );

  tools.register(
    'tf_get_contract_overview',
    {
      title: 'Get Contract Overview',
      description: 'Get the authorized organization contract overview. Uses the same role/project-team scope as Tender Flow and omits raw storage paths. Read-only.',
      inputSchema: {
        organizationId: z.string().uuid().optional(),
        includeArchived: z.boolean().optional(),
      },
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args) => ({ ok: true, data: await getContractOverview(supabase, args) }),
  );
};
