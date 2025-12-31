
import React, { useState, useEffect, useRef } from 'react';
import { Header } from './Header';
import { Pipeline } from './Pipeline';
import { TenderPlan } from './TenderPlan';
import { ProjectTab, ProjectDetails, ContractDetails, InvestorFinancials, DemandCategory, Bid, Subcontractor, StatusConfig, Template } from '../types';
import { uploadDocument, formatFileSize } from '../services/documentService';
import { TemplateManager } from './TemplateManager';
import { getTemplateById } from '../services/templateService';
import { ProjectOverviewNew } from './ProjectOverviewNew';
import { getDocHubProjectLinks, isProbablyUrl, resolveDocHubStructureV1 } from '../utils/docHub';
import { supabase } from '../services/supabase';
import { invokeAuthedFunction } from '../services/functionsClient';
import { ConfirmationModal } from './ConfirmationModal';

// --- Helper Functions ---
const parseMoney = (valueStr: string): number => {
    if (!valueStr || valueStr === '-' || valueStr === '?') return 0;

    // Check for M (millions) or K (thousands) suffix first
    const hasM = /M/i.test(valueStr);
    const hasK = /K/i.test(valueStr) && !/Kč/i.test(valueStr); // K but not Kč

    // Remove all non-numeric characters except comma and dot
    // Czech format uses spaces for thousands and comma for decimals
    const cleanStr = valueStr
        .replace(/\s/g, '')     // Remove all whitespace/spaces
        .replace(/[^0-9,.-]/g, '') // Keep only digits, comma, dot, minus
        .replace(',', '.');     // Replace comma with dot for parseFloat

    let val = parseFloat(cleanStr);

    if (hasM) val *= 1000000;
    else if (hasK) val *= 1000;

    return isNaN(val) ? 0 : val;
};

const formatMoney = (val: number): string => {
    if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M Kč';
    return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(val);
};

const formatMoneyFull = (val: number): string => {
    return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(val);
};

// --- Sub-Components ---

interface ProjectDocumentsProps {
    project: ProjectDetails;
    onUpdate: (updates: Partial<ProjectDetails>) => void;
}

