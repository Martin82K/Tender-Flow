import * as http from 'http';
import * as crypto from 'crypto';

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
    jsonrpc: '2.0';
    id?: JsonRpcId;
    method: string;
    params?: any;
};

type JsonRpcResponse = {
    jsonrpc: '2.0';
    id: JsonRpcId;
    result?: any;
    error?: { code: number; message: string; data?: any };
};

type McpTool = {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
        additionalProperties?: boolean;
    };
};

type McpDataProvider = {
    isConfigured: () => boolean;
    listProjects: (input?: { search?: string }) => Promise<Array<{ id: string; name: string; location?: string; status?: string; finishDate?: string | null }>>;
    listTenders: (input?: { projectId?: string }) => Promise<Array<{
        id: string;
        title: string;
        projectId?: string;
        status?: string;
        deadline?: string | null;
        realizationStart?: string | null;
        realizationEnd?: string | null;
        budgetDisplay?: string | null;
        planBudget?: number | null;
    }>>;
    getSchedule: (input: { projectId: string }) => Promise<any>;
    getTenderPlan: (input: { projectId: string }) => Promise<any>;
};

type McpServerHandle = {
    port: number;
    sseUrl: string;
    close: () => Promise<void>;
};

type TokenInfo = {
    aud?: string;
    audience?: string;
    scope?: string;
    expires_in?: string;
    email?: string;
};

const MCP_PATH_PREFIX = '/tf-mcp';
const SSE_PATH = `${MCP_PATH_PREFIX}/sse`;
const MESSAGE_PATH = `${MCP_PATH_PREFIX}/message`;

const TOKEN_CACHE = new Map<string, { expiresAt: number; info: TokenInfo }>();
let currentProjectId: string | null = null;
let currentAuthToken: string | null = null;
let currentServerInfo: { port: number; sseUrl: string } | null = null;
let currentProvider: McpDataProvider | null = null;

const tools: McpTool[] = [
    {
        name: 'tf_list_projects',
        description: 'List construction projects (stavby).',
        inputSchema: {
            type: 'object',
            properties: {
                search: { type: 'string', description: 'Optional text filter.' },
            },
            additionalProperties: false,
        },
    },
    {
        name: 'tf_list_tenders',
        description: 'List tenders (vyberova rizeni).',
        inputSchema: {
            type: 'object',
            properties: {
                projectId: { type: 'string', description: 'Optional project id filter.' },
            },
            additionalProperties: false,
        },
    },
    {
        name: 'tf_get_schedule',
        description: 'Get schedule (harmonogram) for a project.',
        inputSchema: {
            type: 'object',
            properties: {
                projectId: { type: 'string' },
            },
            required: ['projectId'],
            additionalProperties: false,
        },
    },
    {
        name: 'tf_get_tender_plan',
        description: 'Get tender plan (plan VR) for a project.',
        inputSchema: {
            type: 'object',
            properties: {
                projectId: { type: 'string' },
            },
            required: ['projectId'],
            additionalProperties: false,
        },
    },
];

const createEmptyProvider = (): McpDataProvider => ({
    isConfigured: () => false,
    listProjects: async () => [],
    listTenders: async () => [],
    getSchedule: async () => ({ items: [] }),
    getTenderPlan: async () => ({ items: [] }),
});

const getSupabaseConfig = () => {
    const url = process.env.VITE_SUPABASE_URL || '';
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
    if (!url || !anonKey) {
        throw new Error('Missing Supabase configuration.');
    }
    return { url, anonKey };
};

const requireAuthToken = () => {
    if (!currentAuthToken) {
        throw new Error('Missing user session token.');
    }
    return currentAuthToken;
};

