/**
 * File System Service
 * 
 * Unified service that automatically switches between:
 * - Desktop: Native Electron fs (via platformAdapter)
 * - Web: not available for direct local filesystem access
 * 
 * This allows the same API to work on both platforms.
 */

import { isDesktop, fileSystemAdapter, watcherAdapter } from './platformAdapter';
import { invokeAuthedFunction } from './functionsClient';
import type { DocHubStructureV1, DocHubHierarchyItem } from '../utils/docHub';
import {
    sanitizeSubcontractorCompanyName,
    validateSubcontractorCompanyName,
} from '../shared/dochub/subcontractorNameRules';
import { logIncident } from './incidentLogger';

export interface FileSystemStatus {
    available: boolean;
    mode: 'desktop' | 'none';
    version?: string;
}

export interface FolderOperationResult {
    success: boolean;
    path?: string;
    error?: string;
}

export interface EnsureStructureRequest {
    rootPath: string;
    projectId?: string;
    structure?: DocHubStructureV1;
    categories?: Array<{ id: string; title: string }>;
    suppliers?: Record<string, Array<{ id: string; name: string }>>;
    hierarchy?: DocHubHierarchyItem[];
}

export interface EnsureStructureResponse {
    success: boolean;
    rootPath: string;
    createdCount: number;
    reusedCount: number;
    logs: string[];
    error?: string;
}

const logFileSystemIncident = async (input: {
    severity: "error" | "warn" | "info";
    code: string;
    message: string;
    action: string;
    operation: string;
    actionStatus: "success" | "error" | "fallback";
    provider?: string;
    projectId?: string;
    categoryId?: string;
    folderPath?: string;
    targetPath?: string;
    reason?: string;
    stack?: string | null;
}): Promise<void> => {
    try {
        await logIncident({
            severity: input.severity,
            source: "renderer",
            category: "storage",
            code: input.code,
            message: input.message,
            stack: input.stack ?? null,
            context: {
                action: input.action,
                operation: input.operation,
                provider: input.provider ?? null,
                project_id: input.projectId ?? null,
                category_id: input.categoryId ?? null,
                folder_path: input.folderPath ?? null,
                target_path: input.targetPath ?? null,
                reason: input.reason ?? null,
                action_status: input.actionStatus,
            },
        });
    } catch {
        // incident logging must not block the primary filesystem flow
    }
};

const getFolderTargetSegment = (pathOrName: string): string => {
    const normalized = pathOrName.trim().replace(/[\\/]+$/, "");
    if (!normalized) return "";
    const segments = normalized.split(/[\\/]/).filter(Boolean);
    return segments[segments.length - 1] || "";
};

const getFolderSegmentValidationError = (pathOrName: string): string | null => {
    const segment = getFolderTargetSegment(pathOrName);
    if (!segment) {
        return "Cilovy nazev slozky je prazdny.";
    }

    const validation = validateSubcontractorCompanyName(segment);
    if (!validation.isValid) {
        const reason = (validation.reason || "").replace(/Nazev firmy/g, "Nazev slozky");
        return `Neplatny nazev slozky "${segment}". ${reason}`.trim();
    }

    return null;
};

const resolveStructureFolderName = (name: string): {
    finalName: string;
    warning?: string;
} => {
    const validation = validateSubcontractorCompanyName(name);
    if (validation.isValid) {
        return { finalName: name };
    }

    const sanitizedResult = sanitizeSubcontractorCompanyName(name);
    const sanitizedValidation = validateSubcontractorCompanyName(sanitizedResult.sanitized);
    if (!sanitizedValidation.isValid) {
        const reason = (validation.reason || "").replace(/Nazev firmy/g, "Nazev slozky");
        throw new Error(`Neplatny nazev slozky "${name}". ${reason}`.trim());
    }

    return {
        finalName: sanitizedResult.sanitized,
        warning: `Nazev slozky "${name}" byl pro filesystem upraven na "${sanitizedResult.sanitized}".`,
    };
};

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
        try {
            const result = await fileSystemAdapter.selectFolder();
            if (!result) {
                return { cancelled: true };
            }
            return { path: result.path };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await logFileSystemIncident({
                severity: "error",
                code: "FS_PICK_FOLDER_FAILED",
                message: `Výběr složky selhal: ${message}`,
                action: "pick_folder",
                operation: "file_system.select_folder",
                actionStatus: "error",
                reason: message,
                stack: error instanceof Error ? error.stack : null,
            });
            return { cancelled: true, error: message };
        }
    }

    const error = 'Výběr složky je dostupný pouze v desktop aplikaci.';
    await logFileSystemIncident({
        severity: "error",
        code: "FS_PICK_FOLDER_UNAVAILABLE",
        message: error,
        action: "pick_folder",
        operation: "file_system.select_folder",
        actionStatus: "error",
        reason: "desktop_only",
    });
    return { cancelled: true, error };
}

