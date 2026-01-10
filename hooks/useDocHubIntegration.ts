import { useCallback, useEffect, useRef, useState } from 'react';
import { ProjectDetails } from '../types';
import { supabase } from '../services/supabase';
import { invokeAuthedFunction } from '../services/functionsClient';
import { resolveDocHubStructureV1, getDocHubProjectLinks, DEFAULT_DOCHUB_HIERARCHY, DocHubHierarchyItem, buildHierarchyTree, type DocHubStructureV1 } from '../utils/docHub';
import { isMcpBridgeRunning, mcpEnsureStructure, mcpFolderExists, mcpPickFolder } from '../services/mcpBridgeClient';

export interface DocHubModalRequest {
    title: string;
    message: string;
    variant: 'danger' | 'info' | 'success';
}



const loadedScripts = new Map<string, Promise<void>>();
const ensureScript = (src: string): Promise<void> => {
    if (loadedScripts.has(src)) return loadedScripts.get(src)!;
    const promise = new Promise<void>((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
        if (existing?.dataset.loaded === "1") return resolve();
        const script = existing || document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = () => {
            script.dataset.loaded = "1";
            resolve();
        };
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        if (!existing) document.head.appendChild(script);
    });
    loadedScripts.set(src, promise);
    return promise;
};

export const useDocHubIntegration = (
    project: ProjectDetails,
    onUpdate: (updates: Partial<ProjectDetails>) => void
) => {
    // Basic Settings
    const [enabled, setEnabled] = useState(!!project.docHubEnabled);
    const [rootLink, setRootLink] = useState(project.docHubRootLink || '');
    const [rootName, setRootName] = useState(project.docHubRootName || '');
    const [provider, setProvider] = useState<"gdrive" | "onedrive" | "local" | "mcp" | null>(project.docHubProvider ?? null);
    const [mode, setMode] = useState<"user" | "org" | null>(project.docHubMode ?? null);
    const [status, setStatus] = useState<"disconnected" | "connected" | "error">(project.docHubStatus || "disconnected");
    const [isEditingSetup, setIsEditingSetup] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    const [newFolderName, setNewFolderName] = useState('');
    const [resolveProgress, setResolveProgress] = useState(0);

    // Auto Create
    const [autoCreateEnabled, setAutoCreateEnabled] = useState(!!project.docHubAutoCreateEnabled);
    const [isAutoCreating, setIsAutoCreating] = useState(false);
    const [autoCreateProgress, setAutoCreateProgress] = useState(0);
    const [autoCreateLogs, setAutoCreateLogs] = useState<string[]>([]);
    const [backendStep, setBackendStep] = useState<string | null>(null);
    const [backendCounts, setBackendCounts] = useState<{ done: number; total: number | null } | null>(null);
    const [backendStatus, setBackendStatus] = useState<'running' | 'success' | 'error' | null>(null);
    const [mcpBridgeStatus, setMcpBridgeStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
    const [autoCreateRunId, setAutoCreateRunId] = useState<string | null>(null);
    const [autoCreateResult, setAutoCreateResult] = useState<{
        createdCount: number | null;
        runId: string | null;
        logs: string[];
        finishedAt: string;
    } | null>(null);
    const [isResultModalOpen, setIsResultModalOpen] = useState(false);

    // Structure
    const [structureDraft, setStructureDraft] = useState<Partial<DocHubStructureV1>>(
        () => ((project.docHubStructureV1 as any) || {})
    );
    const [extraTopLevelDraft, setExtraTopLevelDraft] = useState<string[]>([]);
    const [extraSupplierDraft, setExtraSupplierDraft] = useState<string[]>([]);
    const [hierarchyDraft, setHierarchyDraft] = useState<DocHubHierarchyItem[]>(DEFAULT_DOCHUB_HIERARCHY);
    const [isEditingStructure, setIsEditingStructure] = useState(false);

    // History & Links
    const [history, setHistory] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [docHubBaseLinks, setDocHubBaseLinks] = useState<any>(null);

    // UI Helpers
    const [modalRequest, setModalRequest] = useState<DocHubModalRequest | null>(null);
    const showMessage = useCallback((title: string, message: string, variant: 'danger' | 'info' | 'success' = 'info') => {
        setModalRequest({ title, message, variant });
    }, []);
    const clearModalRequest = useCallback(() => setModalRequest(null), []);

    // Refs
    const autoCreateTimerRef = useRef<number | null>(null);
    const autoCreatePollRef = useRef<number | null>(null);
    // Track what we've loaded to prevent re-loading from stale project updates
    const loadedHierarchyRef = useRef<{ projectId: string | undefined; hierarchyLength: number } | null>(null);

    // Sync from props
    useEffect(() => {
        setEnabled(!!project.docHubEnabled);
        setRootLink(project.docHubRootLink || '');
        setRootName(project.docHubRootName || '');
        setProvider(project.docHubProvider ?? null);
        setMode(project.docHubMode ?? null);
        setStatus(project.docHubStatus || (project.docHubEnabled && (project.docHubRootLink || '').trim() ? "connected" : "disconnected"));
        setAutoCreateEnabled(!!project.docHubAutoCreateEnabled);

        // Structure sync
        setStructureDraft(((project.docHubStructureV1 as any) || {}));
        const rawTop = (project.docHubStructureV1 as any)?.extraTopLevel;
        const rawSupplier = (project.docHubStructureV1 as any)?.extraSupplier;
        const rawHierarchy = (project.docHubStructureV1 as any)?.extraHierarchy;

        console.log('[DocHub] Loading from project.docHubStructureV1:', project.docHubStructureV1);
        console.log('[DocHub] rawHierarchy loaded:', rawHierarchy);

        // Helper to normalize items
        const normalizeItems = (items: any[]) => items.map((item: any, index: number) => ({
            ...item,
            id: item.id || item.key || `item-${index}`,
            depth: typeof item.depth === 'number' ? item.depth : 0
        }));

        // Always normalize hierarchy: ensure all items have id and depth properties
        let hierarchyToUse: DocHubHierarchyItem[];
        if (Array.isArray(rawHierarchy) && rawHierarchy.length > 0) {
            hierarchyToUse = normalizeItems(rawHierarchy);
            console.log('[DocHub] Loaded and normalized hierarchy:', hierarchyToUse.length, 'items');
        } else {
            // Try to load user preset as default
            let loadedFromPreset = false;
            try {
                if (typeof window !== 'undefined') {
                    const savedPreset = localStorage.getItem('docHubStructurePreset');
                    if (savedPreset) {
                        const parsed = JSON.parse(savedPreset);
                        if (Array.isArray(parsed.hierarchyDraft) && parsed.hierarchyDraft.length > 0) {
                            hierarchyToUse = normalizeItems(parsed.hierarchyDraft);
                            console.log('[DocHub] Using user preset as default');
                            loadedFromPreset = true;
                        }
                    }
                }
            } catch (e) {
                console.warn('[DocHub] Failed to load user preset:', e);
            }

            if (!loadedFromPreset) {
                // FALLBACK: Use default template instead of empty
                hierarchyToUse = normalizeItems(DEFAULT_DOCHUB_HIERARCHY);
                console.log('[DocHub] No structure defined and no preset found. Using default structure.');
            }
        }
        console.log('[DocHub] Hierarchy items:', hierarchyToUse.map(h => `${h.key}:${h.name}@${h.depth}`));
        setHierarchyDraft(hierarchyToUse);

        setExtraTopLevelDraft(Array.isArray(rawTop) ? rawTop.map(String).filter(s => s.trim()) : []);
        setExtraSupplierDraft(Array.isArray(rawSupplier) ? rawSupplier.map(String).filter(s => s.trim()) : []);
    }, [project]);

    // Derived State
    const isAuthed = enabled && status === "connected";
    const isLocalProvider = provider === "onedrive";
    const isMcpProvider = provider === "mcp";
    const isConnected = isAuthed && (isLocalProvider || isMcpProvider ? rootLink.trim() !== '' : !!project.docHubRootId && rootLink.trim() !== '');
    const effectiveStructure = isEditingStructure ? structureDraft : resolveDocHubStructureV1((project.docHubStructureV1 as any) || undefined);

    // Cleanup timers
    useEffect(() => {
        return () => {
            if (autoCreateTimerRef.current) window.clearInterval(autoCreateTimerRef.current);
            if (autoCreatePollRef.current) window.clearInterval(autoCreatePollRef.current);
        };
    }, []);

    // Poll MCP Bridge status when MCP provider is active
    useEffect(() => {
        if (!isMcpProvider) {
            setMcpBridgeStatus('unknown');
            return;
        }

        const checkStatus = async () => {
            const running = await isMcpBridgeRunning();
            setMcpBridgeStatus(running ? 'connected' : 'disconnected');
        };

        // Initial check
        checkStatus();

        // Poll every 5 seconds
        const interval = window.setInterval(checkStatus, 5000);
        return () => window.clearInterval(interval);
    }, [isMcpProvider]);

    // Load Links (skip for local/MCP providers - they don't use cloud APIs)
    useEffect(() => {
        if (!isConnected || !project.id) {
            setDocHubBaseLinks(null);
            return;
        }
        // Skip cloud API calls for local and MCP providers
        if (isLocalProvider || isMcpProvider) {
            setDocHubBaseLinks(null);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const kinds = ["pd", "tenders", "contracts", "realization", "archive"] as const;
                const results = await Promise.all(
                    kinds.map(async (kind) => {
                        const res = await invokeAuthedFunction<{ webUrl?: string | null }>("dochub-get-link", {
                            body: { projectId: project.id, kind }
                        });
                        return [kind, res?.webUrl || null] as const;
                    })
                );
                if (cancelled) return;
                const next: any = {};
                for (const [kind, url] of results) next[kind] = url;
                setDocHubBaseLinks(next);
            } catch {
                if (!cancelled) setDocHubBaseLinks(null);
            }
        })();
        return () => { cancelled = true; };
    }, [isConnected, project.id, project.docHubStructureV1, isLocalProvider, isMcpProvider]);

    const fallbackLinks = isConnected ? getDocHubProjectLinks(rootLink, effectiveStructure) : null;
    const links = isConnected ? {
        pd: docHubBaseLinks?.pd ?? fallbackLinks?.pd ?? null,
        tenders: docHubBaseLinks?.tenders ?? fallbackLinks?.tenders ?? null,
        contracts: docHubBaseLinks?.contracts ?? fallbackLinks?.contracts ?? null,
        realization: docHubBaseLinks?.realization ?? fallbackLinks?.realization ?? null,
        archive: docHubBaseLinks?.archive ?? fallbackLinks?.archive ?? null,
        ceniky: docHubBaseLinks?.ceniky ?? fallbackLinks?.ceniky ?? null,
    } : null;


    // Actions
    const handleSaveSetup = useCallback(() => {
        onUpdate({
            docHubEnabled: enabled,
            docHubRootLink: rootLink,
            docHubRootName: rootName || null,
            docHubProvider: provider,
            docHubMode: mode,
            docHubStatus: enabled && project.docHubRootId ? "connected" : "disconnected",
            docHubStructureVersion: project.docHubStructureVersion ?? 1
        });
        setIsEditingSetup(false);
    }, [enabled, rootLink, rootName, provider, mode, project.docHubRootId, project.docHubStructureVersion, onUpdate]);

    const handleDisconnect = useCallback(() => {
        setRootLink("");
        setRootName("");
        setProvider(null);
        setMode(null);
        setStatus("disconnected");
        setIsEditingSetup(false);
        onUpdate({
            docHubEnabled: true,
            docHubRootLink: "",
            docHubRootName: null,
            docHubProvider: null,
            docHubMode: null,
            docHubStatus: "disconnected",
            docHubRootId: null,
            docHubDriveId: null,
            docHubSiteId: null,
            docHubRootWebUrl: null,
        });
    }, [onUpdate]);

    const handleConnect = useCallback(async () => {
        if (!provider || !mode) {
            showMessage("DocHub", "Vyberte provider a režim.", "info");
            return;
        }
        if (!project.id) {
            showMessage("DocHub", "Chybí ID projektu.", "danger");
            return;
        }
        setIsConnecting(true);
        try {
            const returnTo = `${window.location.origin}/app?dochub=1`;
            const data = await invokeAuthedFunction<{ url?: string }>("dochub-auth-url", {
                body: { provider, mode, projectId: project.id, returnTo }
            });
            const url = data?.url;
            if (!url) throw new Error("Backend nevrátil autorizační URL.");
            window.location.href = url;
        } catch (e) {
            console.error(e);
            showMessage("Chyba připojení", e instanceof Error ? e.message : String(e), "danger");
            setIsConnecting(false);
        }
    }, [provider, mode, project.id, showMessage]);

    const loadHistory = useCallback(async () => {
        if (!project.id) return;
        setIsLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from("dochub_autocreate_runs")
                .select("*")
                .eq("project_id", project.id)
                .order("started_at", { ascending: false })
                .limit(20);
            if (!error && data) setHistory(data);
        } finally {
            setIsLoadingHistory(false);
        }
    }, [project.id]);

    const pickGoogleRoot = useCallback(async () => {
        if (provider !== "gdrive") { showMessage("DocHub", "Vyberte Google Drive.", "info"); return; }
        if (!project.id) { showMessage("DocHub", "Chybí ID projektu.", "danger"); return; }
        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
        if (!apiKey) { showMessage("Chybí konfigurace", "Chybí VITE_GOOGLE_API_KEY.", "danger"); return; }

        setIsConnecting(true);
        try {
            const tokenData = await invokeAuthedFunction<{ accessToken?: string }>("dochub-google-picker-token");
            const pickerAccessToken = tokenData?.accessToken;
            if (!pickerAccessToken) throw new Error("Backend nevrátil accessToken.");

            await ensureScript("https://apis.google.com/js/api.js");
            const gapi = (window as any).gapi;
            if (!gapi?.load) throw new Error("Google API script error.");

            await new Promise<void>((resolve) => { gapi.load("picker", { callback: resolve }); });

            const picker = new (window as any).google.picker.PickerBuilder()
                .addView(new (window as any).google.picker.DocsView((window as any).google.picker.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true))
                .setOAuthToken(pickerAccessToken)
                .setDeveloperKey(apiKey)
                .setCallback(async (data: any) => {
                    if (data?.action !== (window as any).google.picker.Action.PICKED) return;
                    const doc = data?.docs?.[0];
                    const rootId = doc?.id as string | undefined;
                    if (!rootId) return;

                    try {
                        const resolved = await invokeAuthedFunction<any>("dochub-resolve-root", {
                            body: { provider: "gdrive", projectId: project.id, rootId }
                        });
                        const rName = (resolved as any)?.rootName;
                        const rWebUrl = (resolved as any)?.rootWebUrl;
                        if (rName) setRootName(rName);
                        if (rWebUrl) setRootLink(rWebUrl);
                        setStatus("connected");
                        onUpdate({
                            docHubEnabled: true,
                            docHubProvider: "gdrive",
                            docHubStatus: "connected",
                            docHubRootName: rName || null,
                            docHubRootLink: rWebUrl || rootLink,
                            docHubRootWebUrl: rWebUrl || null,
                            docHubRootId: (resolved as any)?.rootId || rootId,
                            docHubDriveId: (resolved as any)?.driveId ?? null
                        });
                        showMessage("Hotovo", "Složka nastavena.", "success");
                    } catch (e: any) {
                        showMessage("Nelze uložit složku", e.message || "Error", "danger");
                    }
                })
                .build();
            picker.setVisible(true);
        } catch (e: any) {
            showMessage("Chyba Pickera", e.message || "Error", "danger");
        } finally {
            setIsConnecting(false);
        }
    }, [provider, project.id, showMessage, rootLink, onUpdate]);

    const createGoogleRoot = useCallback(async () => {
        if (provider !== "gdrive") { showMessage("DocHub", "Vyberte Google Drive.", "info"); return; }
        if (!project.id) { showMessage("DocHub", "Chybí ID projektu.", "danger"); return; }
        if (!newFolderName.trim()) { showMessage("DocHub", "Zadejte název.", "info"); return; }

        setIsConnecting(true);
        try {
            const created = await invokeAuthedFunction<any>("dochub-google-create-root", { body: { projectId: project.id, name: newFolderName.trim() } });
            const rName = (created as any)?.rootName;
            const rWebUrl = (created as any)?.rootWebUrl;
            if (rName) setRootName(rName);
            if (rWebUrl) setRootLink(rWebUrl);
            setStatus("connected");
            onUpdate({
                docHubEnabled: true,
                docHubProvider: "gdrive",
                docHubStatus: "connected",
                docHubRootName: rName || null,
                docHubRootLink: rWebUrl || rootLink,
                docHubRootWebUrl: rWebUrl || null,
                docHubRootId: (created as any)?.rootId || null,
                docHubDriveId: (created as any)?.driveId || null,
            });
            showMessage("Hotovo", "Složka vytvořena.", "success");
        } catch (e: any) {
            showMessage("Nelze vytvořit složku", e.message || "Error", "danger");
        } finally {
            setIsConnecting(false);
        }
    }, [provider, project.id, newFolderName, showMessage, rootLink, onUpdate]);

    const resolveRoot = useCallback(async () => {
        if (!provider || !rootLink.trim()) return;
        setResolveProgress(10); // Fake start
        setIsConnecting(true); // Reuse connecting state
        try {
            const resolved = await invokeAuthedFunction<any>("dochub-resolve-root", {
                body: { provider, projectId: project.id, url: rootLink.trim() }
            });
            const rName = (resolved as any)?.rootName;
            const rWebUrl = (resolved as any)?.rootWebUrl;
            if (rName) setRootName(rName);
            if (rWebUrl) setRootLink(rWebUrl);
            setStatus("connected");
            onUpdate({
                docHubEnabled: true,
                docHubProvider: provider,
                docHubStatus: "connected",
                docHubRootName: rName || null,
                docHubRootLink: rWebUrl || rootLink.trim(),
                docHubRootWebUrl: rWebUrl || null,
                docHubRootId: (resolved as any)?.rootId || null,
                docHubDriveId: (resolved as any)?.driveId || null,
                docHubSiteId: (resolved as any)?.siteId || null,
            });
            setResolveProgress(100);
        } catch (e: any) {
            showMessage("Nelze získat odkaz", e.message || "Error", "danger");
            setResolveProgress(0);
        } finally {
            // Keep loading state briefly for UI effect
            setTimeout(() => { setIsConnecting(false); setResolveProgress(0); }, 500);
        }
    }, [provider, project.id, rootLink, showMessage, onUpdate]);

    const pickLocalFolder = useCallback(async () => {
        if (provider !== "onedrive") {
            showMessage("DocHub", "Vyberte 'Tender Flow Desktop' jako provider.", "info");
            return;
        }
        setIsConnecting(true);
        try {
            // Try to use platform adapter for native folder selection (Electron)
            const { fileSystemAdapter, isDesktop } = await import('../services/platformAdapter');

            if (isDesktop) {
                // Use native Electron dialog
                const folderInfo = await fileSystemAdapter.selectFolder();
                if (!folderInfo) {
                    // User cancelled
                    return;
                }
                const folderPath = folderInfo.path;
                const folderName = folderInfo.name;

                setRootName(folderName);
                setRootLink(folderPath);
                setStatus("connected");
                onUpdate({
                    docHubEnabled: true,
                    docHubProvider: "onedrive",
                    docHubStatus: "connected",
                    docHubRootName: folderName,
                    docHubRootLink: folderPath,
                    docHubRootWebUrl: null,
                    docHubRootId: `local:${folderPath}`,
                    docHubDriveId: null,
                    docHubSiteId: null,
                });
                showMessage("Hotovo", `Složka "${folderName}" byla vybrána.`, "success");
                return;
            }

            // Web fallback: Check if File System Access API is supported
            if ('showDirectoryPicker' in window) {
                const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
                const folderName = dirHandle.name;
                // For local folders, we store the name as the "link" - actual path is not accessible from browser
                // User will need to know the full path on their system
                setRootName(folderName);
                setRootLink(folderName);
                setStatus("connected");
                onUpdate({
                    docHubEnabled: true,
                    docHubProvider: "onedrive",
                    docHubStatus: "connected",
                    docHubRootName: folderName,
                    docHubRootLink: folderName,
                    docHubRootWebUrl: null,
                    docHubRootId: `local:${folderName}`,
                    docHubDriveId: null,
                    docHubSiteId: null,
                });
                showMessage("Hotovo", `Složka "${folderName}" byla vybrána. Pro plnou funkčnost zadejte cestu ručně.`, "success");
            } else {
                // Fallback for unsupported browsers - prompt for manual path
                showMessage(
                    "Nepodporovaný prohlížeč",
                    "Váš prohlížeč nepodporuje výběr složky. Použijte Tender Flow Desktop aplikaci nebo zadejte cestu ke složce ručně.",
                    "info"
                );
            }
        } catch (e: any) {
            if (e.name === 'AbortError') {
                // User cancelled - do nothing
                return;
            }
            showMessage("Chyba výběru", e.message || "Nelze vybrat složku", "danger");
        } finally {
            setIsConnecting(false);
        }
    }, [provider, showMessage, onUpdate]);

    const pickMcpFolder = useCallback(async () => {
        if (provider !== 'mcp') return;
        setIsConnecting(true);
        try {
            // Check running first
            const isRunning = await isMcpBridgeRunning();
            if (!isRunning) {
                showMessage("MCP neběží", "Spusťte prosím mcp-bridge-server.", "danger");
                return;
            }

            const result = await mcpPickFolder();
            if (result.error) {
                throw new Error(result.error);
            }
            if (result.cancelled) {
                return; // User cancelled
            }
            if (result.path) {
                setRootLink(result.path);
                // Try to guess name
                const name = result.path.split(/[\\/]/).pop();
                if (name) setRootName(name);
            }
        } catch (e: any) {
            showMessage("Chyba výběru", e.message || "Selhalo otevření dialogu", "danger");
        } finally {
            setIsConnecting(false);
        }
    }, [provider, showMessage]);

    const connectMcp = useCallback(async () => {
        console.log('[DocHub] connectMcp called', { provider, rootLink });
        if (provider !== "mcp") {
            showMessage("DocHub", "Vyberte 'MCP (Lokální disk)' jako provider.", "info");
            return;
        }


        // Sanitize path (remove surrounding quotes from "Copy as path")
        const cleanPath = rootLink.trim().replace(/^"|"$/g, '');

        if (!cleanPath) {
            showMessage("DocHub", "Zadejte platnou cestu.", "info");
            return;
        }

        setIsConnecting(true);
        try {
            // Check if MCP Bridge is running
            const isRunning = await isMcpBridgeRunning();
            if (!isRunning) {
                showMessage(
                    "MCP Server neběží",
                    "Spusťte MCP Bridge Server příkazem:\ncd mcp-bridge-server && npm start",
                    "danger"
                );
                return;
            }

            // Check if folder exists (or can be created)
            const folderCheck = await mcpFolderExists(cleanPath);
            const folderName = cleanPath.split('/').pop() || cleanPath.split('\\').pop() || 'Projekt';

            // Update input to clean path if it was quoted
            if (cleanPath !== rootLink) {
                setRootLink(cleanPath);
            }

            setRootName(folderName);
            setStatus("connected");
            onUpdate({
                docHubEnabled: true,
                docHubProvider: "mcp",
                docHubStatus: "connected",
                docHubRootName: folderName,
                docHubRootLink: cleanPath,
                docHubRootWebUrl: null,
                docHubRootId: `mcp:${cleanPath}`,
                docHubDriveId: null,
                docHubSiteId: null,
            });

            if (folderCheck.exists) {
                showMessage("Hotovo", `Připojeno ke složce "${folderName}". Složka existuje.`, "success");
            } else {
                showMessage("Hotovo", `Připojeno. Složka "${folderName}" bude vytvořena při synchronizaci.`, "success");
            }
        } catch (e: any) {
            showMessage("Chyba připojení", e.message || "Nelze se připojit k MCP serveru", "danger");
        } finally {
            setIsConnecting(false);
        }
    }, [provider, rootLink, showMessage, onUpdate]);

    const runAutoCreate = useCallback(async () => {
        if (!project.id) { showMessage("DocHub", "Chybí ID projektu.", "danger"); return; }
        if (status !== 'connected' && !project.docHubRootId && !rootLink) { showMessage("DocHub", "Nejdřív připojte DocHub.", "info"); return; }
        if (!provider) { showMessage("DocHub", "Chybí provider.", "danger"); return; }

        setIsAutoCreating(true);
        setAutoCreateProgress(0);
        setAutoCreateLogs(["Zahajuji auto‑vytváření složek…"]);
        setBackendStep(null);
        setBackendCounts(null);
        setBackendStatus('running');
        setAutoCreateResult(null);

        const runId = crypto.randomUUID();
        setAutoCreateRunId(runId);

        if (autoCreatePollRef.current) window.clearInterval(autoCreatePollRef.current);
        autoCreatePollRef.current = window.setInterval(async () => {
            try {
                const { data } = await supabase.from("dochub_autocreate_runs").select("*").eq("id", runId).maybeSingle();
                if (data) {
                    if (data.progress_percent) setAutoCreateProgress(p => Math.max(p, data.progress_percent));
                    if (data.status) setBackendStatus(data.status);
                    if (data.step) setBackendStep(data.step);
                    if (data.logs && Array.isArray(data.logs)) setAutoCreateLogs(data.logs as string[]);
                    const done = (data as any).completed_actions;
                    const total = (data as any).total_actions;
                    setBackendCounts({ done: typeof done === 'number' ? done : 0, total: typeof total === 'number' ? total : null });

                    if (data.status === 'success' || data.status === 'error' || data.finished_at) {
                        if (autoCreatePollRef.current) window.clearInterval(autoCreatePollRef.current);
                        autoCreatePollRef.current = null;
                    }
                }
            } catch { }
        }, 500);

        if (autoCreateTimerRef.current) window.clearInterval(autoCreateTimerRef.current);
        const start = Date.now();
        autoCreateTimerRef.current = window.setInterval(() => {
            const elapsed = Date.now() - start;
            const next = Math.min(90, Math.round((elapsed / 2500) * 90));
            setAutoCreateProgress(p => (p >= 90 ? p : Math.max(p, next)));
        }, 60);

        try {
            // MCP Provider - handle locally without edge functions
            if (provider === "mcp") {
                const isRunning = await isMcpBridgeRunning();
                if (!isRunning) {
                    throw new Error("MCP Server neběží. Spusťte: cd mcp-bridge-server && npm start");
                }

                setAutoCreateLogs(prev => [...prev, "Vytvářím složky přes MCP Bridge…"]);

                // Prepare categories and suppliers data
                const categories = project.categories?.map(c => ({ id: c.id, title: c.title })) || [];
                const suppliers: Record<string, Array<{ id: string; name: string }>> = {};

                if (project.bids) {
                    for (const [categoryId, bids] of Object.entries(project.bids)) {
                        suppliers[categoryId] = bids.map(b => ({ id: b.subcontractorId, name: b.companyName }));
                    }
                }

                console.log('[DocHub] hierarchyDraft:', JSON.stringify(hierarchyDraft, null, 2));
                const hierarchyTree = buildHierarchyTree(hierarchyDraft);
                console.log('[DocHub] hierarchyTree (sent to MCP):', JSON.stringify(hierarchyTree, null, 2));

                const mcpResult = await mcpEnsureStructure({
                    rootPath: rootLink.trim(),
                    structure: (project.docHubStructureV1 as any) || {},
                    categories,
                    suppliers,
                    hierarchy: hierarchyTree
                });

                setAutoCreateLogs(mcpResult.logs);
                setAutoCreateProgress(100);
                setAutoCreateResult({
                    createdCount: mcpResult.createdCount,
                    runId: null,
                    logs: mcpResult.logs,
                    finishedAt: new Date().toISOString()
                });
                setIsResultModalOpen(true);
                setBackendStatus('success');

                /* History saving temporarily disabled due to RLS policies (403 error)
                const { error: historyError } = await supabase.from('dochub_autocreate_runs').insert({
                    project_id: project.id,
                    status: mcpResult.success ? 'success' : 'error',
                    logs: mcpResult.logs,
                    counts: { created: mcpResult.createdCount, reused: mcpResult.reusedCount }
                });

                if (historyError) {
                    console.error('[DocHub] Failed to save history:', historyError);
                }
                */
                // Save MCP run to history
                try {
                    await supabase.from('dochub_autocreate_runs').insert({
                        project_id: project.id,
                        status: 'success',
                        step: 'MCP Bridge Sync',
                        progress_percent: 100,
                        total_actions: mcpResult.createdCount,
                        completed_actions: mcpResult.createdCount,
                        logs: mcpResult.logs,
                        error: null,
                        started_at: new Date(Date.now() - 5000).toISOString(), // approximate start
                        finished_at: new Date().toISOString()
                    });
                } catch (historyError) {
                    console.warn('Failed to save MCP run to history:', historyError);
                }

                setAutoCreateEnabled(true);
                onUpdate({
                    docHubAutoCreateEnabled: true,
                    docHubAutoCreateLastRunAt: new Date().toISOString(),
                    docHubAutoCreateLastError: null
                });
                return;
            }

            // Cloud providers (gdrive, onedrive) - use edge functions
            if (!project.docHubRootId) {
                const urlToResolve = rootLink?.trim().replace(/^"|"$/g, '');
                if (!urlToResolve) throw new Error("Chybí odkaz na kořenovou složku.");

                setAutoCreateLogs(prev => [...prev, "Ověřuji / mapuji hlavní složku projektu…"]);
                const resolved = await invokeAuthedFunction<any>("dochub-resolve-root", {
                    body: { provider, projectId: project.id, url: urlToResolve }
                });
                const rName = (resolved as any)?.rootName;
                const rWebUrl = (resolved as any)?.rootWebUrl;
                if (rName) setRootName(rName);
                if (rWebUrl) setRootLink(rWebUrl);
                setStatus("connected");

                onUpdate({
                    docHubEnabled: true,
                    docHubProvider: provider,
                    docHubStatus: "connected",
                    docHubRootName: rName || null,
                    docHubRootLink: rWebUrl || urlToResolve,
                    docHubRootWebUrl: rWebUrl || null,
                    docHubRootId: (resolved as any)?.rootId || null,
                    docHubDriveId: (resolved as any)?.driveId || null,
                    docHubSiteId: (resolved as any)?.siteId || null,
                });
                setAutoCreateProgress(p => Math.max(p, 15));
            }

            const result = await invokeAuthedFunction<any>("dochub-autocreate", { body: { projectId: project.id, runId } });
            setAutoCreateProgress(100);
            setAutoCreateResult({ ...result, runId, finishedAt: new Date().toISOString() });
            setIsResultModalOpen(true);
            loadHistory();

            setAutoCreateEnabled(true);
            onUpdate({
                docHubAutoCreateEnabled: true,
                docHubAutoCreateLastRunAt: new Date().toISOString(),
                docHubAutoCreateLastError: null
            });
        } catch (e: any) {
            const msg = e.message || "Unknown error";
            showMessage("Auto-vytváření selhalo", msg, "danger");
            setBackendStatus('error');
            onUpdate({
                docHubAutoCreateLastError: msg,
                docHubAutoCreateLastRunAt: new Date().toISOString()
            });
        } finally {
            setIsAutoCreating(false);
            if (autoCreateTimerRef.current) window.clearInterval(autoCreateTimerRef.current);
            if (autoCreatePollRef.current) window.clearInterval(autoCreatePollRef.current);
            setTimeout(() => {
                setBackendStep(null);
                setBackendStatus(null);
                setBackendCounts(null);
                setAutoCreateRunId(null);
                setAutoCreateProgress(0);
                setAutoCreateLogs([]);
            }, 2000);
        }
    }, [project, status, provider, rootLink, showMessage, loadHistory, onUpdate]);

    const handleSaveStructure = useCallback(() => {
        console.log('[DocHub] Saving structure with hierarchy:', hierarchyDraft);
        onUpdate({
            docHubStructureV1: {
                ...((project.docHubStructureV1 as any) || {}),
                ...structureDraft,
                extraTopLevel: extraTopLevelDraft,
                extraSupplier: extraSupplierDraft,
                extraHierarchy: hierarchyDraft
            }
        });
        setIsEditingStructure(false);
    }, [structureDraft, extraTopLevelDraft, extraSupplierDraft, hierarchyDraft, project.docHubStructureV1, onUpdate]);

    return {
        state: {
            enabled, rootLink, rootName, provider, mode, status, isEditingSetup, isConnecting,
            autoCreateEnabled, isAutoCreating, autoCreateProgress, autoCreateLogs, backendStep, backendCounts, backendStatus, autoCreateResult, isResultModalOpen,
            structureDraft, extraTopLevelDraft, extraSupplierDraft, hierarchyDraft, isEditingStructure,
            history, isLoadingHistory, modalRequest,
            newFolderName, resolveProgress, links, isConnected, isLocalProvider, isMcpProvider, mcpBridgeStatus
        },
        setters: {
            setEnabled, setRootLink, setRootName, setProvider, setMode, setStatus, setIsEditingSetup,
            setIsResultModalOpen, setStructureDraft, setExtraTopLevelDraft, setExtraSupplierDraft, setHierarchyDraft, setIsEditingStructure,
            clearModalRequest, setNewFolderName, setResolveProgress, setAutoCreateResult
        },
        actions: {
            saveSetup: handleSaveSetup,
            disconnect: handleDisconnect,
            connect: handleConnect,
            runAutoCreate,
            loadHistory,
            saveStructure: handleSaveStructure,
            pickGoogleRoot,
            createGoogleRoot,
            resolveRoot,
            pickLocalFolder,

            connectMcp,
            pickMcpFolder
        }
    };
};
