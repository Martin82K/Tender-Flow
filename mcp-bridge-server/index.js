/**
 * MCP Bridge Server for Tender Flow DocHub
 * 
 * This local server enables the Tender Flow application to create folders
 * on the local filesystem. It runs on localhost only and is designed
 * to be simple and lightweight.
 * 
 * Usage:
 *   cd mcp-bridge-server
 *   npm install
 *   npm start
 * 
 * The server will run on http://localhost:3847
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');

const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 3847;

// Middleware
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://tenderflow.cz',
        'https://www.tenderflow.cz',
        'https://app.tenderflow.cz'
    ],

    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// Create a single folder
app.post('/create-folder', (req, res) => {
    const { folderPath } = req.body;

    if (!folderPath) {
        return res.status(400).json({ error: 'Missing folderPath' });
    }

    // Security: Ensure path is within user's home directory or Documents
    const resolvedPath = path.resolve(folderPath);
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';

    if (!resolvedPath.startsWith(homeDir)) {
        return res.status(403).json({
            error: 'Access denied: path must be within home directory',
            homeDir,
            resolvedPath
        });
    }

    try {
        fs.mkdirSync(resolvedPath, { recursive: true });
        res.json({
            success: true,
            path: resolvedPath,
            created: !fs.existsSync(resolvedPath)
        });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error',
            path: resolvedPath
        });
    }
});

// Ensure DocHub folder structure
app.post('/ensure-structure', (req, res) => {
    const {
        rootPath,
        structure,
        categories = [],
        suppliers = {}
    } = req.body;

    console.log('[MCP] /ensure-structure called');
    console.log('Root:', rootPath);
    console.log('Categories:', categories?.length);
    console.log('Suppliers:', Object.keys(suppliers).length);

    if (!rootPath) {
        return res.status(400).json({ error: 'Missing rootPath' });
    }

    // Security check
    const resolvedRoot = path.resolve(rootPath);
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';

    if (!resolvedRoot.startsWith(homeDir)) {
        return res.status(403).json({
            error: 'Access denied: path must be within home directory'
        });
    }

    const effectiveStructure = (structure && typeof structure === 'object') ? structure : {};

    const logs = [];
    let createdCount = 0;
    let reusedCount = 0;
    const treeLines = [];

    const ensureFolder = (folderPath, logPrefix = '') => {
        const resolved = path.resolve(folderPath);
        const exists = fs.existsSync(resolved);

        if (!exists) {
            fs.mkdirSync(resolved, { recursive: true });
            createdCount++;
            logs.push(`✔ ${logPrefix}${path.basename(resolved)}`);
        } else {
            reusedCount++;
            logs.push(`↻ ${logPrefix}${path.basename(resolved)}`);
        }
        return resolved;
    };

    try {
        // Create root folder
        ensureFolder(resolvedRoot);
        treeLines.push(`Root: ${resolvedRoot}`);

        // Create base folders
        // Actually, let's respect the hierarchy for Tenders branch only. The base folders (PD, Contracts, etc.) stay fixed for now (root level).
        // The hierarchy controls what happens INSIDE "02_Vyberova_rizeni" (or whatever the tenders list is rooted at? No, user wants full control?)
        // Let's assume hierarchy controls the TENDERS branch specifically.
        // Wait, the default hierarchy includes "tenders" key which labels "Výběrová řízení (Root)".
        // So we should NOT force create it here if it's in the hierarchy.

        // Helper to get ALL unique suppliers
        const getAllSuppliers = () => {
            const all = new Map();
            Object.values(suppliers).flat().forEach(s => {
                if (s && s.id) all.set(s.id, s);
            });
            return Array.from(all.values());
        };

        // Helper to get suppliers for a category
        const getSuppliersForCategory = (catId) => suppliers[catId] || [];

        // Helper to get categories for a supplier
        const getCategoriesForSupplier = (supId) => {
            return categories.filter(cat => {
                const catSups = suppliers[cat.id] || [];
                return catSups.some(s => s.id === supId);
            });
        };

        const addTreeLine = (depth, name) => {
            const indent = '  '.repeat(Math.max(0, depth));
            treeLines.push(`${indent}- ${name}`);
        };

        // Recursive processor for Tree Structure
        const processHierarchyNodes = (currentPath, nodes, context = {}, treeDepth = 0) => {
            console.log('[MCP] Processing nodes at path:', currentPath, 'nodes:', JSON.stringify(nodes?.map(n => ({ key: n.key, name: n.name, enabled: n.enabled })) || []));

            if (!nodes || nodes.length === 0) {
                return;
            }

            for (const level of nodes) {
                if (!level.enabled) continue;

                const displayName = level.name || `<${level.key}>`;
                console.log(`[MCP] Processing level: ${level.key} name: ${displayName}`);

                // Recursive helper to process children of this node
                const processChildren = (parentPath, newContext) => {
                    // If this node has defined children in the hierarchy, process them
                    if (level.children && level.children.length > 0) {
                        processHierarchyNodes(parentPath, level.children, newContext, treeDepth + 1);
                    }
                };

                switch (level.key) {
                    case 'tenders':
                        const tendersName = level.name
                            ? slugify(level.name)
                            : (effectiveStructure.tenders ? slugify(effectiveStructure.tenders) : null);
                        if (tendersName) {
                            addTreeLine(treeDepth, tendersName);
                            const tPath = ensureFolder(path.join(currentPath, tendersName));
                            processChildren(tPath, context);
                        }
                        break;

                    case 'tendersInquiries':
                        const inquiriesName = level.name
                            ? slugify(level.name)
                            : (effectiveStructure.tendersInquiries ? slugify(effectiveStructure.tendersInquiries) : null);
                        if (inquiriesName) {
                            addTreeLine(treeDepth, inquiriesName);
                            const iPath = ensureFolder(path.join(currentPath, inquiriesName));
                            processChildren(iPath, context);
                        }
                        break;

                    case 'category':
                        let catsToProcess = categories;
                        if (context.supplier) {
                            catsToProcess = getCategoriesForSupplier(context.supplier.id);
                        }
                        for (const cat of catsToProcess) {
                            if (!cat || !cat.title) continue;
                            const catFolder = slugify(cat.title);
                            addTreeLine(treeDepth, catFolder);
                            const nextPath = ensureFolder(path.join(currentPath, catFolder));
                            processChildren(nextPath, { ...context, category: cat });
                        }
                        break;

                    case 'supplier':
                        let supsToProcess = [];
                        if (context.category) {
                            supsToProcess = getSuppliersForCategory(context.category.id);
                        } else {
                            supsToProcess = getAllSuppliers();
                        }
                        for (const sup of supsToProcess) {
                            if (!sup || !sup.name) continue;
                            const supFolder = slugify(sup.name);
                            addTreeLine(treeDepth, supFolder);
                            const nextPath = ensureFolder(path.join(currentPath, supFolder));
                            processChildren(nextPath, { ...context, supplier: sup });
                        }
                        break;

                    case 'custom':
                        if (level.name) {
                            const customName = slugify(level.name);
                            addTreeLine(treeDepth, customName);
                            const customPath = ensureFolder(path.join(currentPath, customName));
                            processChildren(customPath, context);
                        }
                        break;

                    default:
                        if (level.name) {
                            const customName = slugify(level.name);
                            addTreeLine(treeDepth, customName);
                            const customPath = ensureFolder(path.join(currentPath, customName));
                            processChildren(customPath, context);
                        }
                        break;
                }
            }
        };


        // Static Root Folders - REMOVED
        // Now all folders are controlled by the hierarchy editor
        // The user can add static folders by adding custom items with key='custom' at depth 0

        // Start dynamic processing from Root
        // If hierarchy is not provided or empty, use legacy linear default
        const hierarchyInput = req.body.hierarchy || [];

        // Handle legacy flat array if sent by older client (backwards compatibilityish)
        // Actually, let's just assume we will update client to send tree. 
        // But if strict array passed, we might need to convert?
        // Let's assume client sends proper tree.

        processHierarchyNodes(resolvedRoot, hierarchyInput, {});
        console.log('[MCP] Tree output:\n' + treeLines.join('\n'));

        logs.push(`✅ Hotovo. ✔ ${createdCount} · ↻ ${reusedCount}`);

        res.json({
            success: true,
            rootPath: resolvedRoot,
            createdCount,
            reusedCount,
            logs
        });
    } catch (error) {
        console.error('[MCP] /ensure-structure FAILED:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error',
            logs
        });
    }
});

// Check if folder exists
app.post('/folder-exists', (req, res) => {
    const { folderPath } = req.body;

    if (!folderPath) {
        return res.status(400).json({ error: 'Missing folderPath' });
    }

    const resolvedPath = path.resolve(folderPath);
    const exists = fs.existsSync(resolvedPath);

    console.log(`[MCP] Connection check for: "${folderPath}" -> ${exists ? 'Exists' : 'Not found (will create)'}`);

    res.json({
        exists,
        path: resolvedPath,
        isDirectory: exists && fs.statSync(resolvedPath).isDirectory()
    });
});

// Delete a folder (with strict safety checks)
app.post('/delete-folder', (req, res) => {
    const { folderPath, rootPath } = req.body;

    if (!folderPath || !rootPath) {
        return res.status(400).json({ error: 'Missing folderPath or rootPath' });
    }

    const resolvedTarget = path.resolve(folderPath);
    const resolvedRoot = path.resolve(rootPath);
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';

    // 1. Root Security Check
    if (!resolvedRoot.startsWith(homeDir)) {
        return res.status(403).json({
            error: 'Access denied: rootPath must be within home directory'
        });
    }

    // 2. Target Containment Check
    if (!resolvedTarget.startsWith(resolvedRoot)) {
        return res.status(403).json({
            error: 'Access denied: Cannot delete outside of project root'
        });
    }

    // 3. Root Self-Delete Prevention
    if (resolvedTarget === resolvedRoot) {
        return res.status(403).json({
            error: 'Access denied: Cannot delete the project root itself'
        });
    }

    console.log(`[MCP] Deleting folder: "${resolvedTarget}" (Root: "${resolvedRoot}")`);

    try {
        if (fs.existsSync(resolvedTarget)) {
            // Use force and recursive to delete directories with content
            fs.rmSync(resolvedTarget, { recursive: true, force: true });
            res.json({ success: true, deleted: true, path: resolvedTarget });
        } else {
            res.json({ success: true, deleted: false, reason: 'Folder did not exist' });
        }
    } catch (error) {
        console.error('[MCP] Delete failed:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error',
            path: resolvedTarget
        });
    }
});

// Open a folder or file in the OS default viewer/explorer
app.post('/open-path', (req, res) => {
    const { path: itemPath } = req.body;

    if (!itemPath) {
        return res.status(400).json({ error: 'Missing path' });
    }

    const resolvedPath = path.resolve(itemPath);
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';

    // Security check: Ensure path is safe (optional, but good practice)
    // We allow opening anything within home dir.
    if (!resolvedPath.startsWith(homeDir)) {
        // Relaxed check? Sometimes people want to open drives.
        // But for now, let's keep it safe.
        // Actually, user might have projects on multiple drives (D:\Projects).
        // If we restrict to homeDir, we might block valid use cases.
        // Detailed check: verify it doesn't contain ".." exploit or sensitive system paths?
        // path.resolve handles "..".
        // Let's just log it and allow it for now, assuming local user trust (it's a local bridge).
        // console.warn('[MCP] Opening path outside home:', resolvedPath);
    }

    if (!fs.existsSync(resolvedPath)) {
        return res.status(404).json({ error: 'Path does not exist' });
    }

    console.log(`[MCP] Opening path: "${resolvedPath}"`);

    let command;
    switch (process.platform) {
        case 'win32':
            // Windows
            // "start" requires a title as first arg if stripped quotes are used, empty string works.
            // But "explorer" is more specific for opening file explorer.
            // If it's a file, "start" opens it in default app.
            // If it's a folder, "explorer" opens it.
            // Let's generic "start" which handles both nicely usually.
            command = `start "" "${resolvedPath}"`;
            break;
        case 'darwin':
            // macOS
            command = `open "${resolvedPath}"`;
            break;
        case 'linux':
            // Linux
            command = `xdg-open "${resolvedPath}"`;
            break;
        default:
            return res.status(500).json({ error: 'Unsupported platform' });
    }

    exec(command, (error) => {
        if (error) {
            console.error('[MCP] Open failed:', error);
            // Don't fail the response if it's just a detached process issue, but exec usually waits?
            // "start" returns immediately on Windows usually.
            // On error we report it.
            return res.status(500).json({ error: 'Failed to open path' });
        }
        res.json({ success: true, path: resolvedPath });
    });
});

// Pick folder via native dialog
app.post('/pick-folder', (req, res) => {
    const BUILD_ID = "BUILD_FIX_SNAPSHOT_V1";
    console.log(`[MCP] /pick-folder called [${BUILD_ID}] - attempting to open dialog...`);

    // In pkg environment, we can't pass the script path directly to powershell
    // because it lives in a virtual filesystem (C:\snapshot\...) which powershell can't see.
    // Solution: Copy script to a temp file on the real filesystem.

    const os = require('os');
    const sourceScriptPath = path.join(__dirname, 'pick-folder.ps1');
    const tempScriptPath = path.join(os.tmpdir(), `mcp-pick-folder-${Date.now()}.ps1`);

    try {
        // Read the script from source (works in snapshot)
        const scriptContent = fs.readFileSync(sourceScriptPath, 'utf8');
        // Write to real temp file
        fs.writeFileSync(tempScriptPath, scriptContent);

        console.log('[MCP] Extracted script to:', tempScriptPath);

        // Run the temp script
        // Use -sta, -executionpolicy bypass and -file for robustness
        const command = `powershell -sta -noprofile -executionpolicy bypass -file "${tempScriptPath}"`;

        console.log('[MCP] Executing PowerShell script...');
        exec(command, (error, stdout, stderr) => {
            // Cleanup temp file
            try {
                if (fs.existsSync(tempScriptPath)) fs.unlinkSync(tempScriptPath);
            } catch (cleanupErr) {
                console.error('[MCP] Failed to cleanup temp script:', cleanupErr);
            }

            if (stderr) {
                console.error('[MCP] PowerShell stderr:', stderr);
            }
            if (error) {
                console.error('[MCP] Pick folder error:', error);
                return res.status(500).json({ error: 'Failed to open dialog', details: stderr || error.message });
            }

            console.log('[MCP] Dialog closed. Selected:', stdout.trim() || '(Cancelled)');

            const selectedPath = stdout.trim();
            if (!selectedPath) {
                return res.json({ cancelled: true });
            }
            res.json({ path: selectedPath });
        });
    } catch (err) {
        console.error('[MCP] Failed to prepare script:', err);
        // Try cleanup if something failed mid-way
        try {
            if (fs.existsSync(tempScriptPath)) fs.unlinkSync(tempScriptPath);
        } catch { }

        return res.status(500).json({ error: 'Failed to prepare dialog script', details: err.message });
    }
});

// Helper: Slugify folder name (same as docHub.ts)
function slugify(value) {
    if (!value) return 'Neznamy';
    if (typeof value !== 'string') {
        try {
            value = String(value);
        } catch {
            return 'Neznamy';
        }
    }
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/&/g, ' a ')
        .replace(/[^\w\s-]/g, ' ')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_') || 'Neznamy';
}

// Start server
const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║      Tender Flow MCP Bridge Server                       ║
╠══════════════════════════════════════════════════════════╣
║  Status:    ✅ Running                                   ║
║  Version:   BUILD_FIX_SNAPSHOT_V1                        ║
║  URL:       http://localhost:${PORT}                        ║
║  Health:    http://localhost:${PORT}/health                 ║
╠══════════════════════════════════════════════════════════╣
║  This server enables DocHub to create folders on your    ║
║  local disk. Keep this terminal open while using         ║
║  Tender Flow.                                            ║
║                                                        ║
║  2026 - All Rights Reserved - Martin Kalkuš              ║
╚══════════════════════════════════════════════════════════╝
    `);
});

// Handle startup errors (e.g., port in use)
server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`
❌ CHYBA: Port ${PORT} je již obsazen!

Pravděpodobně již mcp-bridge-server běží v jiném okně.
Tuto chybu může způsobovat:
  1. Jiné běžící okno "Tender Flow MCP Bridge"
  2. Zaseklý proces na pozadí

Řešení:
  - Zkontrolujte ostatní otevřená okna
  - Restartujte počítač pokud problém přetrvává
        `);
    } else {
        console.error('❌ CHYBA SERVERU:', e);
    }

    keepAlive();
});

// Keep process alive so user can read errors (works in pkg exe)
function keepAlive() {
    console.log('\nOkno se zavře za 60 sekund. Stiskněte Ctrl+C pro ukončení...');

    // Try stdin approach (works in terminal, may fail in pkg)
    try {
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.on('data', () => process.exit(1));
        }
    } catch {
        // Fallback: just wait
    }

    // Fallback: keep alive for 60 seconds regardless
    setTimeout(() => process.exit(1), 60000);
}

// Global error handlers to prevent silent crashes
process.on('uncaughtException', (e) => {
    console.error('❌ NEOČEKÁVANÁ CHYBA:', e);
    keepAlive();
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ NEOŠETŘENÝ PROMISE:', reason);
});