/**
 * Check if a folder exists
 */
export async function folderExists(folderPath: string): Promise<boolean> {
    if (isDesktop) {
        // On desktop, we list files and check if any exist
        try {
            await fileSystemAdapter.listFiles(folderPath);
            return true; // If listFiles succeeds, folder exists
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const lowerMessage = message.toLowerCase();
            const isExpectedMissing =
                lowerMessage.includes("enoent") ||
                lowerMessage.includes("not found") ||
                lowerMessage.includes("no such file") ||
                lowerMessage.includes("cannot find");
            if (!isExpectedMissing) {
                await logFileSystemIncident({
                    severity: "error",
                    code: "FS_FOLDER_EXISTS_FAILED",
                    message: `Ověření existence složky selhalo: ${message}`,
                    action: "folder_exists",
                    operation: "file_system.folder_exists",
                    actionStatus: "error",
                    folderPath,
                    reason: message,
                    stack: error instanceof Error ? error.stack : null,
                });
            }
            return false;
        }
    }

    return false;
}

/**
 * Create a single folder
 */
export async function createFolder(pathOrName: string, options?: { provider?: string, projectId?: string, parentId?: string }): Promise<FolderOperationResult> {
    const { provider, projectId, parentId } = options || {};
    const segmentError = getFolderSegmentValidationError(pathOrName);
    if (segmentError) {
        await logFileSystemIncident({
            severity: "error",
            code: "FS_CREATE_FOLDER_INVALID_NAME",
            message: segmentError,
            action: "create_folder",
            operation: "file_system.create_folder",
            actionStatus: "error",
            provider,
            projectId,
            targetPath: pathOrName,
            reason: "validation_failed",
        });
        return { success: false, error: segmentError };
    }

    if (provider === 'gdrive' || provider === 'onedrive_cloud') {
        if (!projectId) {
            const error = 'Missing projectId for cloud create';
            await logFileSystemIncident({
                severity: "error",
                code: "FS_CREATE_FOLDER_MISSING_PROJECT",
                message: error,
                action: "create_folder",
                operation: "file_system.create_folder",
                actionStatus: "error",
                provider,
                targetPath: pathOrName,
                reason: "missing_project_id",
            });
            return { success: false, error };
        }
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
            await logFileSystemIncident({
                severity: "info",
                code: "FS_CREATE_FOLDER_SUCCESS",
                message: `Vytvoření složky uspělo: ${pathOrName}`,
                action: "create_folder",
                operation: "file_system.create_folder",
                actionStatus: "success",
                provider,
                projectId,
                targetPath: pathOrName,
            });
            return { success: true, path: res?.id };
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            await logFileSystemIncident({
                severity: "error",
                code: "FS_CREATE_FOLDER_FAILED",
                message: `Vytvoření složky selhalo: ${message}`,
                action: "create_folder",
                operation: "file_system.create_folder",
                actionStatus: "error",
                provider,
                projectId,
                targetPath: pathOrName,
                reason: message,
                stack: e instanceof Error ? e.stack : null,
            });
            return { success: false, error: message };
        }
    }

    // Desktop / Local
    // pathOrName is full path here
    if (isDesktop && (!provider || provider === 'onedrive')) {
        try {
            const result = await fileSystemAdapter.createFolder(pathOrName);
            if (result.success) {
                await logFileSystemIncident({
                    severity: "info",
                    code: "FS_CREATE_FOLDER_SUCCESS",
                    message: `Vytvoření složky uspělo: ${pathOrName}`,
                    action: "create_folder",
                    operation: "file_system.create_folder",
                    actionStatus: "success",
                    provider: provider ?? "onedrive",
                    projectId,
                    targetPath: pathOrName,
                });
            } else {
                await logFileSystemIncident({
                    severity: "error",
                    code: "FS_CREATE_FOLDER_FAILED",
                    message: `Vytvoření složky selhalo: ${result.error || "Neznámá chyba"}`,
                    action: "create_folder",
                    operation: "file_system.create_folder",
                    actionStatus: "error",
                    provider: provider ?? "onedrive",
                    projectId,
                    targetPath: pathOrName,
                    reason: result.error || "unknown_error",
                });
            }
            return {
                success: result.success,
                path: result.success ? pathOrName : undefined,
                error: result.error,
            };
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            await logFileSystemIncident({
                severity: "error",
                code: "FS_CREATE_FOLDER_FAILED",
                message: `Vytvoření složky selhalo: ${message}`,
                action: "create_folder",
                operation: "file_system.create_folder",
                actionStatus: "error",
                provider: provider ?? "onedrive",
                projectId,
                targetPath: pathOrName,
                reason: message,
                stack: e instanceof Error ? e.stack : null,
            });
            return {
                success: false,
                error: message,
            };
        }
    }

    const error = 'Vytváření lokálních složek je dostupné pouze v desktop aplikaci.';
    await logFileSystemIncident({
        severity: "error",
        code: "FS_CREATE_FOLDER_UNAVAILABLE",
        message: error,
        action: "create_folder",
        operation: "file_system.create_folder",
        actionStatus: "error",
        provider,
        projectId,
        targetPath: pathOrName,
        reason: "desktop_only",
    });
    return {
        success: false,
        error,
    };
}

