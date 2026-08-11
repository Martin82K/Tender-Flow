import * as z from 'zod/v4';
import {
  buildSearchResults,
  getMcpTask,
  getProjectSummary,
  listContacts,
} from '../data.js';
import {
  MCP_OAUTH_SCOPES,
  MCP_PERMISSIONS,
  hasMcpPermissions,
} from '../scopePolicy.js';
import { resourceJson } from '../core/resourceRuntime.js';
import { toolResultSchema } from '../core/schemas.js';

const searchOutputSchema = z.object({
  results: z.array(z.object({
    id: z.string(),
    title: z.string(),
    url: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })),
});

export const registerDiscoveryModule = ({ auth, supabase, tools, resources }) => {
  const canReadContacts = hasMcpPermissions(auth.permissions, [
    MCP_PERMISSIONS.read,
    MCP_PERMISSIONS.contactsRead,
  ]);

  resources.register(
    'tender-flow-catalog',
    'tenderflow://catalog',
    {
      title: 'Tender Flow MCP Catalog',
      description: 'Available Tender Flow resource families and OAuth scopes.',
      mimeType: 'application/json',
      cacheHint: { cacheScope: 'private', ttlMs: 300_000 },
    },
    { oauthScopes: [MCP_OAUTH_SCOPES.identity] },
    async (uri) => resourceJson(uri, {
        protocolVersion: '2026-07-28',
        resources: [
          'tenderflow://projects/{projectId}',
          'tenderflow://organizations/{organizationId}/contracts/overview',
          'tenderflow://tasks/open',
        ],
        oauthScopes: MCP_OAUTH_SCOPES,
      permissions: MCP_PERMISSIONS,
    }),
    { auditName: 'catalog' },
  );

  tools.register(
    'search',
    {
      title: 'Tender Flow Search',
      description: 'Search Tender Flow projects, tenders, and personal tasks. Contact results are included only when the client has the dedicated contacts permission.',
      inputSchema: {
        query: z.string().min(1).max(500).describe('Search text.'),
      },
      outputSchema: searchOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ query }) => ({
      results: await buildSearchResults(supabase, query, { includeContacts: canReadContacts }),
    }),
    { action: 'search' },
  );

  tools.register(
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
    async ({ id }) => {
      const parts = id.split(':');
      if (parts[0] === 'project' && parts[1]) {
        const summary = await getProjectSummary(supabase, parts[1]);
        return { ok: true, data: { id, title: summary.project.name, text: JSON.stringify(summary, null, 2), url: `/app/project/${parts[1]}` } };
      }
      if (parts[0] === 'tender' && parts[1] && parts[2]) {
        const summary = await getProjectSummary(supabase, parts[1]);
        const tender = summary.tenders.find((item) => item.id === parts[2]);
        return { ok: Boolean(tender), data: { id, title: tender?.title || 'Tender', text: JSON.stringify({ project: summary.project, tender }, null, 2), url: `/app/project/${parts[1]}?tab=pipeline&categoryId=${parts[2]}` } };
      }
      if (parts[0] === 'task' && parts[1]) {
        const task = await getMcpTask(supabase, parts[1]);
        return { ok: true, data: { id, title: task.title, text: JSON.stringify(task, null, 2), url: '/app/tasks' } };
      }
      if (parts[0] === 'contact' && parts[1] && canReadContacts) {
        const contacts = await listContacts(supabase, { limit: 20 });
        const contact = contacts.find((item) => item.id === parts[1]);
        return { ok: Boolean(contact), data: { id, title: contact?.companyName || 'Contact', text: JSON.stringify(contact, null, 2), url: '/app/contacts' } };
      }
      return { ok: false, error: 'Unknown fetch id.' };
    },
    { action: 'fetch' },
  );
};
