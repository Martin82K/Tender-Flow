/**
 * MCP Bridge Server for CRM DocHub
 * 
 * This local server enables the CRM web application to create folders
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

const app = express();
const PORT = 3847;

// Middleware
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://127.0.0.1:5173',
        'https://tenderflow.cz',
        'https://www.tenderflow.cz'
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

    const defaultStructure = {
        pd: '01_PD',
        tenders: '02_Vyberova_rizeni',
        contracts: '03_Smlouvy',
        realization: '04_Realizace',
        archive: '99_Archiv',
        tendersInquiries: 'Poptavky',
        supplierEmail: 'Email',
        supplierOffer: 'Cenova_nabidka',
        ...(structure || {})
    };

    const logs = [];
    let createdCount = 0;
    let reusedCount = 0;

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

        // Create base folders
        ensureFolder(path.join(resolvedRoot, defaultStructure.pd));
        const tendersPath = ensureFolder(path.join(resolvedRoot, defaultStructure.tenders));
        ensureFolder(path.join(resolvedRoot, defaultStructure.contracts));
        ensureFolder(path.join(resolvedRoot, defaultStructure.realization));
        ensureFolder(path.join(resolvedRoot, defaultStructure.archive));

        // Create category folders (VŘ)
        for (const category of categories) {
            const categoryFolderName = slugify(category.title);
            const categoryPath = ensureFolder(
                path.join(tendersPath, categoryFolderName),
                `${defaultStructure.tenders}/`
            );

            // Create inquiries folder
            const inquiriesPath = ensureFolder(
                path.join(categoryPath, defaultStructure.tendersInquiries),
                `${defaultStructure.tenders}/${categoryFolderName}/`
            );

            // Create supplier folders
            const categorySuppliers = suppliers[category.id] || [];
            for (const supplier of categorySuppliers) {
                const supplierFolderName = slugify(supplier.name);
                const supplierPath = ensureFolder(
                    path.join(inquiriesPath, supplierFolderName),
                    `.../${defaultStructure.tendersInquiries}/`
                );

                // Create Email and Cenova_nabidka folders
                ensureFolder(
                    path.join(supplierPath, defaultStructure.supplierEmail),
                    `.../${supplierFolderName}/`
                );
                ensureFolder(
                    path.join(supplierPath, defaultStructure.supplierOffer),
                    `.../${supplierFolderName}/`
                );
            }
        }

        logs.push(`✅ Hotovo. ✔ ${createdCount} · ↻ ${reusedCount}`);

        res.json({
            success: true,
            rootPath: resolvedRoot,
            createdCount,
            reusedCount,
            logs
        });
    } catch (error) {
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

    res.json({
        exists,
        path: resolvedPath,
        isDirectory: exists && fs.statSync(resolvedPath).isDirectory()
    });
});

// Helper: Slugify folder name (same as docHub.ts)
function slugify(value) {
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
║         CRM MCP Bridge Server                            ║
╠══════════════════════════════════════════════════════════╣
║  Status:    ✅ Running                                   ║
║  URL:       http://localhost:${PORT}                        ║
║  Health:    http://localhost:${PORT}/health                 ║
╠══════════════════════════════════════════════════════════╣
║  This server enables DocHub to create folders on your    ║
║  local disk. Keep this terminal open while using CRM.    ║
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
  1. Jiné běžící okno "CRM MCP Bridge"
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
