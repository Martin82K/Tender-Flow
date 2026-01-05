/**
 * MCP Bridge Client
 * 
 * Communicates with the local MCP Bridge Server to create folders
 * on the local filesystem.
 */

const MCP_BRIDGE_URL = 'http://localhost:3847';

export interface McpHealthResponse {
    status: 'ok';
    version: string;
    timestamp: string;
}

export interface McpCreateFolderResponse {
    success: boolean;
    path: string;
    created?: boolean;
    error?: string;
}

export interface McpEnsureStructureRequest {
    rootPath: string;
    structure?: Partial<{
        pd: string;
        tenders: string;
        contracts: string;
        realization: string;
        archive: string;
        tendersInquiries: string;
        supplierEmail: string;
        supplierOffer: string;
    }>;
    categories?: Array<{ id: string; title: string }>;
    suppliers?: Record<string, Array<{ id: string; name: string }>>;
}

export interface McpEnsureStructureResponse {
    success: boolean;
    rootPath: string;
    createdCount: number;
    reusedCount: number;
    logs: string[];
    error?: string;
}

export interface McpFolderExistsResponse {
    exists: boolean;
    path: string;
    isDirectory: boolean;
}

/**
 * Check if the MCP Bridge Server is running
 */
export const checkMcpHealth = async (): Promise<McpHealthResponse | null> => {
    try {
        const response = await fetch(`${MCP_BRIDGE_URL}/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
};

/**
 * Check if the MCP Bridge Server is reachable
 */
export const isMcpBridgeRunning = async (): Promise<boolean> => {
    const health = await checkMcpHealth();
    return health?.status === 'ok';
};

/**
 * Create a single folder on the local filesystem
 */
export const mcpCreateFolder = async (folderPath: string): Promise<McpCreateFolderResponse> => {
    const response = await fetch(`${MCP_BRIDGE_URL}/create-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath })
    });

    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
    }
    
    return data;
};

/**
 * Create the full DocHub folder structure on the local filesystem
 */
export const mcpEnsureStructure = async (
    request: McpEnsureStructureRequest
): Promise<McpEnsureStructureResponse> => {
    const response = await fetch(`${MCP_BRIDGE_URL}/ensure-structure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
    });

    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
    }
    
    return data;
};

/**
 * Check if a folder exists on the local filesystem
 */
export const mcpFolderExists = async (folderPath: string): Promise<McpFolderExistsResponse> => {
    const response = await fetch(`${MCP_BRIDGE_URL}/folder-exists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath })
    });

    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
    }
    
    return data;
};

/**
 * Get the MCP Bridge URL (for display in UI)
 */
export const getMcpBridgeUrl = (): string => MCP_BRIDGE_URL;