/**
 * Delete a folder (within rootPath for safety)
 */
export async function deleteFolder(rootPath: string, folderPath: string, options?: { provider?: string, projectId?: string, folderId?: string, categoryId?: string }): Promise<FolderOperationResult> {
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
            await logFileSystemIncident({
                severity: "info",
                code: "FS_DELETE_FOLDER_SUCCESS",
                message: `Smazání složky uspělo: ${folderPath}`,
                action: "delete_folder",
                operation: "file_system.delete_folder",
                actionStatus: "success",
                provider,
                projectId,
                folderPath,
                targetPath: rootPath,
            });
            return { success: true };
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            await logFileSystemIncident({
                severity: "error",
                code: "FS_DELETE_FOLDER_FAILED",
                message: `Smazání složky selhalo: ${message}`,
                action: "delete_folder",
                operation: "file_system.delete_folder",
                actionStatus: "error",
                provider,
                projectId,
                folderPath,
                targetPath: rootPath,
                reason: message,
                stack: e instanceof Error ? e.stack : null,
            });
            return { success: false, error: message };
        }
    }

    if (isDesktop && (!provider || provider === 'onedrive')) {
        try {
            const result = await fileSystemAdapter.deleteFolder(folderPath);
            if (result.success) {
                await logFileSystemIncident({
                    severity: "info",
                    code: "FS_DELETE_FOLDER_SUCCESS",
                    message: `Smazání složky uspělo: ${folderPath}`,
                    action: "delete_folder",
                    operation: "file_system.delete_folder",
                    actionStatus: "success",
                    provider: provider ?? "onedrive",
                    projectId,
                    folderPath,
                    targetPath: rootPath,
                });
            } else {
                await logFileSystemIncident({
                    severity: "error",
                    code: "FS_DELETE_FOLDER_FAILED",
                    message: `Smazání složky selhalo: ${result.error || "Neznámá chyba"}`,
                    action: "delete_folder",
                    operation: "file_system.delete_folder",
                    actionStatus: "error",
                    provider: provider ?? "onedrive",
                    projectId,
                    folderPath,
                    targetPath: rootPath,
                    reason: result.error || "unknown_error",
                });
            }
            return {
                success: result.success,
                error: result.error,
            };
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            await logFileSystemIncident({
                severity: "error",
                code: "FS_DELETE_FOLDER_FAILED",
                message: `Smazání složky selhalo: ${message}`,
                action: "delete_folder",
                operation: "file_system.delete_folder",
                actionStatus: "error",
                provider: provider ?? "onedrive",
                projectId,
                folderPath,
                targetPath: rootPath,
                reason: message,
                stack: e instanceof Error ? e.stack : null,
            });
            return {
                success: false,
                error: message,
            };
        }
    }

    const error = 'Mazání lokálních složek je dostupné pouze v desktop aplikaci.';
    await logFileSystemIncident({
        severity: "error",
        code: "FS_DELETE_FOLDER_UNAVAILABLE",
        message: error,
        action: "delete_folder",
        operation: "file_system.delete_folder",
        actionStatus: "error",
        provider,
        projectId,
        folderPath,
        targetPath: rootPath,
        reason: "desktop_only",
    });
    return {
        success: false,
        error,
    };
}

/**
 * Rename a folder
 */
