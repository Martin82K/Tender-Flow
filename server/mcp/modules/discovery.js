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

export const MCP_ACCESS_INSTRUCTIONS = 'If write tools are missing or a user cannot write, call tf_get_access_status and explain the missing Tender Flow permissions and settings link. Never claim the server has no write support based only on a filtered tools list. After the user enables permissions, refresh tools/list for remote HTTP connections; if the client caches tools, refresh its connector tools. For local stdio connections, restart the MCP process to reload permissions before refreshing tools/list. Do not revoke or recreate OAuth consent just to refresh tools.';

export const registerDiscoveryModule = ({ auth, supabase, tools, resources, includeWriteTools = true }) => {
  const canReadContacts = hasMcpPermissions(auth.permissions, [
    MCP_PERMISSIONS.read,
    MCP_PERMISSIONS.contactsRead,
  ]);

  tools.register(
    'tf_get_access_status',
    {
      title: 'Tender Flow Access Status',
      description: 'Diagnose missing write tools or permissions for this connection. Returns current access, supported write operations and instructions to enable access in Tender Flow settings. Does not grant permissions or change business data.',
      inputSchema: {},
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => {
      const missingWritePermissions = [MCP_PERMISSIONS.read, MCP_PERMISSIONS.write]
        .filter((permission) => !hasMcpPermissions(auth.permissions, [permission]));
      const missingFinancialWritePermissions = [MCP_PERMISSIONS.read, MCP_PERMISSIONS.write, MCP_PERMISSIONS.bidOfferWrite]
        .filter((permission) => !hasMcpPermissions(auth.permissions, [permission]));
      const writeEnabled = includeWriteTools && missingWritePermissions.length === 0;
      const financialWriteEnabled = includeWriteTools && missingFinancialWritePermissions.length === 0;
      return { ok: true, data: {
        clientId: auth.clientId,
        writeEnabled,
        financialWriteEnabled,
        contactsEnabled: canReadContacts,
        writeToolsDisabled: !includeWriteTools,
        missingWritePermissions,
        missingFinancialWritePermissions,
        settingsUrl: 'https://www.tenderflow.cz/app/settings?tab=tools&subTab=mcp',
        supportedWriteOperations: ['create_task', 'update_bid', 'update_bid_offer', 'link_outlook_message'],
        nextSteps: [
          ...(missingWritePermissions.length > 0 ? ['V nastavení AI a MCP přístupů vyberte klienta se shodným clientId a zapněte přepínač Zápisové operace.'] : []),
          ...(!canReadContacts ? ['Pro vyhledání dodavatelů a detailu nabídek povolte také kontaktní údaje na 30 dní.'] : []),
          ...(missingFinancialWritePermissions.includes(MCP_PERMISSIONS.bidOfferWrite) ? ['Pro změnu ceny nabídky je nutný také samostatný finanční zápis.'] : []),
          ...(!includeWriteTools ? ['Lokální MCP je spuštěný v režimu pouze pro čtení; upravte jeho konfiguraci.'] : []),
          'Po změně oprávnění u vzdáleného HTTP připojení obnovte seznam nástrojů (tools/list). U lokálního stdio MCP nejprve restartujte proces, aby načetl nová oprávnění. Pokud klient drží starý katalog, použijte jeho aktualizaci nástrojů; neodvolávejte kvůli tomu OAuth souhlas.',
          'Zápis stále vyžaduje oprávnění ke konkrétní stavbě. Business změny připravte, ukažte rozdíl a proveďte až po výslovném potvrzení uživatele.',
        ],
      } };
    },
  );

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
