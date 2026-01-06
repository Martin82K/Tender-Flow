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

// Pick folder via native dialog
app.post('/pick-folder', (req, res) => {
    console.log('[MCP] /pick-folder called - attempting to open dialog...');
    // PowerShell command to open FolderBrowserDialog

    const scriptPath = path.join(__dirname, 'pick-folder.ps1');
    // Use -sta, -executionpolicy bypass and -file for robustness
    const command = `powershell -sta -noprofile -executionpolicy bypass -file "${scriptPath}"`;

    console.log('[MCP] Executing PowerShell script:', scriptPath);
    exec(command, (error, stdout, stderr) => {
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
