import * as z from 'zod/v4';
import { listMcpTasks } from '../data.js';
import { MCP_PERMISSIONS, hasMcpPermissions } from '../scopePolicy.js';
import { resourceJson } from '../core/resourceRuntime.js';
import { toolResultSchema } from '../core/schemas.js';

export const registerTasksModule = ({ auth, supabase, tools, resources }) => {
  if (hasMcpPermissions(auth.permissions, [MCP_PERMISSIONS.read])) {
    resources.register(
      'tender-flow-open-tasks',
      'tenderflow://tasks/open',
      {
        title: 'Tender Flow Open Tasks',
        description: 'Open, non-archived tasks owned by the authenticated user.',
        mimeType: 'application/json',
        cacheHint: { cacheScope: 'private', ttlMs: 30_000 },
      },
      { permissions: [MCP_PERMISSIONS.read] },
      async (uri) => resourceJson(uri, await listMcpTasks(supabase, {
        completed: false,
        includeArchived: false,
        limit: 50,
      })),
      { auditName: 'open-tasks' },
    );
  }

  tools.register(
    'tf_list_tasks',
    {
      title: 'List Personal Tasks',
      description: 'List tasks owned by the authenticated user without external sync or provider error metadata. Read-only.',
      inputSchema: {
        search: z.string().max(200).optional(),
        projectId: z.string().max(100).optional(),
        completed: z.boolean().optional(),
        includeArchived: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args) => ({ ok: true, data: await listMcpTasks(supabase, args) }),
  );
};