const ProjectDocuments: React.FC<ProjectDocumentsProps> = ({ project, onUpdate }) => {
    type DocumentsSubTab = 'pd' | 'templates' | 'dochub';
    const [isEditingDocs, setIsEditingDocs] = useState(false);
    const [isEditingLetter, setIsEditingLetter] = useState(false);
    const [documentsSubTab, setDocumentsSubTab] = useState<DocumentsSubTab>('pd');
    const [docsLinkValue, setDocsLinkValue] = useState('');
    const [letterLinkValue, setLetterLinkValue] = useState('');
    const [docHubEnabled, setDocHubEnabled] = useState(false);
    const [docHubRootLink, setDocHubRootLink] = useState('');
    const [docHubRootName, setDocHubRootName] = useState<string>('');
    const [docHubProvider, setDocHubProvider] = useState<"gdrive" | "onedrive" | null>(null);
    const [docHubMode, setDocHubMode] = useState<"user" | "org" | null>(null);
    const [docHubStatus, setDocHubStatus] = useState<"disconnected" | "connected" | "error">("disconnected");
    const [isEditingDocHubSetup, setIsEditingDocHubSetup] = useState(false);
    const [isDocHubConnecting, setIsDocHubConnecting] = useState(false);
    const [selectedTemplateFile, setSelectedTemplateFile] = useState<File | null>(null);
    const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
    const [showTemplateManager, setShowTemplateManager] = useState(false);
    const [templateName, setTemplateName] = useState<string | null>(null);

    useEffect(() => {
        setDocsLinkValue(project.documentationLink || '');
    }, [project.documentationLink, isEditingDocs]);

    useEffect(() => {
        setLetterLinkValue(project.inquiryLetterLink || '');
    }, [project.inquiryLetterLink, isEditingLetter]);

    useEffect(() => {
        setDocHubEnabled(!!project.docHubEnabled);
        setDocHubRootLink(project.docHubRootLink || '');
        setDocHubRootName(project.docHubRootName || '');
        setDocHubProvider(project.docHubProvider ?? null);
        setDocHubMode(project.docHubMode ?? null);
        setDocHubStatus(project.docHubStatus || (project.docHubEnabled && (project.docHubRootLink || '').trim() ? "connected" : "disconnected"));
        setIsEditingDocHubSetup(false);
    }, [project.docHubEnabled, project.docHubRootLink, project.docHubRootName, project.docHubProvider, project.docHubMode, project.docHubStatus]);

    // Load template name asynchronously
    useEffect(() => {
        if (project.inquiryLetterLink?.startsWith('template:')) {
            const templateId = project.inquiryLetterLink.split(':')[1];
            getTemplateById(templateId).then(template => {
                setTemplateName(template?.name || 'Neznámá šablona');
            });
        } else {
            setTemplateName(null);
        }
    }, [project.inquiryLetterLink]);

    const handleSaveDocs = () => {
        onUpdate({ documentationLink: docsLinkValue });
        setIsEditingDocs(false);
    };

    const docHubStructure = resolveDocHubStructureV1(project.docHubStructureV1 || undefined);
    const [isEditingDocHubStructure, setIsEditingDocHubStructure] = useState(false);
    const [docHubStructureDraft, setDocHubStructureDraft] = useState(docHubStructure);
    const [docHubAutoCreateEnabled, setDocHubAutoCreateEnabled] = useState(!!project.docHubAutoCreateEnabled);
    const [isDocHubAutoCreating, setIsDocHubAutoCreating] = useState(false);
    const [docHubAutoCreateProgress, setDocHubAutoCreateProgress] = useState(0);
    const [docHubAutoCreateLogs, setDocHubAutoCreateLogs] = useState<string[]>([]);
    const autoCreateTimerRef = useRef<number | null>(null);
    const autoCreatePollRef = useRef<number | null>(null);
    const [docHubAutoCreateRunId, setDocHubAutoCreateRunId] = useState<string | null>(null);
    const [docHubBackendStep, setDocHubBackendStep] = useState<string | null>(null);
    const [docHubBackendCounts, setDocHubBackendCounts] = useState<{ done: number; total: number | null } | null>(null);
    const [docHubExtraTopLevelDraft, setDocHubExtraTopLevelDraft] = useState<string[]>(() => {
        const raw = (project.docHubStructureV1 as any)?.extraTopLevel;
        return Array.isArray(raw) ? raw.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim()) : [];
    });
    const [docHubExtraSupplierDraft, setDocHubExtraSupplierDraft] = useState<string[]>(() => {
        const raw = (project.docHubStructureV1 as any)?.extraSupplier;
        return Array.isArray(raw) ? raw.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim()) : [];
    });
    const [docHubNewFolderName, setDocHubNewFolderName] = useState(project.title || project.name || "");
    const [docHubResolveProgress, setDocHubResolveProgress] = useState(0);
    const resolveProgressTimerRef = useRef<number | null>(null);
    const [uiModal, setUiModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        variant: 'danger' | 'info' | 'success';
    }>({ isOpen: false, title: '', message: '', variant: 'info' });

    const showModal = (args: { title: string; message: string; variant?: 'danger' | 'info' | 'success' }) => {
        setUiModal({
            isOpen: true,
            title: args.title,
            message: args.message,
            variant: args.variant ?? 'info',
        });
    };

    useEffect(() => {
        setDocHubStructureDraft(resolveDocHubStructureV1(project.docHubStructureV1 || undefined));
        const rawTop = (project.docHubStructureV1 as any)?.extraTopLevel;
        const rawSupplier = (project.docHubStructureV1 as any)?.extraSupplier;
        setDocHubExtraTopLevelDraft(
            Array.isArray(rawTop) ? rawTop.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim()) : []
        );
        setDocHubExtraSupplierDraft(
            Array.isArray(rawSupplier) ? rawSupplier.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim()) : []
        );
        setIsEditingDocHubStructure(false);
    }, [project.docHubStructureV1]);

    useEffect(() => {
        setDocHubNewFolderName(project.title || project.name || "");
    }, [project.title, (project as any).name]);

    useEffect(() => {
        setDocHubAutoCreateEnabled(!!project.docHubAutoCreateEnabled);
    }, [project.docHubAutoCreateEnabled]);

    const handleSaveDocHub = () => {
        onUpdate({
            docHubEnabled,
            docHubRootLink,
            docHubRootName: docHubRootName || null,
            docHubProvider,
            docHubMode,
            // Consider DocHub connected only after root mapping (rootId) exists.
            docHubStatus: docHubEnabled && project.docHubRootId ? "connected" : "disconnected",
            docHubStructureVersion: project.docHubStructureVersion ?? 1
        });
        setIsEditingDocHubSetup(false);
    };

    const handleRunDocHubAutoCreate = async () => {
        if (!project.id) {
            showModal({ title: "DocHub", message: "Chybí ID projektu.", variant: "danger" });
            return;
        }
        if (!isDocHubConnected) {
            showModal({ title: "DocHub", message: "Nejdřív připojte DocHub a nastavte hlavní složku projektu.", variant: "info" });
            return;
        }
        if (!docHubProvider) {
            showModal({ title: "DocHub", message: "Chybí provider DocHubu.", variant: "danger" });
            return;
        }

        setIsDocHubAutoCreating(true);
        setDocHubAutoCreateProgress(0);
        setDocHubAutoCreateLogs(["Zahajuji auto‑vytváření složek…"]);
        setDocHubBackendStep(null);
        setDocHubBackendCounts(null);

        const runId = crypto.randomUUID();
        setDocHubAutoCreateRunId(runId);

        if (autoCreatePollRef.current) {
            window.clearInterval(autoCreatePollRef.current);
            autoCreatePollRef.current = null;
        }

        autoCreatePollRef.current = window.setInterval(async () => {
            try {
                const { data, error } = await supabase
                    .from("dochub_autocreate_runs")
                    .select("status, step, progress_percent, total_actions, completed_actions, logs, error, finished_at")
                    .eq("id", runId)
                    .maybeSingle();
                if (error || !data) return;

                if (typeof data.progress_percent === "number") {
                    setDocHubAutoCreateProgress((prev) => Math.max(prev, data.progress_percent));
                }
                if (typeof data.step === "string" && data.step.trim()) {
                    setDocHubBackendStep(data.step);
                }
                const totalActions = typeof data.total_actions === "number" ? data.total_actions : null;
                const completedActions = typeof data.completed_actions === "number" ? data.completed_actions : 0;
                setDocHubBackendCounts({ done: completedActions, total: totalActions });

                if (Array.isArray(data.logs) && data.logs.length > 0) {
                    setDocHubAutoCreateLogs(data.logs as string[]);
                }

                if (data.status === "success" || data.status === "error" || data.finished_at) {
                    if (autoCreatePollRef.current) {
                        window.clearInterval(autoCreatePollRef.current);
                        autoCreatePollRef.current = null;
                    }
                }
            } catch {
                // Ignore polling errors (best-effort UI)
            }
        }, 450);

        if (autoCreateTimerRef.current) {
            window.clearInterval(autoCreateTimerRef.current);
            autoCreateTimerRef.current = null;
        }
        const start = Date.now();
        autoCreateTimerRef.current = window.setInterval(() => {
            const elapsed = Date.now() - start;
            const next = Math.min(90, Math.round((elapsed / 2500) * 90));
            setDocHubAutoCreateProgress((prev) => (prev >= 90 ? prev : Math.max(prev, next)));
        }, 60);

        try {
            // Ensure we have a resolved root id (required by backend autocreate).
            const hasRoot = !!project.docHubRootId;
            if (!hasRoot) {
                const urlToResolve = docHubRootLink?.trim();
                if (!urlToResolve) {
                    throw new Error("Chybí hlavní složka projektu. Vložte odkaz a klikněte na „Získat odkaz“.");
                }

                setDocHubAutoCreateLogs((prev) => [...prev, "Ověřuji / mapuji hlavní složku projektu…"]);
                const resolved = await invokeAuthedFunction<any>("dochub-resolve-root", {
                    body: { provider: docHubProvider, projectId: project.id, url: urlToResolve }
                });
                const rootName = (resolved as any)?.rootName as string | undefined;
                const rootWebUrl = (resolved as any)?.rootWebUrl as string | undefined;
                if (rootName) setDocHubRootName(rootName);
                if (rootWebUrl) setDocHubRootLink(rootWebUrl);
                setDocHubStatus("connected");
                onUpdate({
                    docHubEnabled: true,
                    docHubProvider,
                    docHubStatus: "connected",
                    docHubRootName: rootName || null,
                    docHubRootLink: rootWebUrl || urlToResolve,
                    docHubRootWebUrl: rootWebUrl || null,
                    docHubRootId: (resolved as any)?.rootId || null,
                    docHubDriveId: (resolved as any)?.driveId || null,
                    docHubSiteId: (resolved as any)?.siteId || null,
                });
                setDocHubAutoCreateProgress((prev) => Math.max(prev, 15));
            }

            const result = await invokeAuthedFunction<any>("dochub-autocreate", {
                body: { projectId: project.id, runId }
            });
            const logs = Array.isArray(result?.logs) ? result.logs : [];
            if (logs.length) setDocHubAutoCreateLogs(logs);
            setDocHubAutoCreateProgress(100);

            setDocHubAutoCreateEnabled(true);
            onUpdate({
                docHubAutoCreateEnabled: true,
                docHubAutoCreateLastRunAt: new Date().toISOString(),
                docHubAutoCreateLastError: null,
            });

            const createdCount = typeof result?.createdCount === "number" ? result.createdCount : null;
            showModal({
                title: "Auto‑vytváření dokončeno",
                message: createdCount === null ? "Složky byly zkontrolovány / doplněny." : `Složky byly zkontrolovány / doplněny. Akcí: ${createdCount}`,
                variant: "success"
            });
        } catch (e) {
            const rawMessage = e instanceof Error ? e.message : "Neznámá chyba";
            const message =
                rawMessage.includes("Could not find a relationship between") &&
                rawMessage.includes("'bids'") &&
                rawMessage.includes("'subcontractors'")
                    ? "Auto‑vytváření narazilo na chybu Supabase/PostgREST (chybí relace `bids` ↔ `subcontractors` v schema cache).\n\nŘešení:\n- pokud používáte Supabase Edge Function `dochub-autocreate`, nasadit (deploy) její aktuální verzi z repa\n- nebo opravit/ověřit FK `bids.subcontractor_id -> subcontractors.id` a následně počkat na refresh schema cache (případně restartovat PostgREST / Supabase API)\n\nDočasně: auto‑vytváření lze spustit i bez načítání dodavatelů, ale v takovém případě se nevytvoří podsložky pro konkrétní dodavatele."
                    :
                rawMessage === "Missing DocHub root"
                    ? "Chybí namapovaná hlavní složka projektu. Klikněte na „Získat odkaz“ (nebo vyberte složku) a zkuste to znovu."
                    : rawMessage.includes("SPO license")
                        ? "Microsoft/OneDrive: Tenhle účet (tenant) nemá licenci SharePoint Online, takže nejde pracovat se složkami přes Graph API.\n\nŘešení: v Microsoft 365 admin centru přiřaďte uživateli licenci s SharePoint Online / OneDrive for Business (např. Microsoft 365 Business Standard/E3) nebo použijte tenant/uživatele, který licenci má."
                    : rawMessage;
            setDocHubAutoCreateEnabled(false);
            onUpdate({
                docHubAutoCreateEnabled: false,
                docHubAutoCreateLastRunAt: new Date().toISOString(),
                docHubAutoCreateLastError: message,
            });
            showModal({ title: "Auto‑vytváření selhalo", message, variant: "danger" });
        } finally {
            setIsDocHubAutoCreating(false);
            if (autoCreateTimerRef.current) {
                window.clearInterval(autoCreateTimerRef.current);
                autoCreateTimerRef.current = null;
            }
            if (autoCreatePollRef.current) {
                window.clearInterval(autoCreatePollRef.current);
                autoCreatePollRef.current = null;
            }
            window.setTimeout(() => {
                setDocHubAutoCreateProgress(0);
                setDocHubAutoCreateLogs([]);
                setDocHubBackendStep(null);
                setDocHubBackendCounts(null);
                setDocHubAutoCreateRunId(null);
            }, 1200);
        }
    };

    const handleToggleDocHubAutoCreate = async (enabled: boolean) => {
        if (!enabled) {
            setDocHubAutoCreateEnabled(false);
            onUpdate({ docHubAutoCreateEnabled: false });
            return;
        }
        if (!isDocHubConnected) {
            showModal({ title: "DocHub", message: "Nejdřív připojte DocHub a nastavte hlavní složku projektu.", variant: "info" });
            return;
        }
        setDocHubAutoCreateEnabled(true);
        onUpdate({ docHubAutoCreateEnabled: true });
        await handleRunDocHubAutoCreate();
    };

    const handleDisconnectDocHub = () => {
        setDocHubRootLink("");
        setDocHubRootName("");
        setDocHubProvider(null);
        setDocHubMode(null);
        setDocHubStatus("disconnected");
        setIsEditingDocHubSetup(false);
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
    };

    const handleConnectDocHub = async () => {
        if (!docHubProvider || !docHubMode) {
            showModal({ title: "DocHub", message: "Vyberte provider a režim.", variant: "info" });
            return;
        }
        if (!project.id) {
            showModal({ title: "DocHub", message: "Chybí ID projektu (nelze připojit DocHub).", variant: "danger" });
            return;
        }

        setIsDocHubConnecting(true);
        try {
            // Always return back into the SPA shell after OAuth. Redirecting to a module URL
            // (e.g. `/App.tsx`) would make the browser render raw Vite-transformed JS.
            const returnTo = `${window.location.origin}/app?dochub=1`;
            const data = await invokeAuthedFunction<{ url?: string }>("dochub-auth-url", {
                body: { provider: docHubProvider, mode: docHubMode, projectId: project.id, returnTo }
            });
            const url = data?.url;
            if (!url) throw new Error("Backend nevrátil autorizační URL.");
            window.location.href = url;
        } catch (e) {
            const message = e instanceof Error ? e.message : "Neznámá chyba připojení";
            showModal({
                title: "Nelze spustit připojení",
                message: `${message}\n\nTip: pro lokální běh je potřeba Supabase Edge Functions a nastavené OAuth env.`,
                variant: "danger",
            });
        } finally {
            setIsDocHubConnecting(false);
        }
    };

    const handleResolveDocHubRoot = async () => {
        if (!docHubProvider) {
            showModal({ title: "DocHub", message: "Vyberte provider.", variant: "info" });
            return;
        }
        if (!project.id) {
            showModal({ title: "DocHub", message: "Chybí ID projektu.", variant: "danger" });
            return;
        }
        if (!docHubRootLink.trim()) {
            showModal({ title: "DocHub", message: "Zadejte odkaz na složku.", variant: "info" });
            return;
        }

        setIsDocHubConnecting(true);
        setDocHubResolveProgress(0);
        if (resolveProgressTimerRef.current) {
            window.clearInterval(resolveProgressTimerRef.current);
            resolveProgressTimerRef.current = null;
        }
        const start = Date.now();
        resolveProgressTimerRef.current = window.setInterval(() => {
            const elapsed = Date.now() - start;
            const next = Math.min(90, Math.round((elapsed / 1200) * 90));
            setDocHubResolveProgress((prev) => (prev >= 90 ? prev : Math.max(prev, next)));
        }, 50);
        try {
            const data = await invokeAuthedFunction<any>("dochub-resolve-root", {
                body: { provider: docHubProvider, projectId: project.id, url: docHubRootLink }
            });
            const rootName = (data as any)?.rootName as string | undefined;
            const rootWebUrl = (data as any)?.rootWebUrl as string | undefined;
            if (rootName) setDocHubRootName(rootName);
            if (rootWebUrl) setDocHubRootLink(rootWebUrl);
            setDocHubStatus("connected");
            onUpdate({
                docHubEnabled: true,
                docHubProvider,
                docHubStatus: "connected",
                docHubRootName: rootName || null,
                docHubRootLink: rootWebUrl || docHubRootLink,
                docHubRootWebUrl: rootWebUrl || null,
                docHubRootId: (data as any)?.rootId || null,
                docHubDriveId: (data as any)?.driveId || null
            });
            setDocHubResolveProgress(100);
            showModal({ title: "Hotovo", message: "Hlavní složka projektu ověřena a uložena.", variant: "success" });
        } catch (e) {
            const rawMessage = e instanceof Error ? e.message : "Neznámá chyba";
            const message = rawMessage.includes("SPO license")
                ? "Microsoft/OneDrive: Tenhle účet (tenant) nemá licenci SharePoint Online, takže nelze ověřit sdílený odkaz.\n\nŘešení: přiřaďte uživateli licenci s SharePoint Online / OneDrive for Business (např. Microsoft 365 Business Standard/E3) nebo použijte tenant/uživatele, který licenci má."
                : rawMessage;
            showModal({ title: "Získání odkazu selhalo", message, variant: "danger" });
        } finally {
            setIsDocHubConnecting(false);
            if (resolveProgressTimerRef.current) {
                window.clearInterval(resolveProgressTimerRef.current);
                resolveProgressTimerRef.current = null;
            }
            window.setTimeout(() => setDocHubResolveProgress(0), 400);
        }
    };

    const ensureScript = (() => {
        const loaded = new Map<string, Promise<void>>();
        return (src: string) => {
            if (loaded.has(src)) return loaded.get(src)!;
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
            loaded.set(src, promise);
            return promise;
        };
    })();

    const handlePickGoogleDriveRoot = async () => {
        if (docHubProvider !== "gdrive") {
            showModal({ title: "DocHub", message: "Vyberte Google Drive jako provider.", variant: "info" });
            return;
        }
        if (!project.id) {
            showModal({ title: "DocHub", message: "Chybí ID projektu.", variant: "danger" });
            return;
        }
        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
        if (!apiKey) {
            showModal({ title: "Chybí konfigurace", message: "Chybí VITE_GOOGLE_API_KEY (Google Picker developer key).", variant: "danger" });
            return;
        }

        setIsDocHubConnecting(true);
        try {
            const tokenData = await invokeAuthedFunction<{ accessToken?: string }>("dochub-google-picker-token");
            const pickerAccessToken = tokenData?.accessToken;
            if (!pickerAccessToken) throw new Error("Backend nevrátil accessToken.");

            await ensureScript("https://apis.google.com/js/api.js");
            const gapi = window.gapi;
            if (!gapi?.load) throw new Error("Google API script nebyl načten správně.");

            await new Promise<void>((resolve) => {
                gapi.load("picker", { callback: resolve });
            });

            const picker = new window.google.picker.PickerBuilder()
                .addView(
                    new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
                        .setIncludeFolders(true)
                        .setSelectFolderEnabled(true)
                )
                .setOAuthToken(pickerAccessToken)
                .setDeveloperKey(apiKey)
                .setCallback(async (data: any) => {
                    if (data?.action !== window.google.picker.Action.PICKED) return;
                    const doc = data?.docs?.[0];
                    const rootId = doc?.id as string | undefined;
                    if (!rootId) return;

                    try {
                        const resolved = await invokeAuthedFunction<any>("dochub-resolve-root", {
                            body: { provider: "gdrive", projectId: project.id, rootId }
                        });

                        const rootName = (resolved as any)?.rootName as string | undefined;
                        const rootWebUrl = (resolved as any)?.rootWebUrl as string | undefined;
                        const driveId = (resolved as any)?.driveId as string | null | undefined;

                        if (rootName) setDocHubRootName(rootName);
                        if (rootWebUrl) setDocHubRootLink(rootWebUrl);
                        setDocHubStatus("connected");

                        onUpdate({
                            docHubEnabled: true,
                            docHubProvider: "gdrive",
                            docHubStatus: "connected",
                            docHubRootName: rootName || null,
                            docHubRootLink: rootWebUrl || docHubRootLink,
                            docHubRootWebUrl: rootWebUrl || null,
                            docHubRootId: (resolved as any)?.rootId || rootId,
                            docHubDriveId: driveId ?? null
                        });
                        showModal({ title: "Hotovo", message: "Hlavní složka projektu vybrána a uložena.", variant: "success" });
                    } catch (e) {
                        const message = e instanceof Error ? e.message : "Neznámá chyba";
                        showModal({ title: "Nelze uložit složku", message, variant: "danger" });
                    }
                })
                .build();

            picker.setVisible(true);
        } catch (e) {
            const message = e instanceof Error ? e.message : "Neznámá chyba";
            showModal({ title: "Nelze otevřít Google Picker", message, variant: "danger" });
        } finally {
            setIsDocHubConnecting(false);
        }
    };

    const handleCreateGoogleDriveRoot = async () => {
        if (docHubProvider !== "gdrive") {
            showModal({ title: "DocHub", message: "Vyberte Google Drive jako provider.", variant: "info" });
            return;
        }
        if (!project.id) {
            showModal({ title: "DocHub", message: "Chybí ID projektu.", variant: "danger" });
            return;
        }
        const name = docHubNewFolderName.trim();
        if (!name) {
            showModal({ title: "DocHub", message: "Zadejte název nové složky.", variant: "info" });
            return;
        }

        setIsDocHubConnecting(true);
        try {
            const created = await invokeAuthedFunction<any>("dochub-google-create-root", {
                body: { projectId: project.id, name }
            });

            const rootName = (created as any)?.rootName as string | undefined;
            const rootWebUrl = (created as any)?.rootWebUrl as string | undefined;

            if (rootName) setDocHubRootName(rootName);
            if (rootWebUrl) setDocHubRootLink(rootWebUrl);
            setDocHubStatus("connected");

            onUpdate({
                docHubEnabled: true,
                docHubProvider: "gdrive",
                docHubStatus: "connected",
                docHubRootName: rootName || null,
                docHubRootLink: rootWebUrl || docHubRootLink,
                docHubRootWebUrl: rootWebUrl || null,
                docHubRootId: (created as any)?.rootId || null,
                docHubDriveId: (created as any)?.driveId || null,
            });
            showModal({ title: "Hotovo", message: "Složka byla vytvořena a nastavena jako hlavní složka projektu.", variant: "success" });
        } catch (e) {
            const message = e instanceof Error ? e.message : "Neznámá chyba";
            showModal({ title: "Nelze vytvořit složku", message, variant: "danger" });
        } finally {
            setIsDocHubConnecting(false);
        }
    };

    const handleSaveDocHubStructure = () => {
        onUpdate({
            docHubStructureV1: {
                ...(docHubStructureDraft as any),
                extraTopLevel: docHubExtraTopLevelDraft,
                extraSupplier: docHubExtraSupplierDraft,
            }
        });
        setIsEditingDocHubStructure(false);
    };

    const handleSaveLetter = async () => {
        if (selectedTemplateFile) {
            // Upload file to storage
            setIsUploadingTemplate(true);
            try {
                const doc = await uploadDocument(selectedTemplateFile, `template_${project.id || 'default'}`);
                onUpdate({ inquiryLetterLink: doc.url });
                setSelectedTemplateFile(null);
            } catch (error) {
                console.error('Error uploading template:', error);
                showModal({ title: "Chyba", message: "Chyba při nahrávání šablony. Zkuste to prosím znovu.", variant: "danger" });
                setIsUploadingTemplate(false);
                return;
            }
            setIsUploadingTemplate(false);
        } else {
            // Save URL
            onUpdate({ inquiryLetterLink: letterLinkValue });
        }
        setIsEditingLetter(false);
    };

    const hasDocsLink = project.documentationLink && project.documentationLink.trim() !== '';
    const hasLetterLink = project.inquiryLetterLink && project.inquiryLetterLink.trim() !== '';
    const hasDocHubRoot = !!project.docHubRootId && docHubRootLink.trim() !== '';
    const isDocHubAuthed = docHubEnabled && docHubStatus === "connected";
    const isDocHubConnected = isDocHubAuthed && hasDocHubRoot;
    const effectiveDocHubStructure = isEditingDocHubStructure ? docHubStructureDraft : docHubStructure;
    const [docHubBaseLinks, setDocHubBaseLinks] = useState<null | {
        pd?: string | null;
        tenders?: string | null;
        contracts?: string | null;
        realization?: string | null;
        archive?: string | null;
    }>(null);
    const fallbackDocHubLinks = isDocHubConnected ? getDocHubProjectLinks(docHubRootLink, effectiveDocHubStructure) : null;
    const docHubProjectLinks = isDocHubConnected
        ? {
            pd: docHubBaseLinks?.pd ?? fallbackDocHubLinks?.pd ?? null,
            tenders: docHubBaseLinks?.tenders ?? fallbackDocHubLinks?.tenders ?? null,
            contracts: docHubBaseLinks?.contracts ?? fallbackDocHubLinks?.contracts ?? null,
            realization: docHubBaseLinks?.realization ?? fallbackDocHubLinks?.realization ?? null,
            archive: docHubBaseLinks?.archive ?? fallbackDocHubLinks?.archive ?? null,
        }
        : null;

    useEffect(() => {
        if (!isDocHubConnected || !project.id) {
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

        return () => {
            cancelled = true;
        };
    }, [isDocHubConnected, project.id, project.docHubRootId, project.docHubDriveId, project.docHubStructureV1]);

	    return (
	        <div className="p-6 lg:p-10 flex flex-col gap-6 overflow-y-auto h-full bg-slate-50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 min-h-screen">
	            <ConfirmationModal
	                isOpen={uiModal.isOpen}
	                title={uiModal.title}
	                message={uiModal.message}
	                variant={uiModal.variant}
	                confirmLabel="OK"
	                onConfirm={() => setUiModal((prev) => ({ ...prev, isOpen: false }))}
	            />
	            <div className="max-w-4xl mx-auto w-full">
                {/* Header Card */}
                <div className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl shadow-xl p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="size-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-emerald-400 text-2xl">folder_open</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Dokumenty</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">PD, šablony a DocHub složky projektu</p>
                        </div>
                    </div>

                    {/* Sub-navigation */}
                    <div className="flex flex-wrap items-center gap-2 bg-slate-100 dark:bg-slate-900/30 p-1 rounded-xl border border-slate-200 dark:border-slate-700/50 mb-6">
                        <button
                            type="button"
                            onClick={() => setDocumentsSubTab('pd')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${documentsSubTab === 'pd'
                                ? 'bg-primary text-white shadow-lg'
                                : 'text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700/50'
                                }`}
                        >
                            PD
                        </button>
                        <button
                            type="button"
                            onClick={() => setDocumentsSubTab('templates')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${documentsSubTab === 'templates'
                                ? 'bg-primary text-white shadow-lg'
                                : 'text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700/50'
                                }`}
                        >
                            Šablony
                        </button>
                        <button
                            type="button"
                            onClick={() => setDocumentsSubTab('dochub')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${documentsSubTab === 'dochub'
                                ? 'bg-primary text-white shadow-lg'
                                : 'text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700/50'
                                }`}
                        >
                            DocHub
                        </button>
                    </div>

                    {documentsSubTab === 'pd' && (
                    <div className="space-y-4">
                    <div className={`rounded-xl p-6 border transition-colors ${hasDocsLink ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30' : 'bg-slate-50 dark:bg-slate-900/70 border-slate-200 dark:border-slate-700/40'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-slate-400">link</span>
                                <h3 className="font-semibold text-slate-900 dark:text-white">PD (projektová dokumentace)</h3>
                                {hasDocsLink && (
                                    <span className="ml-2 px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase rounded-lg border border-emerald-500/30">
                                        Nastaveno
                                    </span>
                                )}
                            </div>
                            {!isEditingDocs ? (
                                <button
                                    onClick={() => setIsEditingDocs(true)}
                                    className="p-2 hover:bg-slate-700/50 rounded-lg transition-all"
                                >
                                    <span className="material-symbols-outlined text-slate-400 text-[20px]">edit</span>
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSaveDocs}
                                        className="text-green-500 hover:text-green-600"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">check</span>
                                    </button>
                                    <button
                                        onClick={() => setIsEditingDocs(false)}
                                        className="text-red-500 hover:text-red-600"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">close</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {!isEditingDocs ? (
                            <div>
                                {hasDocsLink ? (
                                    <div className="space-y-3">
                                        <a
                                            href={project.documentationLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block p-4 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:border-emerald-500/30 hover:shadow-md dark:hover:bg-slate-700/50 transition-all group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">description</span>
                                                    <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                                        {project.documentationLink}
                                                    </span>
                                                </div>
                                                <span className="material-symbols-outlined text-slate-500 group-hover:text-emerald-400 transition-colors">open_in_new</span>
                                            </div>
                                        </a>
                                        <p className="text-xs text-slate-500 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">info</span>
                                            Klikněte pro otevření v novém okně
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <span className="material-symbols-outlined text-slate-600 text-5xl mb-3 block">link_off</span>
                                        <p className="text-slate-400 text-sm">Žádný odkaz není nastaven</p>
                                        <p className="text-slate-500 text-xs mt-1">Klikněte na ikonu úprav pro přidání odkazu</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <input
                                    type="url"
                                    value={docsLinkValue}
                                    onChange={(e) => setDocsLinkValue(e.target.value)}
                                    placeholder="https://example.com/project-docs"
                                    className="w-full bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                                />
                                <p className="text-xs text-slate-500">
                                    Zadejte URL odkaz na sdílenou složku (např. Google Drive, Dropbox, SharePoint)
                                </p>
                            </div>
                        )}
                    </div>

                    {isDocHubConnected && docHubProjectLinks?.pd && (
	                        <div className="mt-4 rounded-xl p-4 border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10">
	                            <div className="flex items-start justify-between gap-4">
	                                <div className="flex items-center gap-2">
	                                    <span className="material-symbols-outlined text-violet-300">folder</span>
	                                    <div>
	                                        <div className="text-sm font-semibold text-violet-900 dark:text-white">DocHub /{effectiveDocHubStructure.pd}</div>
	                                        <div className="text-xs text-violet-700/70 dark:text-slate-400">Rychlý odkaz na PD složku v DocHubu</div>
	                                    </div>
	                                </div>
	                                <button
	                                    type="button"
	                                    onClick={async () => {
	                                        const value = docHubProjectLinks?.pd || "";
	                                        if (isProbablyUrl(value)) {
	                                            window.open(value, "_blank", "noopener,noreferrer");
	                                            return;
	                                        }
		                                        try {
		                                            await navigator.clipboard.writeText(value);
		                                            showModal({ title: "Zkopírováno", message: value, variant: "success" });
		                                        } catch {
		                                            window.prompt("Zkopírujte cestu:", value);
		                                        }
		                                    }}
	                                    className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-bold transition-colors"
	                                >
	                                    {isProbablyUrl(docHubProjectLinks?.pd || "") ? "Otevřít" : "Zkopírovat"}
	                                </button>
	                            </div>
	                        </div>
	                    )}
                    </div>
                    )}

                    {/* Inquiry Letter Section */}
                    {/* Inquiry Letter Section */}
                    {documentsSubTab === 'templates' && (
                    <div className={`rounded-xl p-6 border transition-colors ${hasLetterLink ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30' : 'bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-700/40'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-slate-400">mail</span>
                                <h3 className="font-semibold text-slate-900 dark:text-white">Poptávkový dopis (šablona)</h3>
                                {hasLetterLink && (
                                    <span className="ml-2 px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase rounded-lg border border-emerald-500/30">
                                        Nastaveno
                                    </span>
                                )}
                            </div>

                            <button
                                onClick={() => setShowTemplateManager(true)}
                                className="px-3 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-950/30 border border-slate-200 dark:border-slate-700/40 rounded-xl hover:bg-emerald-50 dark:hover:bg-slate-900/50 hover:border-emerald-300 dark:hover:border-emerald-500/30 transition-all flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[18px]">{hasLetterLink ? 'change_circle' : 'add_circle'}</span>
                                {hasLetterLink ? 'Změnit šablonu' : 'Vybrat šablonu'}
                            </button>
                        </div>

                        <div>
                            {hasLetterLink ? (
                                <div className="space-y-3">
                                    <div
                                        className="block p-4 bg-white dark:bg-slate-950/30 rounded-xl border border-slate-200 dark:border-slate-700/40 transition-all group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <span className="material-symbols-outlined text-emerald-400">
                                                    {project.inquiryLetterLink?.startsWith('template:') ? 'wysiwyg' : 'link'}
                                                </span>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                                        {project.inquiryLetterLink?.startsWith('template:')
                                                            ? (templateName || 'Načítání...')
                                                            : (project.inquiryLetterLink?.startsWith('http') ? 'Externí odkaz / Soubor' : project.inquiryLetterLink)
                                                        }
                                                    </span>
                                                    {project.inquiryLetterLink?.startsWith('template:') && (
                                                        <span className="text-xs text-slate-500">HTML šablona připravená k odeslání</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setShowTemplateManager(true)}
                                                    className="p-2 text-slate-500 hover:text-emerald-400 transition-colors"
                                                    title="Upravit / Zobrazit"
                                                >
                                                    <span className="material-symbols-outlined">visibility</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    {project.inquiryLetterLink?.startsWith('template:') ? (
                                        <p className="text-xs text-slate-500 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">info</span>
                                            Tato šablona bude použita pro generování emailů subdodavatelům.
                                        </p>
                                    ) : (
                                        <p className="text-xs text-amber-400 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">warning</span>
                                            Používáte starý formát odkazu. Doporučujeme přejít na systémovou šablonu.
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-700/50 rounded-xl">
                                    <span className="material-symbols-outlined text-slate-400 dark:text-slate-600 text-5xl mb-3 block">mail_outline</span>
                                    <p className="text-slate-700 dark:text-slate-300 text-sm font-medium">Žádná šablona není vybrána</p>
                                    <p className="text-slate-500 text-xs mt-1 mb-4">Vyberte šablonu pro komunikaci se subdodavateli</p>
                                    <button
                                        onClick={() => setShowTemplateManager(true)}
                                        className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl transition-all inline-flex items-center gap-2 text-sm font-medium shadow-lg"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">add_circle</span>
                                        Vytvořit nebo vybrat šablonu
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    )}

                    {/* DocHub Section (Wizard) */}
                    {documentsSubTab === 'dochub' && (
                    <div className={`rounded-xl p-6 border transition-colors ${isDocHubConnected ? 'bg-violet-500/10 border-violet-500/30' : 'bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-700/40'}`}>
                        <div className="flex flex-col gap-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-slate-400">folder</span>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-slate-900 dark:text-white">DocHub</h3>
                                            <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg border ${!docHubEnabled
                                                ? 'bg-slate-700/40 text-slate-300 border-slate-600/40'
                                                : isDocHubConnected
                                                    ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                                                    : isDocHubAuthed
                                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                                        : docHubStatus === 'error'
                                                            ? 'bg-red-500/20 text-red-300 border-red-500/30'
                                                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                                }`}>
                                                {!docHubEnabled
                                                    ? 'Vypnuto'
                                                    : isDocHubConnected
                                                        ? 'Připraveno'
                                                        : isDocHubAuthed
                                                            ? 'Připojeno (vyberte složku)'
                                                            : docHubStatus === 'error'
                                                                ? 'Chyba'
                                                                : 'Nepřipojeno'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Standardizovaná struktura složek pro dokumenty stavby (v1)
                                        </p>
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 select-none">
                                    <input
                                        type="checkbox"
                                        checked={docHubEnabled}
                                        onChange={(e) => {
                                            const enabled = e.target.checked;
                                            setDocHubEnabled(enabled);
                                            if (!enabled) {
                                                setDocHubStatus("disconnected");
                                                onUpdate({
                                                    docHubEnabled: false,
                                                    docHubStatus: "disconnected",
                                                });
                                            } else {
                                                onUpdate({
                                                    docHubEnabled: true,
                                                    docHubProvider,
                                                    docHubMode,
                                                    docHubStatus: project.docHubStatus || "disconnected",
                                                });
                                            }
                                        }}
                                        className="accent-violet-500"
                                    />
                                    Zapnout
                                </label>
                            </div>

                            {docHubEnabled && (
                                <>
                                    {/* Connected summary */}
                                    {isDocHubConnected && !isEditingDocHubSetup && (
                                        <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
                                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                                        <span className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/50 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                                                            {docHubProvider === "gdrive" ? "Google Drive" : docHubProvider === "onedrive" ? "OneDrive" : "Provider: neuvedeno"}
                                                        </span>
                                                        <span className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/50 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                                                            {docHubMode === "user" ? "Můj účet" : docHubMode === "org" ? "Organizační úložiště" : "Režim: neuvedeno"}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                                        {docHubRootName || "Hlavní složka projektu"}
                                                    </div>
                                                    <div className="text-xs text-slate-400 truncate mt-0.5">
                                                        {docHubRootLink}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col sm:items-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            if (isProbablyUrl(docHubRootLink)) {
                                                                window.open(docHubRootLink, "_blank", "noopener,noreferrer");
                                                                return;
                                                            }
	                                                            try {
	                                                                await navigator.clipboard.writeText(docHubRootLink);
	                                                                showModal({ title: "Zkopírováno", message: docHubRootLink, variant: "success" });
	                                                            } catch {
	                                                                window.prompt("Zkopírujte cestu:", docHubRootLink);
	                                                            }
	                                                        }}
                                                        className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-bold transition-colors"
                                                    >
                                                        {isProbablyUrl(docHubRootLink) ? "Otevřít root" : "Zkopírovat root"}
                                                    </button>
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsEditingDocHubSetup(true)}
                                                            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors border border-slate-700/50"
                                                        >
                                                            Změnit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleDisconnectDocHub}
                                                            className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-red-600 dark:text-red-300 rounded-lg text-sm font-medium transition-colors border border-slate-300 dark:border-slate-700/50"
                                                        >
                                                            Odpojit
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Setup wizard */}
                                    {(!isDocHubConnected || isEditingDocHubSetup) && (
                                        <div className="bg-slate-100 dark:bg-slate-900/20 border border-slate-300 dark:border-slate-700/50 rounded-xl p-4">
                                            <div className="flex flex-col gap-4">
                                                {/* Step 1 */}
                                                <div className="space-y-2 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
                                                    <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                                        1) Provider
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setDocHubProvider("gdrive")}
                                                            className={`p-3 rounded-xl border text-left transition-all ${docHubProvider === "gdrive"
                                                                ? "bg-violet-500/15 border-violet-500/40"
                                                                : "bg-slate-100 dark:bg-slate-800/40 border-slate-300 dark:border-slate-700/50 hover:border-slate-400 dark:hover:border-slate-600/60"
                                                                }`}
                                                        >
                                                            <div className="text-sm font-semibold text-slate-900 dark:text-white">Google Drive</div>
                                                            <div className="text-xs text-slate-600 dark:text-slate-400">My Drive / Shared Drive</div>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDocHubProvider("onedrive")}
                                                            className={`p-3 rounded-xl border text-left transition-all ${docHubProvider === "onedrive"
                                                                ? "bg-violet-500/15 border-violet-500/40"
                                                                : "bg-slate-100 dark:bg-slate-800/40 border-slate-300 dark:border-slate-700/50 hover:border-slate-400 dark:hover:border-slate-600/60"
                                                                }`}
                                                        >
                                                            <div className="text-sm font-semibold text-slate-900 dark:text-white">OneDrive</div>
                                                            <div className="text-xs text-slate-600 dark:text-slate-400">Personal / Business</div>
                                                        </button>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">
                                                        Google: OAuth + Picker. OneDrive: zatím přes odkaz.
                                                    </div>
                                                </div>

                                                {/* Step 2 */}
                                                <div className="space-y-2 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
                                                    <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                                        2) Režim
                                                    </div>
                                                    <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-300 dark:border-slate-700/50">
                                                        <button
                                                            type="button"
                                                            onClick={() => setDocHubMode("user")}
                                                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${docHubMode === "user" ? "bg-violet-600 text-white shadow-lg" : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-700/50"}`}
                                                        >
                                                            Můj účet
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDocHubMode("org")}
                                                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${docHubMode === "org" ? "bg-violet-600 text-white shadow-lg" : "text-slate-300 hover:text-white hover:bg-slate-700/50"}`}
                                                        >
                                                            Organizace
                                                        </button>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">
                                                        U Google je “Organizace” typicky Shared Drive.
                                                    </div>
                                                </div>

                                                {/* Step 3 */}
                                                <div className="space-y-2 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
                                                    <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                                        3) Hlavní složka projektu
                                                    </div>
                                                    <div className="space-y-2">
                                                        {docHubProvider === "gdrive" && (
                                                            <button
                                                                type="button"
                                                                onClick={handlePickGoogleDriveRoot}
                                                                disabled={isDocHubConnecting || !isDocHubAuthed}
                                                                className={`w-full px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${isDocHubConnecting || !isDocHubAuthed
                                                                    ? "bg-slate-200 dark:bg-slate-800/60 text-slate-500 dark:text-slate-500 border-slate-300 dark:border-slate-700/50 cursor-not-allowed"
                                                                    : "bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700/50"
                                                                    }`}
                                                                title={!isDocHubAuthed ? "Nejdřív připojte účet (OAuth)." : "Otevře Google Picker pro výběr složky"}
                                                            >
                                                                {isDocHubConnecting ? "Otevírám Picker..." : "Vybrat složku z Google Drive"}
                                                            </button>
                                                        )}
                                                        {docHubProvider === "gdrive" && (
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={docHubNewFolderName}
                                                                    onChange={(e) => setDocHubNewFolderName(e.target.value)}
                                                                    placeholder="Název nové složky"
                                                                    className="sm:col-span-2 w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-violet-500/50 focus:outline-none"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={handleCreateGoogleDriveRoot}
                                                                    disabled={isDocHubConnecting || !isDocHubAuthed || !docHubNewFolderName.trim()}
                                                                    className={`w-full px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${isDocHubConnecting || !isDocHubAuthed || !docHubNewFolderName.trim()
                                                                        ? "bg-slate-200 dark:bg-slate-800/60 text-slate-500 border-slate-300 dark:border-slate-700/50 cursor-not-allowed"
                                                                        : "bg-violet-600 hover:bg-violet-500 text-white border-violet-500/30"
                                                                        }`}
                                                                    title={!isDocHubAuthed ? "Nejdřív připojte účet (OAuth)." : "Vytvoří složku v Google Drive a nastaví ji jako root projektu"}
                                                                >
                                                                    Vytvořit
                                                                </button>
                                                            </div>
                                                        )}
                                                        <input
                                                            type="text"
                                                            value={docHubRootName}
                                                            onChange={(e) => setDocHubRootName(e.target.value)}
                                                            placeholder="Název (např. Stavba RD Novák)"
                                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-violet-500/50 focus:outline-none"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={docHubRootLink}
                                                            onChange={(e) => setDocHubRootLink(e.target.value)}
                                                            placeholder={docHubProvider === "gdrive" ? "Web URL složky (vyplní se po výběru) nebo vlož URL ručně" : "Web URL (sdílený odkaz)"}
                                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-violet-500/50 focus:outline-none"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={handleResolveDocHubRoot}
                                                            disabled={isDocHubConnecting || !docHubProvider || !docHubRootLink.trim()}
                                                            className={`relative overflow-hidden w-full px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${isDocHubConnecting || !docHubProvider || !docHubRootLink.trim()
                                                                ? "bg-slate-200 dark:bg-slate-800/60 text-slate-500 border-slate-300 dark:border-slate-700/50 cursor-not-allowed"
                                                                : "bg-violet-600 hover:bg-violet-500 text-white border-violet-500/30"
                                                                }`}
                                                            title="Získá odkaz přes Drive/Graph API a uloží rootId/rootWebUrl"
                                                        >
                                                            <span
                                                                className="absolute inset-y-0 left-0 bg-white/25"
                                                                style={{ width: `${docHubResolveProgress}%` }}
                                                            />
                                                            <span className="relative z-10 flex items-center justify-center gap-2">
                                                                <span className={`material-symbols-outlined text-[18px] ${isDocHubConnecting ? 'animate-spin' : ''}`}>
                                                                    {isDocHubConnecting ? 'sync' : 'link'}
                                                                </span>
                                                                {isDocHubConnecting ? `Získávám odkaz… ${docHubResolveProgress}%` : "Získat odkaz"}
                                                            </span>
                                                        </button>
                                                        <div className="text-[11px] text-slate-500">
                                                            Google: doporučeno vybrat přes Picker. OneDrive: zatím vložte sdílený odkaz na složku.
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={isDocHubAuthed ? handleDisconnectDocHub : handleConnectDocHub}
                                                        disabled={isDocHubConnecting || (!isDocHubAuthed && (!docHubProvider || !docHubMode))}
                                                        className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${isDocHubConnecting || (!isDocHubAuthed && (!docHubProvider || !docHubMode))
                                                            ? "bg-slate-200 dark:bg-slate-800/60 text-slate-500 border-slate-300 dark:border-slate-700/50 cursor-not-allowed"
                                                            : isDocHubAuthed
                                                                ? "bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-red-600 dark:text-red-300 border-slate-300 dark:border-slate-700/50"
                                                                : "bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700/50"
                                                        }`}
                                                        title={isDocHubAuthed ? "Odpojí DocHub účet pro tuto stavbu" : "Spustí OAuth autorizaci (Google Drive používá následně Picker)"}
                                                    >
                                                        {isDocHubConnecting
                                                            ? "Pracuji..."
                                                            : isDocHubAuthed
                                                                ? "Odpojit"
                                                                : `Připojit přes ${docHubProvider === "gdrive" ? "Google" : "Microsoft"}`}
                                                    </button>
                                                    <button
                                                        type="button"
	                                                        onClick={() => {
	                                                            if (!docHubProvider || !docHubMode || !docHubRootLink.trim()) {
	                                                                showModal({
	                                                                    title: "DocHub",
	                                                                    message: "Vyberte provider, režim a zadejte hlavní složku projektu (URL/cestu).",
	                                                                    variant: "info"
	                                                                });
	                                                                return;
	                                                            }
	                                                            setDocHubStatus("connected");
	                                                            handleSaveDocHub();
	                                                        }}
                                                        className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-bold transition-colors"
                                                    >
                                                        Uložit nastavení
                                                    </button>
                                                </div>
                                                {isDocHubConnected && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setDocHubEnabled(!!project.docHubEnabled);
                                                            setDocHubRootLink(project.docHubRootLink || "");
                                                            setDocHubRootName(project.docHubRootName || "");
                                                            setDocHubProvider(project.docHubProvider ?? null);
                                                            setDocHubMode(project.docHubMode ?? null);
                                                            setDocHubStatus(project.docHubStatus || "connected");
                                                            setIsEditingDocHubSetup(false);
                                                        }}
                                                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors border border-slate-700/50"
                                                    >
                                                        Zrušit
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Structure + quick links */}
                                    <div className="flex flex-col gap-3">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                                <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-300">account_tree</span>
                                                Struktura (v1)
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsEditingDocHubStructure(!isEditingDocHubStructure)}
                                                    className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors border border-slate-300 dark:border-slate-700/50"
                                                >
                                                    {isEditingDocHubStructure ? "Zavřít úpravy" : "Upravit strukturu"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleDocHubAutoCreate(!docHubAutoCreateEnabled)}
                                                    disabled={isDocHubAutoCreating || !isDocHubConnected}
                                                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${isDocHubAutoCreating || !isDocHubConnected
                                                        ? "bg-slate-200 dark:bg-slate-800/60 text-slate-500 border-slate-300 dark:border-slate-700/50 cursor-not-allowed"
                                                        : docHubAutoCreateEnabled
                                                            ? "bg-emerald-500/15 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                                            : "bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700/50"
                                                    }`}
                                                    title={!isDocHubConnected ? "Nejdřív připojte DocHub a nastavte hlavní složku projektu." : docHubAutoCreateEnabled ? "Vypnout auto‑vytváření" : "Zapnout a spustit auto‑vytváření"}
                                                >
                                                    {isDocHubAutoCreating
                                                        ? `Auto‑vytváření… ${docHubAutoCreateProgress}%`
                                                        : docHubAutoCreateEnabled
                                                            ? "Auto‑vytváření: zapnuto"
                                                            : "Auto‑vytváření: vypnuto"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        const structure = [
                                                            `/${effectiveDocHubStructure.pd}`,
                                                            `/${effectiveDocHubStructure.tenders}`,
                                                            `   /VR-001_Zemeprace`,
                                                            `      /${effectiveDocHubStructure.tendersInquiries}`,
                                                            `         /Dodavatel_A`,
                                                            `            /${effectiveDocHubStructure.supplierEmail}`,
                                                            `            /${effectiveDocHubStructure.supplierOffer}`,
                                                            `         /Dodavatel_B`,
                                                            `   /VR-002_Elektro`,
                                                            `/${effectiveDocHubStructure.contracts}`,
                                                            `/${effectiveDocHubStructure.realization}`,
                                                            `/${effectiveDocHubStructure.archive}`,
	                                                        ].join('\n');
	                                                        try {
	                                                            await navigator.clipboard.writeText(structure);
	                                                            showModal({ title: "Zkopírováno", message: "Struktura DocHub zkopírována do schránky.", variant: "success" });
	                                                        } catch {
	                                                            window.prompt('Zkopírujte strukturu:', structure);
	                                                        }
	                                                    }}
                                                    className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors border border-slate-300 dark:border-slate-700/50"
                                                >
                                                    Zkopírovat
                                                </button>
                                            </div>
                                        </div>

	                                        {isDocHubAutoCreating && (
	                                            <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
	                                                <div className="flex items-center justify-between gap-3">
	                                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
	                                                        Probíhá auto‑vytváření složek
	                                                    </div>
	                                                    <div className="text-xs text-slate-500">
	                                                        {docHubAutoCreateProgress}%
	                                                    </div>
	                                                </div>
	                                                <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
	                                                    <div
                                                        className="h-full bg-gradient-to-r from-primary to-violet-500 transition-all"
                                                        style={{ width: `${docHubAutoCreateProgress}%` }}
                                                    />
	                                                </div>
	                                                <div className="mt-3 flex items-center justify-between gap-3">
	                                                    <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
	                                                        {docHubBackendStep || (docHubAutoCreateLogs.length > 0 ? docHubAutoCreateLogs[docHubAutoCreateLogs.length - 1] : "")}
	                                                    </div>
	                                                    {docHubBackendCounts && (
	                                                        <div className="text-xs text-slate-500 shrink-0">
	                                                            {docHubBackendCounts.total ? `${docHubBackendCounts.done}/${docHubBackendCounts.total}` : `${docHubBackendCounts.done}`}
	                                                        </div>
	                                                    )}
	                                                </div>
	                                                {docHubBackendCounts?.total && (
	                                                    <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
	                                                        <div
	                                                            className="h-full bg-primary/70 transition-all"
	                                                            style={{
	                                                                width: `${Math.min(
	                                                                    100,
	                                                                    Math.round((docHubBackendCounts.done / Math.max(1, docHubBackendCounts.total)) * 100)
	                                                                )}%`,
	                                                            }}
	                                                        />
	                                                    </div>
	                                                )}
	                                                {docHubAutoCreateLogs.length > 0 && (
	                                                    <div className="mt-3 text-xs text-slate-600 dark:text-slate-400">
	                                                        {docHubAutoCreateLogs[docHubAutoCreateLogs.length - 1]}
	                                                    </div>
	                                                )}
	                                            </div>
	                                        )}

                                        {isEditingDocHubStructure && (
                                            <div className="bg-slate-100 dark:bg-slate-950/30 border border-slate-300 dark:border-slate-700/50 rounded-xl p-4">
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                    {/* Tree preview */}
                                                    <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
                                                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                                            <span className="material-symbols-outlined text-[16px] text-violet-600 dark:text-violet-300">account_tree</span>
                                                            Náhled struktury
                                                        </div>

                                                        <div className="mt-3 text-sm">
                                                            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                                                <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-400">folder</span>
                                                                <span className="font-semibold">Kořen projektu</span>
                                                            </div>

                                                            <div className="mt-2 pl-5 border-l border-slate-200 dark:border-slate-700/50 space-y-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-400">folder</span>
                                                                    <span className="font-medium text-slate-900 dark:text-white">/{docHubStructureDraft.pd}</span>
                                                                </div>

                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-400">folder</span>
                                                                        <span className="font-medium text-slate-900 dark:text-white">/{docHubStructureDraft.tenders}</span>
                                                                    </div>
                                                                    <div className="pl-5 border-l border-slate-200 dark:border-slate-700/50 space-y-1">
                                                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                                                            <span className="material-symbols-outlined text-[16px]">subdirectory_arrow_right</span>
                                                                            <span className="italic">VR-001_Nazev_vyberoveho_rizeni</span>
                                                                        </div>
                                                                        <div className="pl-5 border-l border-slate-200 dark:border-slate-700/50 space-y-1">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-400">folder</span>
                                                                                <span className="font-medium text-slate-900 dark:text-white">/{docHubStructureDraft.tendersInquiries}</span>
                                                                            </div>
                                                                            <div className="pl-5 border-l border-slate-200 dark:border-slate-700/50 space-y-1">
                                                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                                                    <span className="material-symbols-outlined text-[16px]">subdirectory_arrow_right</span>
                                                                                    <span className="italic">Dodavatel_X</span>
                                                                                </div>
                                                                                <div className="pl-5 border-l border-slate-200 dark:border-slate-700/50 space-y-1">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-400">folder</span>
                                                                                        <span className="text-slate-900 dark:text-white">/{docHubStructureDraft.supplierEmail}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-400">folder</span>
                                                                                        <span className="text-slate-900 dark:text-white">/{docHubStructureDraft.supplierOffer}</span>
                                                                                    </div>
                                                                                    {docHubExtraSupplierDraft.map((name, idx) => (
                                                                                        <div key={`${name}-${idx}`} className="flex items-center gap-2">
                                                                                            <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-400">folder</span>
                                                                                            <span className="text-slate-900 dark:text-white">/{name}</span>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-400">folder</span>
                                                                    <span className="font-medium text-slate-900 dark:text-white">/{docHubStructureDraft.contracts}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-400">folder</span>
                                                                    <span className="font-medium text-slate-900 dark:text-white">/{docHubStructureDraft.realization}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-400">folder</span>
                                                                    <span className="font-medium text-slate-900 dark:text-white">/{docHubStructureDraft.archive}</span>
                                                                </div>

                                                                {docHubExtraTopLevelDraft.length > 0 && (
                                                                    <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700/50">
                                                                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                                                                            Další složky
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            {docHubExtraTopLevelDraft.map((name, idx) => (
                                                                                <div key={`${name}-${idx}`} className="flex items-center gap-2">
                                                                                    <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-400">folder</span>
                                                                                    <span className="text-slate-900 dark:text-white">/{name}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Editor */}
                                                    <div className="space-y-4">
                                                        <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
                                                            <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-3">
                                                                Kořen projektu (hlavní složky)
                                                            </div>

                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                {([
                                                                    ["pd", "PD (1. úroveň)"],
                                                                    ["tenders", "Výběrová řízení (1. úroveň)"],
                                                                    ["contracts", "Smlouvy (1. úroveň)"],
                                                                    ["realization", "Realizace (1. úroveň)"],
                                                                    ["archive", "Archiv (1. úroveň)"],
                                                                ] as const).map(([key, label]) => (
                                                                    <div key={key} className="space-y-1">
                                                                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                                                                            {label}
                                                                        </label>
                                                                        <input
                                                                            type="text"
                                                                            value={docHubStructureDraft[key]}
                                                                            onChange={(e) =>
                                                                                setDocHubStructureDraft((prev) => ({ ...prev, [key]: e.target.value }))
                                                                            }
                                                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-violet-500/50 focus:outline-none"
                                                                        />
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/50">
                                                                <div className="flex items-center justify-between gap-3 mb-2">
                                                                    <div>
                                                                        <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                                                            Další složky v kořeni (volitelné)
                                                                        </div>
                                                                        <div className="text-[11px] text-slate-500">
                                                                            Tyto složky jsou jen navíc; aplikace je zatím nepoužívá v ostatních modulech.
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setDocHubExtraTopLevelDraft((prev) => [...prev, ""])}
                                                                        className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors border border-slate-300 dark:border-slate-700/50"
                                                                    >
                                                                        + Přidat
                                                                    </button>
                                                                </div>

                                                                <div className="space-y-2">
                                                                    {docHubExtraTopLevelDraft.length === 0 ? (
                                                                        <div className="text-xs text-slate-500 italic">
                                                                            Zatím žádné další složky.
                                                                        </div>
                                                                    ) : (
                                                                        docHubExtraTopLevelDraft.map((name, idx) => (
                                                                            <div key={idx} className="flex items-center gap-2">
                                                                                <input
                                                                                    type="text"
                                                                                    value={name}
                                                                                    onChange={(e) =>
                                                                                        setDocHubExtraTopLevelDraft((prev) =>
                                                                                            prev.map((v, i) => (i === idx ? e.target.value : v))
                                                                                        )
                                                                                    }
                                                                                    placeholder="Název složky (např. 05_Fotky)"
                                                                                    className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-violet-500/50 focus:outline-none"
                                                                                />
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setDocHubExtraTopLevelDraft((prev) => prev.filter((_, i) => i !== idx))}
                                                                                    className="p-2 rounded-lg border border-slate-300 dark:border-slate-700/50 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200"
                                                                                    title="Odebrat"
                                                                                >
                                                                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                                                                </button>
                                                                            </div>
                                                                        ))
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
                                                            <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-3">
                                                                Výběrová řízení (podsložky)
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                {([
                                                                    ["tendersInquiries", "Poptávky (uvnitř VŘ)"],
                                                                    ["supplierEmail", "Email (uvnitř Dodavatele)"],
                                                                    ["supplierOffer", "Cenová nabídka (uvnitř Dodavatele)"],
                                                                ] as const).map(([key, label]) => (
                                                                    <div key={key} className="space-y-1">
                                                                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                                                                            {label}
                                                                        </label>
                                                                        <input
                                                                            type="text"
                                                                            value={docHubStructureDraft[key]}
                                                                            onChange={(e) =>
                                                                                setDocHubStructureDraft((prev) => ({ ...prev, [key]: e.target.value }))
                                                                            }
                                                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-violet-500/50 focus:outline-none"
                                                                        />
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/50">
                                                                <div className="flex items-center justify-between gap-3 mb-2">
                                                                    <div>
                                                                        <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                                                            Další podsložky u dodavatele (volitelné)
                                                                        </div>
                                                                        <div className="text-[11px] text-slate-500">
                                                                            Přidá další podsložky vedle Email / Cenová nabídka.
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setDocHubExtraSupplierDraft((prev) => [...prev, ""])}
                                                                        className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors border border-slate-300 dark:border-slate-700/50"
                                                                    >
                                                                        + Přidat
                                                                    </button>
                                                                </div>

                                                                <div className="space-y-2">
                                                                    {docHubExtraSupplierDraft.length === 0 ? (
                                                                        <div className="text-xs text-slate-500 italic">
                                                                            Zatím žádné další podsložky.
                                                                        </div>
                                                                    ) : (
                                                                        docHubExtraSupplierDraft.map((name, idx) => (
                                                                            <div key={idx} className="flex items-center gap-2">
                                                                                <input
                                                                                    type="text"
                                                                                    value={name}
                                                                                    onChange={(e) =>
                                                                                        setDocHubExtraSupplierDraft((prev) =>
                                                                                            prev.map((v, i) => (i === idx ? e.target.value : v))
                                                                                        )
                                                                                    }
                                                                                    placeholder="Název podsložky (např. Smlouvy, Fotky...)"
                                                                                    className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-violet-500/50 focus:outline-none"
                                                                                />
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setDocHubExtraSupplierDraft((prev) => prev.filter((_, i) => i !== idx))}
                                                                                    className="p-2 rounded-lg border border-slate-300 dark:border-slate-700/50 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200"
                                                                                    title="Odebrat"
                                                                                >
                                                                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                                                                </button>
                                                                            </div>
                                                                        ))
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
                                                    <p className="text-xs text-slate-500">
                                                        Doporučení: měňte jen názvy složek; struktura (vazby) v aplikaci zůstává stejná.
                                                    </p>
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setDocHubStructureDraft(resolveDocHubStructureV1(null));
                                                                setDocHubExtraTopLevelDraft([]);
                                                                setDocHubExtraSupplierDraft([]);
                                                            }}
                                                            className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors border border-slate-300 dark:border-slate-700/50"
                                                        >
                                                            Reset
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleSaveDocHubStructure}
                                                            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-bold transition-colors"
                                                        >
                                                            Uložit strukturu
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {docHubProjectLinks && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {[
                                                    { label: `/${effectiveDocHubStructure.pd}`, href: docHubProjectLinks.pd || "" },
                                                    { label: `/${effectiveDocHubStructure.tenders}`, href: docHubProjectLinks.tenders || "" },
                                                    { label: `/${effectiveDocHubStructure.contracts}`, href: docHubProjectLinks.contracts || "" },
                                                    { label: `/${effectiveDocHubStructure.realization}`, href: docHubProjectLinks.realization || "" },
                                                    { label: `/${effectiveDocHubStructure.archive}`, href: docHubProjectLinks.archive || "" },
                                                ].map((item) => (
                                                    <a
                                                        key={item.label}
                                                        href={isProbablyUrl(item.href) ? item.href : undefined}
                                                        target={isProbablyUrl(item.href) ? "_blank" : undefined}
                                                        rel={isProbablyUrl(item.href) ? "noopener noreferrer" : undefined}
                                                        onClick={(e) => {
                                                            if (isProbablyUrl(item.href)) return;
                                                            e.preventDefault();
	                                                            navigator.clipboard
	                                                                .writeText(item.href)
	                                                                .then(() => showModal({ title: "Zkopírováno", message: item.href, variant: "success" }))
	                                                                .catch(() => window.prompt('Zkopírujte cestu:', item.href));
	                                                        }}
                                                        className="block p-4 bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:border-violet-300 dark:hover:border-violet-500/30 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-all shadow-sm"
                                                        title={isProbablyUrl(item.href) ? "Otevřít" : "Zkopírovat cestu"}
                                                    >
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <span className="material-symbols-outlined text-violet-600 dark:text-violet-400">folder</span>
                                                                <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                                                    {item.label}
                                                                </span>
                                                            </div>
                                                            <span className="material-symbols-outlined text-slate-400 dark:text-slate-500">content_copy</span>
                                                        </div>
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    )}

                    {/* Tips Section */}
                    <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-blue-400 text-[20px]">lightbulb</span>
                            <div>
                                <h4 className="font-semibold text-blue-300 text-sm mb-1">Tipy pro dokumentaci</h4>
                                <ul className="text-xs text-blue-400/80 space-y-1">
                                    <li>• Použijte sdílené cloudové úložiště pro snadný přístup celého týmu</li>
                                    <li>• Ujistěte se, že všichni relevantní členové mají přístupová práva</li>
                                    <li>• Udržujte dokumentaci aktuální a dobře organizovanou</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>


            {/* Template Manager Overlay */}
            {showTemplateManager && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-6xl h-[85vh] shadow-2xl">
                        <TemplateManager
                            project={project}
                            onClose={() => setShowTemplateManager(false)}
                            onSelectTemplate={(template) => {
                                onUpdate({ inquiryLetterLink: `template:${template.id}` });
                                setShowTemplateManager(false);
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Main Layout Component ---

interface ProjectLayoutProps {
    projectId: string;
    projectDetails?: ProjectDetails;
    onUpdateDetails: (updates: Partial<ProjectDetails>) => void;
    onAddCategory: (category: DemandCategory) => void;
    onEditCategory?: (category: DemandCategory) => void;
    onDeleteCategory?: (categoryId: string) => void;
    onBidsChange?: (projectId: string, bids: Record<string, Bid[]>) => void;
    activeTab: ProjectTab;
    onTabChange: (tab: ProjectTab) => void;
    contacts: Subcontractor[];
    statuses?: StatusConfig[];
    initialPipelineCategoryId?: string;
    onNavigateToPipeline?: (categoryId: string) => void;
}

export const ProjectLayout: React.FC<ProjectLayoutProps> = ({ projectId, projectDetails, onUpdateDetails, onAddCategory, onEditCategory, onDeleteCategory, onBidsChange, activeTab, onTabChange, contacts, statuses, initialPipelineCategoryId, onNavigateToPipeline }) => {
    const project = projectDetails;
    const [searchQuery, setSearchQuery] = useState('');

    const handleLocalNavigateToPipeline = (categoryId: string) => {
        onTabChange('pipeline');
        onNavigateToPipeline?.(categoryId);
    };

    if (!project) return <div>Project not found</div>;

    return (
        <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950">
            <Header 
                title={project.title} 
                subtitle="Detail stavby"
                onSearchChange={setSearchQuery}
                searchPlaceholder="Hledat v projektu..."
            >
                <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-300 dark:border-slate-700/50">
                    <button
                        onClick={() => onTabChange('overview')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'overview' ? 'bg-primary text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-700/50'}`}
                    >
                        Přehled
                    </button>
                    <button
                        onClick={() => onTabChange('tender-plan')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'tender-plan' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                    >
                        Plán VŘ
                    </button>
                    <button
                        onClick={() => onTabChange('pipeline')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'pipeline' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                    >
                        Výběrová řízení
                    </button>
                    <button
                        onClick={() => onTabChange('documents')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'documents' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                    >
                        Dokumenty
                    </button>
                </div>
            </Header>

            <div className="flex-1 overflow-auto flex flex-col">
                {activeTab === 'overview' && <ProjectOverviewNew project={project} onUpdate={onUpdateDetails} variant="compact" searchQuery={searchQuery} onNavigateToPipeline={handleLocalNavigateToPipeline} />}
                {activeTab === 'tender-plan' && (
                    <TenderPlan
                        projectId={projectId}
                        categories={project.categories || []}
                        onCreateCategory={(name, dateFrom, dateTo) => {
                            // Switch to pipeline tab and open add category modal
                            onTabChange('pipeline');
                            // The Pipeline component will need to handle this - for now just switch tabs
                            // A more complete solution would pass the pre-filled data
                            const newCategory: DemandCategory = {
                                id: `cat_${Date.now()}`,
                                title: name,
                                budget: '0 Kč',
                                sodBudget: 0,
                                planBudget: 0,
                                status: 'open',
                                subcontractorCount: 0,
                                description: '',
                                deadline: dateTo || '',
                            };
                            onAddCategory(newCategory);
                        }}
                    />
                )}
                {activeTab === 'pipeline' && <Pipeline projectId={projectId} projectDetails={project} bids={project.bids || {}} contacts={contacts} statuses={statuses} onAddCategory={onAddCategory} onEditCategory={onEditCategory} onDeleteCategory={onDeleteCategory} onBidsChange={(bids) => onBidsChange?.(projectId, bids)} searchQuery={searchQuery} initialOpenCategoryId={initialPipelineCategoryId} />}
                {activeTab === 'documents' && <ProjectDocuments project={project} onUpdate={onUpdateDetails} />}
            </div>
        </div>
    );
};
