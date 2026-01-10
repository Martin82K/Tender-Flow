/**
 * File System Service
 * 
 * Unified service that automatically switches between:
 * - Desktop: Native Electron fs (via platformAdapter)
 * - Web: MCP Bridge Server (existing implementation)
 * 
 * This allows the same API to work on both platforms.
 */

import { isDesktop, fileSystemAdapter, watcherAdapter } from './platformAdapter';
import {
    isMcpBridgeRunning,
    mcpCreateFolder,
    mcpDeleteFolder,
    mcpEnsureStructure,
    mcpFolderExists,
    mcpOpenPath,
    mcpPickFolder,
    type McpEnsureStructureRequest,
    type McpEnsureStructureResponse,
} from './mcpBridgeClient';
import type { DocHubStructureV1, DocHubHierarchyItem } from '../utils/docHub';

export interface FileSystemStatus {
    available: boolean;
    mode: 'desktop' | 'mcp' | 'none';
    version?: string;
}

export interface FolderOperationResult {
    success: boolean;
    path?: string;
    error?: string;
}

/**
 * Check if file system operations are available
 */
export async function checkFileSystemStatus(): Promise<FileSystemStatus> {
    // Desktop mode takes priority
    if (isDesktop) {
        return {
            available: true,
            mode: 'desktop',
            version: window.electronAPI?.platform.version,
        };
    }

    // Check MCP Bridge for web
    const mcpRunning = await isMcpBridgeRunning();
    if (mcpRunning) {
        return {
            available: true,
            mode: 'mcp',
        };
    }

    return {
        available: false,
        mode: 'none',
    };
}

/**
 * Open a folder picker dialog
 */
export async function pickFolder(): Promise<{ path?: string; cancelled?: boolean; error?: string }> {
    if (isDesktop) {
        const result = await fileSystemAdapter.selectFolder();
        if (!result) {
            return { cancelled: true };
        }
        return { path: result.path };
    }

    // Web: use MCP
    return mcpPickFolder();
}

/**
 * Check if a folder exists
 */
export async function folderExists(folderPath: string): Promise<boolean> {
    if (isDesktop) {
        // On desktop, we list files and check if any exist
        try {
            const files = await fileSystemAdapter.listFiles(folderPath);
            return true; // If listFiles succeeds, folder exists
        } catch {
            return false;
        }
    }

    // Web: use MCP
    try {
        const result = await mcpFolderExists(folderPath);
        return result.exists;
    } catch {
        return false;
    }
}

/**
 * Create a single folder
 */
export async function createFolder(folderPath: string): Promise<FolderOperationResult> {
    if (isDesktop && window.electronAPI) {
        try {
            // On desktop, we can use Node's fs to create folder
            // This is handled via IPC - we need to add a createFolder handler
            // For now, we'll use the writeFile trick or return unsupported
            // TODO: Add proper createFolder IPC handler
            return {
                success: false,
                error: 'Folder creation not yet implemented for desktop. Use MCP or create manually.',
            };
        } catch (e) {
            return {
                success: false,
                error: e instanceof Error ? e.message : String(e),
            };
        }
    }

    // Web: use MCP
    try {
        const result = await mcpCreateFolder(folderPath);
        return {
            success: result.success,
            path: result.path,
            error: result.error,
        };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
        };
    }
}

/**
 * Delete a folder (within rootPath for safety)
 */
export async function deleteFolder(rootPath: string, folderPath: string): Promise<FolderOperationResult> {
    if (isDesktop) {
        // TODO: Implement desktop folder deletion via IPC
        return {
            success: false,
            error: 'Folder deletion not yet implemented for desktop.',
        };
    }

    // Web: use MCP
    try {
        const result = await mcpDeleteFolder(rootPath, folderPath);
        return {
            success: result.success,
            error: result.error,
        };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
        };
    }
}

/**
 * Ensure DocHub folder structure exists
 */
export async function ensureStructure(
    request: McpEnsureStructureRequest
): Promise<McpEnsureStructureResponse> {
    if (isDesktop) {
        // TODO: Implement desktop structure creation via IPC
        // For now, fallback to MCP if available
        const mcpAvailable = await isMcpBridgeRunning();
        if (mcpAvailable) {
            return mcpEnsureStructure(request);
        }

        return {
            success: false,
            rootPath: request.rootPath,
            createdCount: 0,
            reusedCount: 0,
            logs: ['Desktop structure creation not yet implemented.'],
            error: 'Desktop structure creation not yet implemented.',
        };
    }

    // Web: use MCP
    return mcpEnsureStructure(request);
}

/**
 * Open a path in the system's default viewer/explorer
 */
export async function openPath(path: string): Promise<{ success: boolean; error?: string }> {
    if (isDesktop) {
        try {
            await fileSystemAdapter.openInExplorer(path);
            return { success: true };
        } catch (e) {
            // Try opening as file
            try {
                await fileSystemAdapter.openFile(path);
                return { success: true };
            } catch {
                return {
                    success: false,
                    error: e instanceof Error ? e.message : String(e),
                };
            }
        }
    }

    // Web: use MCP
    return mcpOpenPath(path);
}

/**
 * Open a folder in the system's file explorer
 */
export async function openInExplorer(folderPath: string): Promise<{ success: boolean; error?: string }> {
    if (isDesktop) {
        try {
            await fileSystemAdapter.openInExplorer(folderPath);
            return { success: true };
        } catch (e) {
            return {
                success: false,
                error: e instanceof Error ? e.message : String(e),
            };
        }
    }

    // Web: use MCP openPath
    return mcpOpenPath(folderPath);
}

/**
 * Start watching a folder for changes (desktop only)
 */
export async function startWatching(
    folderPath: string,
    onChange?: (event: string, filePath: string) => void
): Promise<{ success: boolean; unsubscribe?: () => void }> {
    if (!isDesktop) {
        return { success: false };
    }

    try {
        await watcherAdapter.start(folderPath);

        let unsubscribe: (() => void) | undefined;
        if (onChange) {
            unsubscribe = watcherAdapter.onFileChange(onChange);
        }

        return { success: true, unsubscribe };
    } catch (e) {
        return { success: false };
    }
}

/**
 * Stop watching folder changes
 */
export async function stopWatching(): Promise<void> {
    if (isDesktop) {
        await watcherAdapter.stop();
    }
}

// Export type for external use
export type { McpEnsureStructureRequest };
