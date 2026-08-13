import * as z from 'zod/v4';
import { ResourceTemplate } from '@modelcontextprotocol/server';
import { getProjectDetail, getProjectSummary, listProjects } from '../data.js';
import { MCP_PERMISSIONS, hasMcpPermissions } from '../scopePolicy.js';
import { resourceJson } from '../core/resourceRuntime.js';
import { toolResultSchema } from '../core/schemas.js';

export const registerProjectsModule = ({ auth, supabase, tools, resources }) => {
  if (hasMcpPermissions(auth.permissions, [MCP_PERMISSIONS.read])) {
    resources.register(
      'tender-flow-project',
      new ResourceTemplate('tenderflow://projects/{projectId}', { list: undefined }),
      {
        title: 'Tender Flow Project Detail',
        description: 'PII-minimized project summary, tenders, bid statistics, contracts, and tender plan visible through RLS.',
        mimeType: 'application/json',
        cacheHint: { cacheScope: 'private', ttlMs: 60_000 },
      },
      { permissions: [MCP_PERMISSIONS.read] },
      async (uri, variables) => {
        const projectId = z.string().min(1).max(100).parse(variables.projectId);
        return resourceJson(uri, await getProjectSummary(supabase, projectId));
      },
      { auditName: 'project' },
    );
  }

  tools.register(
    'tf_list_projects',
    {
      title: 'List Projects',
      description: 'List Tender Flow construction projects visible to the authenticated user. Read-only.',
      inputSchema: { search: z.string().max(200).optional(), limit: z.number().optional() },
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args) => ({ ok: true, data: await listProjects(supabase, args) }),
  );

  tools.register(
    'tf_get_project_summary',
    {
      title: 'Get Project Summary',
      description: 'Get a PII-minimized project summary with tenders, aggregate bid statistics, contracts, and tender plan. Read-only.',
      inputSchema: { projectId: z.string().min(1).max(100) },
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ projectId }) => ({ ok: true, data: await getProjectSummary(supabase, projectId) }),
  );

  tools.register(
    'tf_get_project_detail',
    {
      title: 'Get Project Detail',
      description: 'Get project detail including tenders, bids, contracts, and tender plan. Read-only.',
      inputSchema: { projectId: z.string().min(1) },
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ projectId }) => ({ ok: true, data: await getProjectDetail(supabase, projectId) }),
  );
};
