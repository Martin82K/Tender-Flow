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
    if (isDesktop) {
        try {
            const result = await fileSystemAdapter.createFolder(folderPath);
            return {
                success: result.success,
                path: result.success ? folderPath : undefined,
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

            // Build folder list from structure
            const foldersToCreate: string[] = [];

            // Root folder
            foldersToCreate.push(request.rootPath);

            // Basic structure
            if (request.structure) {
                const s = request.structure;
                if (s.pd) foldersToCreate.push(joinPath(request.rootPath, s.pd));
                if (s.tenders) foldersToCreate.push(joinPath(request.rootPath, s.tenders));
                if (s.contracts) foldersToCreate.push(joinPath(request.rootPath, s.contracts));
                if (s.realization) foldersToCreate.push(joinPath(request.rootPath, s.realization));
                if (s.archive) foldersToCreate.push(joinPath(request.rootPath, s.archive));
                if (s.ceniky) foldersToCreate.push(joinPath(request.rootPath, s.ceniky));

                // Extra top-level folders
                if (s.extraTopLevel) {
                    for (const extra of s.extraTopLevel) {
                        foldersToCreate.push(joinPath(request.rootPath, extra));
                    }
                }
            }

            // Category folders (in tenders and contracts)
            if (request.categories && request.structure) {
                const tendersPath = joinPath(request.rootPath, request.structure.tenders || 'Výběrové řízení');
                const contractsPath = joinPath(request.rootPath, request.structure.contracts || 'Smlouvy');

                for (const cat of request.categories) {
                    const catFolder = cat.title;
                    foldersToCreate.push(joinPath(tendersPath, catFolder));
                    foldersToCreate.push(joinPath(contractsPath, catFolder));

                    // Supplier folders under each category
                    const suppliers = request.suppliers?.[cat.id] || [];
                    for (const supplier of suppliers) {
                        foldersToCreate.push(joinPath(tendersPath, catFolder, supplier.name));
                        foldersToCreate.push(joinPath(contractsPath, catFolder, supplier.name));

                        // Extra supplier folders
                        if (request.structure.extraSupplier) {
                            for (const extra of request.structure.extraSupplier) {
                                foldersToCreate.push(joinPath(tendersPath, catFolder, supplier.name, extra));
                                foldersToCreate.push(joinPath(contractsPath, catFolder, supplier.name, extra));
                            }
                        }
                    }
                }
            }

            // Create all folders
            for (const folderPath of foldersToCreate) {
                await ensureFolder(folderPath);
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
