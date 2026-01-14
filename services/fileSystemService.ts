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
import { invokeAuthedFunction } from './functionsClient';
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
export async function createFolder(pathOrName: string, options?: { provider?: string, projectId?: string, parentId?: string }): Promise<FolderOperationResult> {
    const { provider, projectId, parentId } = options || {};

    if (provider === 'gdrive' || provider === 'onedrive_cloud') {
        if (!projectId) return { success: false, error: 'Missing projectId for cloud create' };
        try {
            const res = await invokeAuthedFunction<{ success: boolean, id: string, webUrl?: string }>('dochub-manage-folder', {
                body: {
                    action: 'create',
                    projectId,
                    provider: provider === 'onedrive_cloud' ? 'onedrive' : provider,
                    name: pathOrName,
                    parentId
                }
            });
            return { success: true, path: res?.id };
        } catch (e) {
            return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
    }

    // Desktop / Local / MCP
    // pathOrName is full path here
    if (isDesktop && (!provider || provider === 'onedrive')) {
        try {
            const result = await fileSystemAdapter.createFolder(pathOrName);
            return {
                success: result.success,
                path: result.success ? pathOrName : undefined,
                error: result.error,
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
        const result = await mcpCreateFolder(pathOrName);
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
export async function deleteFolder(rootPath: string, folderPath: string, options?: { provider?: string, projectId?: string, folderId?: string }): Promise<FolderOperationResult> {
    const { provider, projectId, folderId } = options || {};

    if ((provider === 'gdrive' || provider === 'onedrive_cloud') && folderId && projectId) {
        try {
            await invokeAuthedFunction('dochub-manage-folder', {
                body: {
                    action: 'delete',
                    projectId,
                    provider: provider === 'onedrive_cloud' ? 'onedrive' : provider,
                    folderId
                }
            });
            return { success: true };
        } catch (e) {
            return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
    }

    if (isDesktop && (!provider || provider === 'onedrive')) {
        try {
            const result = await fileSystemAdapter.deleteFolder(folderPath);
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
 * Rename a folder
 */
export async function renameFolder(oldPath: string, newPath: string, options?: { provider?: string, projectId?: string, folderId?: string, newName?: string }): Promise<FolderOperationResult> {
    const { provider, projectId, folderId, newName } = options || {};

    if ((provider === 'gdrive' || provider === 'onedrive_cloud') && folderId && projectId && newName) {
        try {
            await invokeAuthedFunction('dochub-manage-folder', {
                body: {
                    action: 'rename',
                    projectId,
                    provider: provider === 'onedrive_cloud' ? 'onedrive' : provider,
                    folderId,
                    newName
                }
            });
            return { success: true };
        } catch (e) {
            return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
    }

    if (isDesktop && (!provider || provider === 'onedrive')) {
        try {
            const result = await fileSystemAdapter.renameFolder(oldPath, newPath);
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

    // MCP does not currently support rename directly, would need to implement in bridge
    // For now, return not supported or fallback
    return { success: false, error: "Rename not supported on MCP yet." };
}

/**
 * Ensure DocHub folder structure exists
 */
export async function ensureStructure(
    request: McpEnsureStructureRequest
): Promise<McpEnsureStructureResponse> {
    if (isDesktop) {
        // Desktop: Create folders directly using native fs
        const logs: string[] = [];
        let createdCount = 0;
        let reusedCount = 0;

        try {
            // Simple path join helper that preserves Windows paths
            const joinPath = (...parts: string[]): string => {
                // Detect if we're on Windows (by checking the first part for drive letters)
                const isWindows = /^[A-Za-z]:/.test(parts[0]);
                const separator = isWindows ? '\\' : '/';

                return parts
                    .join(separator)
                    .replace(/[\\\/]+/g, separator); // Normalize separators
            };

            // Helper function to create a folder
            const ensureFolder = async (folderPath: string): Promise<void> => {
                const exists = await fileSystemAdapter.folderExists(folderPath);
                if (exists) {
                    logs.push(`✓ Složka existuje: ${folderPath}`);
                    reusedCount++;
                } else {
                    const result = await fileSystemAdapter.createFolder(folderPath);
                    if (result.success) {
                        logs.push(`✓ Vytvořeno: ${folderPath}`);
                        createdCount++;
                    } else {
                        logs.push(`✗ Chyba: ${folderPath} - ${result.error}`);
                        throw new Error(`Failed to create folder: ${result.error}`);
                    }
                }
            };

            // Recursive function to process hierarchy items
            const processItem = async (
                item: DocHubHierarchyItem,
                parentPath: string,
                context: { category?: { id: string, title: string }, supplier?: { id: string, name: string } }
            ) => {
                if (!item.enabled) return;

                const currentPath = joinPath(parentPath, item.name);

                // Handle placeholders replacements in the name
                let finalName = item.name;

                // Category placeholder
                if (item.key === 'category' || item.name.includes('{Název VŘ}')) {
                    if (context.category) {
                        finalName = context.category.title;
                    } else {
                        // If we hit a category node but have no category context, we must iterate all categories
                        if (request.categories) {
                            for (const cat of request.categories) {
                                await processItem(item, parentPath, { ...context, category: cat });
                            }
                        }
                        return; // Stop processing this abstract node, we processed instances
                    }
                }

                // Supplier placeholder
                if (item.key === 'supplier' || item.name.includes('{Název dodavatele}')) {
                    if (context.supplier) {
                        finalName = context.supplier.name;
                    } else {
                        // If we hit a supplier node but have no supplier context, we must iterate suppliers for the current category
                        if (context.category && request.suppliers) {
                            const suppliers = request.suppliers[context.category.id] || [];
                            for (const sup of suppliers) {
                                await processItem(item, parentPath, { ...context, supplier: sup });
                            }
                        }
                        return; // Stop processing this abstract node
                    }
                }

                const finalPath = joinPath(parentPath, finalName);
                await ensureFolder(finalPath);

                // Process children
                if (item.children && item.children.length > 0) {
                    for (const child of item.children) {
                        await processItem(child, finalPath, context);
                    }
                }
            };

            // Start processing from root
            // Note: request.hierarchy contains the top-level items (01_PD, 02_Zmeny, etc.)
            // We need to process them relative to rootPath

            // First ensure root exists
            await ensureFolder(request.rootPath);

            if (request.hierarchy) {
                for (const rootItem of request.hierarchy) {
                    await processItem(rootItem, request.rootPath, {});
                }
            } else {
                logs.push('! Upozornění: Žádná hierarchie nebyla předána. Vytvářím pouze kořenovou složku.');
            }

            return {
                success: true,
                rootPath: request.rootPath,
                createdCount,
                reusedCount,
                logs,
            };
        } catch (e) {
            return {
                success: false,
                rootPath: request.rootPath,
                createdCount,
                reusedCount,
                logs,
                error: e instanceof Error ? e.message : String(e),
            };
        }
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


