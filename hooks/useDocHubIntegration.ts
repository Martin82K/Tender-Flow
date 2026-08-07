import { useCallback, useEffect, useRef, useState } from 'react';
import { ProjectDetails } from '../types';
import { dbAdapter } from '../services/dbAdapter';
import { invokeAuthedFunction } from '../services/functionsClient';
import { resolveDocHubStructureV1, getDocHubProjectLinks, DEFAULT_DOCHUB_HIERARCHY, DocHubHierarchyItem, buildHierarchyTree, type DocHubStructureV1 } from '../utils/docHub';
import { isRedirectUrlSafe } from '@shared/security/validateRedirectUrl';
import { isDesktop, fileSystemAdapter, oauthAdapter, storageAdapter } from '../services/platformAdapter';
import { openInExplorer } from '../services/fileSystemService';
import {
    DOC_HUB_PROJECT_MARKER_FILENAME,
    buildDocHubPersonalLocationKey,
    createDocHubProjectMarker,
    joinDocHubPath,
    normalizeDocHubOnlineUrl,
    parseDocHubPersonalLocation,
    parseDocHubProjectMarker,
    resolveEffectiveLocalRoot,
    type DocHubPersonalLocation,
} from '@shared/dochub/personalLocation';

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
    onUpdate: (updates: Partial<ProjectDetails>) => void,
    options: { userId?: string | null } = {},
) => {
    const userId = options.userId ?? null;
    const isProjectOwner = !project.ownerId || project.ownerId === userId;
    const isSharedProject = !!project.ownerId && project.ownerId !== userId;
    const canManageGlobal = isProjectOwner;
    const initialRootLink = project.docHubProvider === 'onedrive'
        ? resolveEffectiveLocalRoot({
            isProjectOwner,
            projectRootPath: project.docHubRootLink,
            personalRootPath: null,
        })
        : project.docHubRootLink || '';
    const docHubStructureKey = JSON.stringify((project.docHubStructureV1 as any) || null);
    // Basic Settings
    const [enabled, setEnabled] = useState(!!project.docHubEnabled);
    const [rootLink, setRootLink] = useState(initialRootLink);
    const [rootName, setRootName] = useState(project.docHubRootName || '');
    const [provider, setProvider] = useState<NonNullable<ProjectDetails["docHubProvider"]> | null>(project.docHubProvider ?? null);
    const [mode, setMode] = useState<"user" | "org" | null>(project.docHubMode ?? "user");
    const [status, setStatus] = useState<"disconnected" | "connected" | "error">(project.docHubStatus || "disconnected");
    const [isEditingSetup, setIsEditingSetup] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [hasPersonalLocalRoot, setHasPersonalLocalRoot] = useState(false);
    const [onlineRootLinkDraft, setOnlineRootLinkDraft] = useState(project.docHubRootWebUrl || '');

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
    const personalLocationLoadedRef = useRef(false);

    useEffect(() => {
        personalLocationLoadedRef.current = false;
        if (!isDesktop || project.docHubProvider !== 'onedrive' || !project.id || !userId) {
            setHasPersonalLocalRoot(false);
            return;
        }

        let cancelled = false;
        void (async () => {
            const key = buildDocHubPersonalLocationKey(userId, project.id!);
            const saved = parseDocHubPersonalLocation(await storageAdapter.get(key), userId, project.id!);
            if (cancelled) return;
            setHasPersonalLocalRoot(!!saved);
            setRootLink(resolveEffectiveLocalRoot({
                isProjectOwner,
                projectRootPath: project.docHubRootLink,
                personalRootPath: saved?.rootPath,
            }));
            if (saved?.rootName) setRootName(saved.rootName);
            personalLocationLoadedRef.current = true;
        })().catch(() => {
            if (!cancelled) personalLocationLoadedRef.current = true;
        });
        return () => { cancelled = true; };
    }, [project.id, project.docHubProvider, project.docHubRootLink, isProjectOwner, userId]);

    // Sync from props
    useEffect(() => {
        setEnabled(!!project.docHubEnabled);
        if (project.docHubProvider !== 'onedrive') {
            setRootLink(project.docHubRootLink || '');
        } else if (!personalLocationLoadedRef.current) {
            setRootLink(resolveEffectiveLocalRoot({
                isProjectOwner,
                projectRootPath: project.docHubRootLink,
                personalRootPath: null,
            }));
        }
        setRootName(project.docHubRootName || '');
        setProvider(project.docHubProvider ?? null);
        setMode(project.docHubMode ?? "user");
        setStatus(project.docHubStatus || (project.docHubEnabled && (project.docHubRootLink || '').trim() ? "connected" : "disconnected"));
        setOnlineRootLinkDraft(project.docHubRootWebUrl || '');
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
        let hierarchyToUse: DocHubHierarchyItem[] = normalizeItems(DEFAULT_DOCHUB_HIERARCHY);
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
    }, [
        project.docHubEnabled,
        project.docHubRootLink,
        project.docHubRootName,
        project.docHubProvider,
        project.docHubMode,
        project.docHubStatus,
        project.docHubRootWebUrl,
        project.docHubAutoCreateEnabled,
        docHubStructureKey,
        isProjectOwner,
    ]);

    // Derived State
    const isAuthed = enabled && status === "connected";
    const isLocalProvider = provider === "onedrive";
    const isConnected = isAuthed && (isLocalProvider ? true : !!project.docHubRootId && rootLink.trim() !== '');
    const onlineRootLink = normalizeDocHubOnlineUrl(project.docHubRootWebUrl || '') ||
        normalizeDocHubOnlineUrl(project.docHubRootLink || '') || '';
    const effectiveStructure = isEditingStructure ? structureDraft : resolveDocHubStructureV1((project.docHubStructureV1 as any) || undefined);

    // Cleanup timers
    useEffect(() => {
        return () => {
            if (autoCreateTimerRef.current) window.clearInterval(autoCreateTimerRef.current);
            if (autoCreatePollRef.current) window.clearInterval(autoCreatePollRef.current);
        };
    }, []);

    // Load Links (skip for local providers - they don't use cloud APIs)
    useEffect(() => {
        if (!isConnected || !project.id) {
            setDocHubBaseLinks(null);
            return;
        }
        // Skip cloud API calls for local providers
        if (isLocalProvider) {
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
    }, [isConnected, project.id, project.docHubStructureV1, isLocalProvider]);

    const fallbackLinks = isConnected ? getDocHubProjectLinks(rootLink, effectiveStructure) : null;
    const links = isConnected ? {
        pd: docHubBaseLinks?.pd ?? fallbackLinks?.pd ?? null,
        tenders: docHubBaseLinks?.tenders ?? fallbackLinks?.tenders ?? null,
        contracts: docHubBaseLinks?.contracts ?? fallbackLinks?.contracts ?? null,
        realization: docHubBaseLinks?.realization ?? fallbackLinks?.realization ?? null,
        archive: docHubBaseLinks?.archive ?? fallbackLinks?.archive ?? null,
        ceniky: docHubBaseLinks?.ceniky ?? fallbackLinks?.ceniky ?? null,
    } : null;


    // Load settings when provider changes
    useEffect(() => {
        if (!provider) return;

        // If we have stored settings for this provider, load them
        const settings = project.docHubSettings?.[provider];
        if (settings) {
            console.log(`[DocHub] Restoring settings for ${provider}`, settings);
            if (settings.rootLink) setRootLink(settings.rootLink);
            if (settings.rootName) setRootName(settings.rootName);
            // If the provider matches the ACTIVE provider saved in project, we can also trust the main props
            // But usually docHubSettings is the source of truth for "standard" paths for that provider.
        } else {
            // New provider selected or no settings yet
            // If it's the SAME as the currently active project provider, we keep current values (already loaded)
            if (provider === project.docHubProvider) {
                // Do nothing, values are already there from initial load
            } else {
                // It's a different provider and no settings saved -> Clear inputs to avoid confusion
                setRootLink('');
                setRootName('');
            }
        }
    }, [provider, project.docHubSettings, project.docHubProvider]);

    // Actions
    const handleSaveSetup = useCallback(() => {
        if (!canManageGlobal) {
            showMessage("Složkomat", "Sdílený uživatel nemůže měnit globální napojení projektu.", "info");
            return;
        }
        const normalizedOnlineUrl = onlineRootLinkDraft.trim()
            ? normalizeDocHubOnlineUrl(onlineRootLinkDraft)
            : null;
        if (onlineRootLinkDraft.trim() && !normalizedOnlineUrl) {
            showMessage("Složkomat", "Online odkaz musí být bezpečná HTTPS adresa Google Drive, OneDrive nebo SharePoint.", "danger");
            return;
        }
        // Prepare new settings object
        const currentSettings = project.docHubSettings || {};
        const newSettings = {
            ...currentSettings,
            [provider!]: {
                rootLink,
                rootName,
                // We could store IDs here too if we have them in state, currently we might only have them if we parsed them
                // But for now, just name and link is enough for the UI restoration.
                // If we want to store rootId, we need to ensure state has it. 
                // State only has derived isAuthed etc.
                // We actully need to store what we have.
                // The main `project` update will store rootId etc in the main fields.
                // We should also store them in settings.
            }
        };

        // Always enable when user explicitly saves setup (they are connecting)
        const shouldBeConnected = !!(rootLink || project.docHubRootId);
        onUpdate({
            docHubEnabled: true,
            docHubRootLink: rootLink,
            docHubRootName: rootName || null,
            docHubProvider: provider,
            docHubMode: mode,
            docHubStatus: shouldBeConnected ? "connected" : "disconnected",
            docHubRootWebUrl: normalizedOnlineUrl,
            docHubStructureVersion: project.docHubStructureVersion ?? 1,
            docHubSettings: newSettings,
            // Set rootId for local providers (needed for proper connection tracking)
            ...(provider === 'onedrive' && rootLink ? { docHubRootId: `local:${rootLink}` } : {}),
        });
        setIsEditingSetup(false);
    }, [canManageGlobal, onlineRootLinkDraft, rootLink, rootName, provider, mode, project.docHubRootId, project.docHubStructureVersion, project.docHubSettings, onUpdate, showMessage]);

    const handleDisconnect = useCallback(() => {
        if (!canManageGlobal && project.id && userId) {
            void storageAdapter.delete(buildDocHubPersonalLocationKey(userId, project.id));
            setRootLink("");
            setRootName(project.docHubRootName || "");
            setHasPersonalLocalRoot(false);
            setIsEditingSetup(false);
            return;
        }
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
    }, [canManageGlobal, onUpdate, project.docHubRootName, project.id, userId]);

    const handleConnect = useCallback(async () => {
        if (!canManageGlobal) {
            showMessage("Složkomat", "Globální cloudové napojení může měnit pouze vlastník projektu.", "info");
            return;
        }
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
            if (provider === "gdrive" && isDesktop) {
                const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID_DESKTOP as string | undefined;

                console.log('DEBUG Google Login:', {
                    hasClientId: !!clientId,
                    clientIdPrefix: clientId?.substring(0, 5),
                });

                if (!clientId) {
                    throw new Error("Chybí VITE_GOOGLE_OAUTH_CLIENT_ID_DESKTOP v .env.");
                }

                if (!oauthAdapter.isAvailable()) {
                    throw new Error("Desktop OAuth není dostupný.");
                }

                const token = await oauthAdapter.googleLogin({
                    clientId,
                    scopes: [
                        "https://www.googleapis.com/auth/drive.file",
                        "openid",
                        "email",
                        "profile",
                    ],
                });

                if (!token?.accessToken || !token?.expiresIn || !token?.tokenType) {
                    throw new Error("Google OAuth nevrátil token.");
                }

                await invokeAuthedFunction("dochub-google-desktop-token", {
                    body: {
                        projectId: project.id,
                        mode,
                        token: {
                            accessToken: token.accessToken,
                            refreshToken: token.refreshToken ?? null,
                            scope: token.scope ?? null,
                            tokenType: token.tokenType,
                            expiresIn: token.expiresIn,
                            clientId,
                        },
                    },
                });

                setStatus("connected");
                onUpdate({
                    docHubEnabled: true,
                    docHubProvider: "gdrive",
                    docHubMode: mode,
                    docHubStatus: "connected",
                });
                showMessage("Hotovo", "Google Drive připojen.", "success");
                setIsConnecting(false);

                // Auto-open picker removed - explicit flow preferred
                return;
            }

            const returnTo = `${window.location.origin}/app?dochub=1`;
            const data = await invokeAuthedFunction<{ url?: string }>("dochub-auth-url", {
                body: { provider, mode, projectId: project.id, returnTo }
            });
            const url = data?.url;
            if (!url) throw new Error("Backend nevrátil autorizační URL.");
            if (!isRedirectUrlSafe(url)) throw new Error("Neplatná autorizační URL.");
            window.location.href = url;
        } catch (e) {
            console.error(e);
            showMessage("Chyba připojení", e instanceof Error ? e.message : String(e), "danger");
            setIsConnecting(false);
        }
    }, [canManageGlobal, provider, mode, project.id, showMessage]);

    const loadHistory = useCallback(async () => {
        if (!project.id) return;
        setIsLoadingHistory(true);
        try {
            const { data, error } = await dbAdapter
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



    const createGoogleRoot = useCallback(async () => {
        if (!canManageGlobal) {
            showMessage("Složkomat", "Cloudovou složku může vytvořit pouze vlastník projektu.", "info");
            return;
        }
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
    }, [canManageGlobal, provider, project.id, newFolderName, showMessage, rootLink, onUpdate]);

    const savePersonalLocalRoot = useCallback(async (path: string, folderName: string) => {
        if (!isDesktop || !project.id || !userId) {
            throw new Error("Osobní cesta je dostupná pouze přihlášenému uživateli v desktopové aplikaci.");
        }
        if (!(await fileSystemAdapter.folderExists(path))) {
            throw new Error("Vybraná složka neexistuje nebo k ní aplikace nemá přístup.");
        }

        const markerPath = joinDocHubPath(path, DOC_HUB_PROJECT_MARKER_FILENAME);
        let validMarker = false;
        try {
            const bytes = await fileSystemAdapter.readFile(markerPath, { maxBytes: 64 * 1024 });
            validMarker = !!parseDocHubProjectMarker(new TextDecoder().decode(bytes), project.id);
        } catch {
            validMarker = false;
        }

        if (!validMarker && !isProjectOwner) {
            throw new Error("Vybraná složka nepatří k tomuto projektu. Vlastník ji musí nejprve připojit v Tender Flow.");
        }
        if (!validMarker) {
            await fileSystemAdapter.writeFile(markerPath, createDocHubProjectMarker(project.id));
        }

        const location: DocHubPersonalLocation = {
            version: 1,
            userId,
            projectId: project.id,
            rootPath: path,
            rootName: folderName,
            savedAt: new Date().toISOString(),
        };
        await storageAdapter.set(
            buildDocHubPersonalLocationKey(userId, project.id),
            JSON.stringify(location),
        );
        setHasPersonalLocalRoot(true);
    }, [isProjectOwner, project.id, userId]);

    const resolveRoot = useCallback(async () => {
        if (!provider || !rootLink.trim()) return;
        if (!canManageGlobal && provider !== 'onedrive') {
            showMessage("Složkomat", "Globální cloudové napojení může měnit pouze vlastník projektu.", "info");
            return;
        }
        setResolveProgress(10); // Fake start
        setIsConnecting(true); // Reuse connecting state

        // Handle local provider (Tender Flow Desktop) without backend call
        if (provider === 'onedrive') {
            try {
                const path = rootLink.trim();
                // Grant access for paths outside default allowed roots (e.g. D:\, network shares)
                if (isDesktop) {
                    const granted = await fileSystemAdapter.grantAccess(path);
                    if (!granted) {
                        throw new Error("Přístup ke složce nebyl potvrzen. Vyberte prosím cílovou složku nebo její existující nadřazenou složku.");
                    }
                }
                await savePersonalLocalRoot(path, path.split(/[\\/]/).pop() || path);

                // For Desktop, we generally trust the user or the picker, but good to check
                /* 
                if (!exists && provider === 'onedrive' && isDesktop) {
                    // Optional: warn or ask to create? 
                    // For now, accept it. Pipeline will try to create structure later.
                }
                */

                const folderName = path.split(/[\\/]/).pop() || path;
                const normalizedOnlineUrl = onlineRootLinkDraft.trim()
                    ? normalizeDocHubOnlineUrl(onlineRootLinkDraft)
                    : null;
                if (onlineRootLinkDraft.trim() && !normalizedOnlineUrl) {
                    throw new Error("Online odkaz musí být bezpečná HTTPS adresa Google Drive, OneDrive nebo SharePoint.");
                }
                setResolveProgress(50);

                await new Promise(r => setTimeout(r, 500)); // UI feel

                setRootName(folderName);
                setStatus("connected");
                if (canManageGlobal) {
                    onUpdate({
                        docHubEnabled: true,
                        docHubProvider: provider,
                        docHubStatus: "connected",
                        docHubRootName: folderName,
                        docHubRootLink: path,
                        docHubRootWebUrl: normalizedOnlineUrl,
                        docHubRootId: `local:${path}`,
                        docHubDriveId: null,
                        docHubSiteId: null,
                    });
                }
                setResolveProgress(100);
            } catch (e: any) {
                showMessage("Chyba", e.message || "Nelze ověřit složku", "danger");
                setResolveProgress(0);
            } finally {
                setTimeout(() => { setIsConnecting(false); setResolveProgress(0); }, 500);
            }
            return;
        }

        // Handle Cloud Providers (via Backend)
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
    }, [canManageGlobal, onlineRootLinkDraft, provider, project.id, rootLink, savePersonalLocalRoot, showMessage, onUpdate]);

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
                const normalizedOnlineUrl = onlineRootLinkDraft.trim()
                    ? normalizeDocHubOnlineUrl(onlineRootLinkDraft)
                    : null;
                if (onlineRootLinkDraft.trim() && !normalizedOnlineUrl) {
                    throw new Error("Online odkaz musí být bezpečná HTTPS adresa Google Drive, OneDrive nebo SharePoint.");
                }

                await savePersonalLocalRoot(folderPath, folderName);

                setRootName(folderName);
                setRootLink(folderPath);
                setStatus("connected");
                if (canManageGlobal) {
                    onUpdate({
                        docHubEnabled: true,
                        docHubProvider: "onedrive",
                        docHubStatus: "connected",
                        docHubRootName: folderName,
                        docHubRootLink: folderPath,
                        docHubRootWebUrl: normalizedOnlineUrl,
                        docHubRootId: `local:${folderPath}`,
                        docHubDriveId: null,
                        docHubSiteId: null,
                    });
                }
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
    }, [canManageGlobal, onlineRootLinkDraft, provider, savePersonalLocalRoot, showMessage, onUpdate]);

    const runAutoCreate = useCallback(async () => {
        if (!canManageGlobal) { showMessage("Složkomat", "Strukturu složek může synchronizovat pouze vlastník projektu.", "info"); return; }
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
                const { data } = await dbAdapter.from("dochub_autocreate_runs").select("*").eq("id", runId).maybeSingle();
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
            // Local Provider (Tender Flow Desktop with native fs) - handle via fileSystemService
            if (provider === "onedrive") {
                const { isDesktop } = await import('../services/platformAdapter');

                if (!isDesktop) {
                    throw new Error("Tender Flow Desktop provider vyžaduje desktopovou aplikaci.");
                }

                setAutoCreateLogs(prev => [...prev, "Vytvářím složky přes Tender Flow Desktop…"]);

                // Prepare categories and suppliers data
                const categories = project.categories?.map(c => ({ id: c.id, title: c.title })) || [];
                const suppliers: Record<string, Array<{ id: string; name: string }>> = {};

                if (project.bids) {
                    for (const [categoryId, bids] of Object.entries(project.bids)) {
                        suppliers[categoryId] = bids.map(b => ({ id: b.subcontractorId, name: b.companyName }));
                    }
                }

                const hierarchyTree = buildHierarchyTree(hierarchyDraft);

                // Use fileSystemService.ensureStructure
                const { ensureStructure } = await import('../services/fileSystemService');
                const result = await ensureStructure({
                    rootPath: rootLink.trim(),
                    structure: (project.docHubStructureV1 as any) || {},
                    categories,
                    suppliers,
                    hierarchy: hierarchyTree
                });

                setAutoCreateLogs(result.logs);
                setAutoCreateProgress(100);
                setAutoCreateResult({
                    createdCount: result.createdCount,
                    runId: null,
                    logs: result.logs,
                    finishedAt: new Date().toISOString()
                });
                setIsResultModalOpen(true);
                setBackendStatus(result.success ? 'success' : 'error');

                if (result.success) {
                    setAutoCreateEnabled(true);
                    onUpdate({
                        docHubAutoCreateEnabled: true,
                        docHubAutoCreateLastRunAt: new Date().toISOString(),
                        docHubAutoCreateLastError: null
                    });
                } else {
                    onUpdate({
                        docHubAutoCreateLastError: result.error || 'Unknown error',
                        docHubAutoCreateLastRunAt: new Date().toISOString()
                    });
                }

                return;
            }

            // Cloud providers (gdrive) - use edge functions
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
    }, [canManageGlobal, project, status, provider, rootLink, showMessage, loadHistory, onUpdate]);

    const handleSaveStructure = useCallback(() => {
        if (!canManageGlobal) {
            showMessage("Složkomat", "Strukturu složek může měnit pouze vlastník projektu.", "info");
            return;
        }
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
    }, [canManageGlobal, structureDraft, extraTopLevelDraft, extraSupplierDraft, hierarchyDraft, project.docHubStructureV1, onUpdate, showMessage]);

    return {
        state: {
            enabled, rootLink, rootName, provider, mode, status, isEditingSetup, isConnecting,
            autoCreateEnabled, isAutoCreating, autoCreateProgress, autoCreateLogs, backendStep, backendCounts, backendStatus, autoCreateResult, isResultModalOpen,
            structureDraft, extraTopLevelDraft, extraSupplierDraft, hierarchyDraft, isEditingStructure,
            history, isLoadingHistory, modalRequest,
            newFolderName, resolveProgress, links, isConnected, isLocalProvider,
            onlineRootLink, onlineRootLinkDraft, isProjectOwner, isSharedProject, canManageGlobal, hasPersonalLocalRoot
        },
        setters: {
            setEnabled, setRootLink, setRootName, setProvider, setMode, setStatus, setIsEditingSetup, setOnlineRootLinkDraft,
            setIsResultModalOpen, setStructureDraft, setExtraTopLevelDraft, setExtraSupplierDraft, setHierarchyDraft, setIsEditingStructure,
            clearModalRequest, setNewFolderName, setResolveProgress, setAutoCreateResult
        },
        actions: {
            saveSetup: handleSaveSetup,
            disconnect: handleDisconnect,
            connect: handleConnect,
            openRoot: useCallback(async () => {
                const link = rootLink?.trim();
                if (!link) return;

                // Check if it's a web URL
                const isWebUrl = /^https?:\/\//i.test(link);

                if (isWebUrl) {
                    const safeLink = normalizeDocHubOnlineUrl(link);
                    if (!safeLink) {
                        showMessage("Složkomat", "Odkaz nevede na podporované cloudové úložiště.", "danger");
                        return;
                    }
                    window.open(safeLink, '_blank', 'noopener,noreferrer');
                } else if (isDesktop) {
                    // Open local path via Platform Adapter (Electron)
                    // Uses openInExplorer which works for folders
                    await openInExplorer(link);
                }
            }, [rootLink, showMessage]),
            runAutoCreate,
            loadHistory,
            saveStructure: handleSaveStructure,
            createGoogleRoot,
            resolveRoot,
            pickLocalFolder
        }
    };
};