const callFunction = async <T>(name: string, body?: unknown): Promise<T> => {
    const { url, anonKey } = getSupabaseConfig();
    const token = requireAuthToken();
    const endpoint = `${url}/functions/v1/${name}`;
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            apikey: anonKey,
            Authorization: `Bearer ${token}`,
            'content-type': 'application/json',
        },
        body: JSON.stringify(body ?? {}),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Function error ${response.status}`);
    }
    return (await response.json()) as T;
};

const createSupabaseProvider = (): McpDataProvider => {
    return {
        isConfigured: () => {
            return !!(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY && currentAuthToken);
        },
        listProjects: async (input) => {
            const res = await callFunction<{ items: any[] }>('mcp-list-projects', {
                search: input?.search || null,
            });
            return (res.items || []).map((item) => ({
                id: item.id,
                name: item.name,
                location: item.location || '',
                status: item.status || null,
                finishDate: item.finishDate || null,
            }));
        },
        listTenders: async (input) => {
            const res = await callFunction<{ items: any[] }>('mcp-list-tenders', {
                projectId: input?.projectId || null,
            });
            return (res.items || []).map((item) => ({
                id: item.id,
                projectId: item.projectId,
                title: item.title,
                status: item.status || null,
                deadline: item.deadline || null,
                realizationStart: item.realizationStart || null,
                realizationEnd: item.realizationEnd || null,
                budgetDisplay: item.budgetDisplay || null,
                planBudget: item.planBudget || null,
            }));
        },
        getSchedule: async (input) => {
            const projectId = input.projectId;
            return await callFunction('mcp-get-schedule', { projectId });
        },
        getTenderPlan: async (input) => {
            const projectId = input.projectId;
            const res = await callFunction<{ items: any[] }>('mcp-get-tender-plan', { projectId });
            return (res.items || []).map((item) => ({
                id: item.id,
                name: item.name,
                dateFrom: item.dateFrom || null,
                dateTo: item.dateTo || null,
                categoryId: item.categoryId || null,
            }));
        },
    };
};

const sendJson = (res: http.ServerResponse, statusCode: number, body: any) => {
    const payload = JSON.stringify(body);
    res.writeHead(statusCode, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(payload).toString(),
    });
    res.end(payload);
};

const sendSse = (res: http.ServerResponse, event: string, data: any) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
};

const readJsonBody = async (req: http.IncomingMessage): Promise<any> => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    if (chunks.length === 0) return null;
    const raw = Buffer.concat(chunks).toString('utf-8');
    return JSON.parse(raw);
};

const getRequiredClientId = (): string | null => {
    return (
        process.env.GOOGLE_OAUTH_CLIENT_ID_DESKTOP ||
        process.env.VITE_GOOGLE_OAUTH_CLIENT_ID_DESKTOP ||
        null
    );
};

const getTokenInfo = async (token: string): Promise<TokenInfo> => {
    const cached = TOKEN_CACHE.get(token);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.info;
    }

    const url = `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`;
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
        throw new Error('Invalid Google access token');
    }
    const info = (await response.json()) as TokenInfo;
    const expiresInSeconds = info.expires_in ? Number(info.expires_in) : 300;
    const expiresAt = Date.now() + Math.max(30, expiresInSeconds) * 1000;
    TOKEN_CACHE.set(token, { expiresAt, info });
    return info;
};

const authorizeRequest = async (req: http.IncomingMessage): Promise<TokenInfo | null> => {
    const requiredClientId = getRequiredClientId();
    if (!requiredClientId) {
        return null;
    }

    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
        throw new Error('Missing Authorization header');
    }
    const token = match[1];
    const info = await getTokenInfo(token);
    const audience = info.aud || info.audience || '';
    if (audience && audience !== requiredClientId) {
        throw new Error('Invalid token audience');
    }
    return info;
};

const setCorsHeaders = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const origin = req.headers.origin || '*';
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
    res.setHeader('access-control-allow-headers', 'content-type,authorization,mcp-session-id');
};

export const startMcpServer = async (options?: {
    dataProvider?: McpDataProvider;
}): Promise<McpServerHandle> => {
    const dataProvider = options?.dataProvider ?? createSupabaseProvider();
    currentProvider = dataProvider;
    const sessions = new Map<string, http.ServerResponse>();

    const server = http.createServer(async (req, res) => {
        if (!req.url) {
            res.writeHead(404);
            res.end();
            return;
        }

        const url = new URL(req.url, 'http://127.0.0.1');
        setCorsHeaders(req, res);

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        if (url.pathname === `${MCP_PATH_PREFIX}/health`) {
            sendJson(res, 200, {
                status: 'ok',
                sse: SSE_PATH,
                message: MESSAGE_PATH,
            });
            return;
        }

        try {
            await authorizeRequest(req);
        } catch (error) {
            sendJson(res, 401, { error: (error as Error).message });
            return;
        }

        if (req.method === 'GET' && url.pathname === SSE_PATH) {
            const sessionId = crypto.randomUUID();
            sessions.set(sessionId, res);

            res.writeHead(200, {
                'content-type': 'text/event-stream',
                'cache-control': 'no-cache',
                connection: 'keep-alive',
                'mcp-session-id': sessionId,
            });

            const address = server.address();
            const port = typeof address === 'object' && address ? address.port : 0;
            const endpoint = `http://127.0.0.1:${port}${MESSAGE_PATH}`;
            sendSse(res, 'endpoint', { uri: endpoint, sessionId });
            sendSse(res, 'ready', { ok: true });

            const keepAlive = setInterval(() => {
                res.write(': ping\n\n');
            }, 15000);

            req.on('close', () => {
                clearInterval(keepAlive);
                sessions.delete(sessionId);
            });
            return;
        }

        if (req.method === 'POST' && url.pathname === MESSAGE_PATH) {
            const sessionId =
                (req.headers['mcp-session-id'] as string | undefined) ||
                url.searchParams.get('sessionId') ||
                '';
            const sse = sessions.get(sessionId);
            if (!sse) {
                sendJson(res, 400, { error: 'Invalid or missing session id' });
                return;
            }

            let payload: JsonRpcRequest;
            try {
                payload = (await readJsonBody(req)) as JsonRpcRequest;
            } catch (error) {
                sendJson(res, 400, { error: 'Invalid JSON payload' });
                return;
            }

            const reply = async (message: JsonRpcResponse) => {
                sendSse(sse, 'message', message);
            };

            const respond = async (result: any) => {
                if (payload.id === undefined || payload.id === null) return;
                await reply({ jsonrpc: '2.0', id: payload.id, result });
            };

            const respondError = async (code: number, message: string, data?: any) => {
                if (payload.id === undefined || payload.id === null) return;
                await reply({ jsonrpc: '2.0', id: payload.id, error: { code, message, data } });
            };

            try {
                switch (payload.method) {
                    case 'initialize': {
                        await respond({
                            protocolVersion: '2024-11-05',
                            serverInfo: {
                                name: 'Tender Flow MCP',
                                version: '0.1.0',
                            },
                            capabilities: {
                                tools: { listChanged: false },
                                resources: { listChanged: false },
                            },
                        });
                        break;
                    }
                    case 'tools/list': {
                        await respond({ tools });
                        break;
                    }
                    case 'tools/call': {
                        const name = payload.params?.name as string | undefined;
                        const args = payload.params?.arguments || {};
                        const effectiveProjectId = args.projectId || currentProjectId;

                        if (!name) {
                            await respondError(-32602, 'Missing tool name');
                            break;
                        }

                        if (!dataProvider.isConfigured()) {
                            await respond({
                                content: [
                                    {
                                        type: 'text',
                                        text: 'Data provider is not configured. Connect MCP to your Tender Flow data source.',
                                    },
                                ],
                                isError: true,
                            });
                            break;
                        }

                        if (name === 'tf_list_projects') {
                            const items = await dataProvider.listProjects(args);
                            await respond({ content: [{ type: 'text', text: JSON.stringify(items, null, 2) }] });
                            break;
                        }
                        if (name === 'tf_list_tenders') {
                            const items = await dataProvider.listTenders({
                                ...args,
                                projectId: args.projectId || currentProjectId,
                            });
                            await respond({ content: [{ type: 'text', text: JSON.stringify(items, null, 2) }] });
                            break;
                        }
                        if (name === 'tf_get_schedule') {
                            if (!effectiveProjectId) {
                                await respondError(-32602, 'Missing projectId and no current project context.');
                                break;
                            }
                            const schedule = await dataProvider.getSchedule({ ...args, projectId: effectiveProjectId });
                            await respond({ content: [{ type: 'text', text: JSON.stringify(schedule, null, 2) }] });
                            break;
                        }
                        if (name === 'tf_get_tender_plan') {
                            if (!effectiveProjectId) {
                                await respondError(-32602, 'Missing projectId and no current project context.');
                                break;
                            }
                            const plan = await dataProvider.getTenderPlan({ ...args, projectId: effectiveProjectId });
                            await respond({ content: [{ type: 'text', text: JSON.stringify(plan, null, 2) }] });
                            break;
                        }

                        await respondError(-32601, `Unknown tool: ${name}`);
                        break;
                    }
                    case 'resources/list': {
                        await respond({ resources: [] });
                        break;
                    }
                    case 'resources/read': {
                        await respondError(-32601, 'No resources available');
                        break;
                    }
                    default: {
                        await respondError(-32601, `Unknown method: ${payload.method}`);
                        break;
                    }
                }
            } catch (error) {
                await respondError(-32603, (error as Error).message);
            }

            sendJson(res, 200, { ok: true });
            return;
        }

        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('Not found');
    });

    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const sseUrl = `http://127.0.0.1:${port}${SSE_PATH}`;
    currentServerInfo = { port, sseUrl };

    return {
        port,
        sseUrl,
        close: async () =>
            new Promise<void>((resolve) => {
                server.close(() => resolve());
            }),
    };
};

export const setMcpCurrentProjectId = (projectId: string | null): void => {
    currentProjectId = projectId || null;
};

export const setMcpAuthToken = (token: string | null): void => {
    currentAuthToken = token || null;
};

export const getMcpStatus = () => {
    return {
        port: currentServerInfo?.port ?? null,
        sseUrl: currentServerInfo?.sseUrl ?? null,
        currentProjectId,
        hasAuthToken: !!currentAuthToken,
        isConfigured: currentProvider?.isConfigured() ?? false,
    };
};