export async function renameFolder(oldPath: string, newPath: string, options?: { provider?: string, projectId?: string, folderId?: string, newName?: string, categoryId?: string }): Promise<FolderOperationResult> {
    const { provider, projectId, folderId, newName } = options || {};
    const targetName = newName || getFolderTargetSegment(newPath);
    const segmentError = getFolderSegmentValidationError(targetName);
    if (segmentError) {
        await logFileSystemIncident({
            severity: "error",
            code: "FS_RENAME_FOLDER_INVALID_NAME",
            message: segmentError,
            action: "rename_folder",
            operation: "file_system.rename_folder",
            actionStatus: "error",
            provider,
            projectId,
            folderPath: oldPath,
            targetPath: newPath,
            reason: "validation_failed",
        });
        return { success: false, error: segmentError };
    }

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
            await logFileSystemIncident({
                severity: "info",
                code: "FS_RENAME_FOLDER_SUCCESS",
                message: `Přejmenování složky uspělo: ${oldPath} -> ${newPath}`,
                action: "rename_folder",
                operation: "file_system.rename_folder",
                actionStatus: "success",
                provider,
                projectId,
                folderPath: oldPath,
                targetPath: newPath,
            });
            return { success: true };
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            await logFileSystemIncident({
                severity: "error",
                code: "FS_RENAME_FOLDER_FAILED",
                message: `Přejmenování složky selhalo: ${message}`,
                action: "rename_folder",
                operation: "file_system.rename_folder",
                actionStatus: "error",
                provider,
                projectId,
                folderPath: oldPath,
                targetPath: newPath,
                reason: message,
                stack: e instanceof Error ? e.stack : null,
            });
            return { success: false, error: message };
        }
    }

    if (isDesktop && (!provider || provider === 'onedrive')) {
        try {
            const result = await fileSystemAdapter.renameFolder(oldPath, newPath);
            if (result.success) {
                await logFileSystemIncident({
                    severity: "info",
                    code: "FS_RENAME_FOLDER_SUCCESS",
                    message: `Přejmenování složky uspělo: ${oldPath} -> ${newPath}`,
                    action: "rename_folder",
                    operation: "file_system.rename_folder",
                    actionStatus: "success",
                    provider: provider ?? "onedrive",
                    projectId,
                    folderPath: oldPath,
                    targetPath: newPath,
                });
            } else {
                await logFileSystemIncident({
                    severity: "error",
                    code: "FS_RENAME_FOLDER_FAILED",
                    message: `Přejmenování složky selhalo: ${result.error || "Neznámá chyba"}`,
                    action: "rename_folder",
                    operation: "file_system.rename_folder",
                    actionStatus: "error",
                    provider: provider ?? "onedrive",
                    projectId,
                    folderPath: oldPath,
                    targetPath: newPath,
                    reason: result.error || "unknown_error",
                });
            }
            return {
                success: result.success,
                error: result.error,
            };
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            await logFileSystemIncident({
                severity: "error",
                code: "FS_RENAME_FOLDER_FAILED",
                message: `Přejmenování složky selhalo: ${message}`,
                action: "rename_folder",
                operation: "file_system.rename_folder",
                actionStatus: "error",
                provider: provider ?? "onedrive",
                projectId,
                folderPath: oldPath,
                targetPath: newPath,
                reason: message,
                stack: e instanceof Error ? e.stack : null,
            });
            return {
                success: false,
                error: message,
            };
        }
    }

    const error = "Přejmenování složek je dostupné pouze v desktop aplikaci.";
    await logFileSystemIncident({
        severity: "error",
        code: "FS_RENAME_FOLDER_UNAVAILABLE",
        message: error,
        action: "rename_folder",
        operation: "file_system.rename_folder",
        actionStatus: "error",
        provider,
        projectId,
        folderPath: oldPath,
        targetPath: newPath,
        reason: "desktop_only",
    });
    return { success: false, error };
}

/**
 * Ensure DocHub folder structure exists
 */
export async function ensureStructure(
    request: EnsureStructureRequest
): Promise<EnsureStructureResponse> {
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

                const resolvedName = resolveStructureFolderName(finalName);
                if (resolvedName.warning) {
                    logs.push(`! Upozornění: ${resolvedName.warning}`);
                }

                const finalPath = joinPath(parentPath, resolvedName.finalName);
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

            await logFileSystemIncident({
                severity: "info",
                code: "FS_ENSURE_STRUCTURE_SUCCESS",
                message: `Zajištění struktury složek uspělo: ${request.rootPath}`,
                action: "ensure_structure",
                operation: "file_system.ensure_structure",
                actionStatus: "success",
                provider: "onedrive",
                projectId: request.projectId,
                folderPath: request.rootPath,
            });

            return {
                success: true,
                rootPath: request.rootPath,
                createdCount,
                reusedCount,
                logs,
            };
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            await logFileSystemIncident({
                severity: "error",
                code: "FS_ENSURE_STRUCTURE_FAILED",
                message: `Zajištění struktury složek selhalo: ${message}`,
                action: "ensure_structure",
                operation: "file_system.ensure_structure",
                actionStatus: "error",
                provider: "onedrive",
                projectId: request.projectId,
                folderPath: request.rootPath,
                reason: message,
                stack: e instanceof Error ? e.stack : null,
            });
            return {
                success: false,
                rootPath: request.rootPath,
                createdCount,
                reusedCount,
                logs,
                error: message,
            };
        }
    }

    const error = 'Synchronizace lokální struktury je dostupná pouze v desktop aplikaci.';
    await logFileSystemIncident({
        severity: "error",
        code: "FS_ENSURE_STRUCTURE_UNAVAILABLE",
        message: error,
        action: "ensure_structure",
        operation: "file_system.ensure_structure",
        actionStatus: "error",
        projectId: request.projectId,
        folderPath: request.rootPath,
        reason: "desktop_only",
    });
    return {
        success: false,
        rootPath: request.rootPath,
        createdCount: 0,
        reusedCount: 0,
        logs: [],
        error,
    };
}

/**
 * Open a path in the system's default viewer/explorer
 */
export async function openPath(path: string): Promise<{ success: boolean; error?: string }> {
    if (isDesktop) {
        try {
            const explorerResult = await fileSystemAdapter.openInExplorer(path);
            if (explorerResult.success) {
                return { success: true };
            }

            const fileResult = await fileSystemAdapter.openFile(path);
            if (fileResult.success) {
                await logFileSystemIncident({
                    severity: "warn",
                    code: "FS_OPEN_PATH_FALLBACK",
                    message: `Otevření cesty přešlo na otevření souboru: ${path}`,
                    action: "open_path",
                    operation: "file_system.open_path",
                    actionStatus: "fallback",
                    folderPath: path,
                    reason: explorerResult.error || "explorer_failed",
                });
                return { success: true };
            }

            const error = explorerResult.error || fileResult.error || "Neznámá chyba";
            await logFileSystemIncident({
                severity: "error",
                code: "FS_OPEN_PATH_FAILED",
                message: `Otevření cesty selhalo: ${error}`,
                action: "open_path",
                operation: "file_system.open_path",
                actionStatus: "error",
                folderPath: path,
                reason: error,
            });
            return { success: false, error };
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            await logFileSystemIncident({
                severity: "error",
                code: "FS_OPEN_PATH_FAILED",
                message: `Otevření cesty selhalo: ${message}`,
                action: "open_path",
                operation: "file_system.open_path",
                actionStatus: "error",
                folderPath: path,
                reason: message,
                stack: e instanceof Error ? e.stack : null,
            });
            return {
                success: false,
                error: message,
            };
        }
    }

    const error = 'Otevření lokální cesty je dostupné pouze v desktop aplikaci.';
    await logFileSystemIncident({
        severity: "error",
        code: "FS_OPEN_PATH_UNAVAILABLE",
        message: error,
        action: "open_path",
        operation: "file_system.open_path",
        actionStatus: "error",
        folderPath: path,
        reason: "desktop_only",
    });
    return { success: false, error };
}

/**
 * Open a folder in the system's file explorer
 */
export async function openInExplorer(folderPath: string): Promise<{ success: boolean; error?: string }> {
    if (isDesktop) {
        try {
            const result = await fileSystemAdapter.openInExplorer(folderPath);
            if (!result.success) {
                await logFileSystemIncident({
                    severity: "error",
                    code: "FS_OPEN_IN_EXPLORER_FAILED",
                    message: `Otevření složky selhalo: ${result.error || "Neznámá chyba"}`,
                    action: "open_in_explorer",
                    operation: "file_system.open_in_explorer",
                    actionStatus: "error",
                    folderPath,
                    reason: result.error || "unknown_error",
                });
            }
            return result;
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            await logFileSystemIncident({
                severity: "error",
                code: "FS_OPEN_IN_EXPLORER_FAILED",
                message: `Otevření složky selhalo: ${message}`,
                action: "open_in_explorer",
                operation: "file_system.open_in_explorer",
                actionStatus: "error",
                folderPath,
                reason: message,
                stack: e instanceof Error ? e.stack : null,
            });
            return {
                success: false,
                error: message,
            };
        }
    }

    const error = 'Otevření složky je dostupné pouze v desktop aplikaci.';
    await logFileSystemIncident({
        severity: "error",
        code: "FS_OPEN_IN_EXPLORER_UNAVAILABLE",
        message: error,
        action: "open_in_explorer",
        operation: "file_system.open_in_explorer",
        actionStatus: "error",
        folderPath,
        reason: "desktop_only",
    });
    return { success: false, error };
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
export type { EnsureStructureRequest };
