/**
 * ProjectDocuments Component
 * Manages document links, templates, DocHub integration for projects.
 * Extracted from ProjectLayout.tsx for better modularity.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ProjectDetails } from "../../types";
import { uploadDocument, formatFileSize } from "../../services/documentService";
import { TemplateManager } from "../TemplateManager";
import { getTemplateById } from "../../services/templateService";
import { useDocHubIntegration } from "../../hooks/useDocHubIntegration";
import { DocHubStatusCard } from "./documents/dochub/DocHubStatusCard";
import { DocHubSetupWizard } from "./documents/dochub/DocHubSetupWizard";
import { DocHubStructureEditor } from "./documents/dochub/DocHubStructureEditor";
import { DocHubAutoCreateStatus } from "./documents/dochub/DocHubAutoCreateStatus";
import { DocHubHistory } from "./documents/dochub/DocHubHistory";
import { DocHubLinks } from "./documents/dochub/DocHubLinks";
import { ConfirmationModal } from "../ConfirmationModal";
import { DocsLinkSection } from "./documents/DocsLinkSection";
import { TemplatesSection } from "./documents/TemplatesSection";
import { PriceListsSection } from "./documents/PriceListsSection";
import { useFeatures } from "../../context/FeatureContext";
import { FEATURES } from "../../config/features";
import { useLocation } from "../../shared/routing/router";
import { isProbablyUrl } from "../../utils/docHub";
import { useAuthIdentity } from "@shared/auth/AuthIdentityContext";

// --- Helper Functions ---
const parseMoney = (valueStr: string): number => {
  if (!valueStr || valueStr === "-" || valueStr === "?") return 0;
  const hasM = /M/i.test(valueStr);
  const hasK = /K/i.test(valueStr) && !/Kč/i.test(valueStr);
  const cleanStr = valueStr
    .replace(/\s/g, "")
    .replace(/[^0-9,.-]/g, "")
    .replace(",", ".");
  let val = parseFloat(cleanStr);
  if (hasM) val *= 1000000;
  else if (hasK) val *= 1000;
  return isNaN(val) ? 0 : val;
};

const formatMoney = (val: number): string => {
  if (val >= 1000000) {
    return (
      new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
        val / 1000000,
      ) + "M Kč"
    );
  }
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

const formatMoneyFull = (val: number): string => {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

export interface ProjectDocumentsProps {
  project: ProjectDetails;
  onUpdate: (updates: Partial<ProjectDetails>) => void | Promise<void>;
}

const ProjectDocuments: React.FC<ProjectDocumentsProps> = ({
  project,
  onUpdate,
}) => {
  type DocumentsSubTab = "pd" | "templates" | "dochub" | "ceniky";
  const [isEditingDocs, setIsEditingDocs] = useState(false);
  const [isEditingLetter, setIsEditingLetter] = useState(false);
  const [documentsSubTab, setDocumentsSubTab] = useState<DocumentsSubTab>("pd");
  const { search } = useLocation();
  const { hasFeature } = useFeatures();
  const canDocHub = hasFeature(FEATURES.DOC_HUB);
  const canTemplates =
    hasFeature(FEATURES.DYNAMIC_TEMPLATES) ||
    hasFeature(FEATURES.DEMAND_GENERATION) ||
    hasFeature(FEATURES.LOSER_EMAIL);
  const availableSubTabs = useMemo(
    () =>
      [
        "pd",
        ...(canTemplates ? ["templates"] : []),
        ...(canDocHub ? ["dochub"] : []),
        "ceniky",
      ] as DocumentsSubTab[],
    [canDocHub, canTemplates],
  );
  const [docsLinkValue, setDocsLinkValue] = useState("");
  const [priceListLinkValue, setPriceListLinkValue] = useState("");
  const [letterLinkValue, setLetterLinkValue] = useState("");
  const identity = useAuthIdentity();
  // DocHub Integration Hook
  const docHub = useDocHubIntegration(project, onUpdate, { userId: identity?.id });
  const {
    isConnected: isDocHubConnected,
    links: docHubProjectLinks,
    structureDraft: docHubStructure,
  } = docHub.state;

  // UI state for logs (lifted up)
  const [showDocHubRunLog, setShowDocHubRunLog] = useState(false);
  const [showDocHubRunOverview, setShowDocHubRunOverview] = useState(false);
  const docHubRunLogRef = useRef<HTMLDivElement>(null);
  const docHubRunOverviewRef = useRef<HTMLDivElement>(null);

  const handleHistorySelect = (run: any, mode: "log" | "overview") => {
    docHub.setters.setAutoCreateResult({
      createdCount: null,
      runId: run.id,
      logs: run.logs,
      finishedAt: run.finished_at || run.started_at,
    });
    if (mode === "log") {
      setShowDocHubRunLog(true);
      setShowDocHubRunOverview(false);
      window.setTimeout(
        () =>
          docHubRunLogRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        50
      );
    } else {
      setShowDocHubRunOverview(true);
      setShowDocHubRunLog(false);
      window.setTimeout(
        () =>
          docHubRunOverviewRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        50
      );
    }
  };
  const [selectedTemplateFile, setSelectedTemplateFile] = useState<File | null>(
    null
  );
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [materialTemplateName, setMaterialTemplateName] = useState<string | null>(
    null
  );
  const [losersTemplateName, setLosersTemplateName] = useState<string | null>(
    null
  );
  const [templateManagerTarget, setTemplateManagerTarget] = useState<
    { kind: "inquiry" } | { kind: "materialInquiry" } | { kind: "losers" } | null
  >(null);
  const [templateManagerInitialId, setTemplateManagerInitialId] = useState<
    string | null
  >(null);
  const routeDocumentsSubTab = (() => {
    const value = new URLSearchParams(search).get("documentsSubTab");
    return value === "pd" || value === "templates" || value === "dochub" || value === "ceniky"
      ? value
      : null;
  })();
  const shouldHighlightDocHubSetup =
    routeDocumentsSubTab === "dochub" &&
    !project.docHubRootLink?.trim();

  const extractTemplateId = (link: string | null | undefined) => {
    if (!link) return null;
    if (!link.startsWith("template:")) return null;
    return link.split(":")[1] || null;
  };

  const openTemplateManager = (opts: {
    target: { kind: "inquiry" } | { kind: "materialInquiry" } | { kind: "losers" } | null;
    initialLink?: string | null;
  }) => {
    setTemplateManagerTarget(opts.target);
    setTemplateManagerInitialId(extractTemplateId(opts.initialLink));
    setShowTemplateManager(true);
  };

  useEffect(() => {
    setDocsLinkValue(project.documentationLink || "");
  }, [project.documentationLink, isEditingDocs]);

  const [isEditingPriceList, setIsEditingPriceList] = useState(false);
  useEffect(() => {
    if (!availableSubTabs.includes(documentsSubTab)) {
      setDocumentsSubTab("pd");
    }
  }, [availableSubTabs, documentsSubTab]);

  useEffect(() => {
    if (!routeDocumentsSubTab) return;
    if (!availableSubTabs.includes(routeDocumentsSubTab)) return;
    setDocumentsSubTab(routeDocumentsSubTab);
  }, [availableSubTabs, routeDocumentsSubTab]);

  useEffect(() => {
    setPriceListLinkValue(project.priceListLink || "");
  }, [project.priceListLink, isEditingPriceList]);

  useEffect(() => {
    setLetterLinkValue(project.inquiryLetterLink || "");
  }, [project.inquiryLetterLink, isEditingLetter]);

  // Sync effect removed

  // Load template name asynchronously
  useEffect(() => {
    if (project.inquiryLetterLink?.startsWith("template:")) {
      const templateId = project.inquiryLetterLink.split(":")[1];
      getTemplateById(templateId, { projectId: project.id }).then((template) => {
        setTemplateName(template?.name || "Neznámá šablona");
      });
    } else {
      setTemplateName(null);
    }
  }, [project.id, project.inquiryLetterLink]);

  useEffect(() => {
    if (project.materialInquiryTemplateLink?.startsWith("template:")) {
      const templateId = project.materialInquiryTemplateLink.split(":")[1];
      getTemplateById(templateId, { projectId: project.id }).then((template) => {
        setMaterialTemplateName(template?.name || "Neznámá šablona");
      });
    } else {
      setMaterialTemplateName(null);
    }
  }, [project.id, project.materialInquiryTemplateLink]);

  useEffect(() => {
    if (project.losersEmailTemplateLink?.startsWith("template:")) {
      const templateId = project.losersEmailTemplateLink.split(":")[1];
      getTemplateById(templateId, { projectId: project.id }).then((template) => {
        setLosersTemplateName(template?.name || "Neznámá šablona");
      });
    } else {
      setLosersTemplateName(null);
    }
  }, [project.id, project.losersEmailTemplateLink]);

  const handleSaveDocs = () => {
    onUpdate({ documentationLink: docsLinkValue });
    setIsEditingDocs(false);
  };

  const handleSavePriceList = () => {
    const trimmedValue = priceListLinkValue.trim();
    if (trimmedValue && !isProbablyUrl(trimmedValue)) {
      showModal({
        title: "Neplatný odkaz",
        message: "Použijte prosím odkaz začínající na http:// nebo https://.",
        variant: "danger",
      });
      return;
    }

    onUpdate({ priceListLink: trimmedValue });
    setIsEditingPriceList(false);
  };

  const handleSaveLetter = async () => {
    if (selectedTemplateFile) {
      // Upload file to storage
      setIsUploadingTemplate(true);
      try {
        const doc = await uploadDocument(
          selectedTemplateFile,
          `template_${project.id || "default"}`
        );
        onUpdate({ inquiryLetterLink: doc.url });
        setSelectedTemplateFile(null);
      } catch (error) {
        console.error("Error uploading template:", error);
        showModal({
          title: "Chyba",
          message: "Chyba při nahrávání šablony. Zkuste to prosím znovu.",
          variant: "danger",
        });
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

  const [uiModal, setUiModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: "danger" | "info" | "success";
    copyableText?: string;
  }>({ isOpen: false, title: "", message: "", variant: "info" });

  const showModal = (args: {
    title: string;
    message: string;
    variant?: "danger" | "info" | "success";
    copyableText?: string;
  }) => {
    setUiModal({
      isOpen: true,
      title: args.title,
      message: args.message,
      variant: args.variant ?? "info",
      copyableText: args.copyableText,
    });
  };

  const hasDocsLink = Boolean(
    project.documentationLink && project.documentationLink.trim() !== "",
  );

  const documentTabs: Array<{
    id: DocumentsSubTab;
    label: string;
    icon: string;
    visible: boolean;
  }> = [
    { id: "pd", label: "Projektová dokumentace", icon: "description", visible: true },
    { id: "templates", label: "Šablony", icon: "history_edu", visible: canTemplates },
    { id: "dochub", label: "Složkomat", icon: "cloud_sync", visible: canDocHub },
    { id: "ceniky", label: "Ceníky", icon: "price_change", visible: true },
  ];

  return (
    <div
      data-layout-density="compact"
      className="tf-documents-view h-full min-h-screen overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950 md:p-6 lg:p-8"
    >
      <ConfirmationModal
        isOpen={uiModal.isOpen}
        title={uiModal.title}
        message={uiModal.message}
        variant={uiModal.variant}
        copyableText={uiModal.copyableText}
        confirmLabel="OK"
        onConfirm={() => setUiModal((prev) => ({ ...prev, isOpen: false }))}
      />

      <div className="max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <div
            data-help-id="documents-header-icon"
            className="flex size-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary"
          >
            <span className="material-symbols-outlined text-xl">
              folder_open
            </span>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Dokumenty
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Správa dokumentace, šablon a napojení na Složkomat
            </p>
          </div>
        </div>

        <div className="animate-fadeIn">
          <aside data-help-id="documents-sidebar" className="w-full">
            <nav
              role="tablist"
              aria-label="Sekce dokumentů"
              className="flex min-w-0 gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900/70"
            >
              {documentTabs.filter((tab) => tab.visible).map((tab) => (
                <button
                  key={tab.id}
                  id={`documents-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={documentsSubTab === tab.id}
                  aria-controls="documents-tabpanel"
                  onClick={() => setDocumentsSubTab(tab.id)}
                  className={`flex min-h-10 flex-none items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${documentsSubTab === tab.id
                    ? "bg-slate-100 text-primary shadow-sm dark:bg-slate-800"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white"
                    }`}
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden>
                    {tab.icon}
                  </span>
                  {tab.label}
                </button>
              ))}
            </nav>

            <div
              data-help-id="documents-tip"
              className="mt-2 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-100/70 px-3 py-2 text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400"
            >
              <span className="material-symbols-outlined mt-0.5 text-[16px]" aria-hidden>lightbulb</span>
              <p className="text-xs leading-relaxed">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Tip:</span>{" "}
                Udržujte dokumentaci aktuální a dobře organizovanou pro snadný přístup celého týmu.
              </p>
            </div>
          </aside>

          <main
            id="documents-tabpanel"
            role="tabpanel"
            aria-labelledby={`documents-tab-${documentsSubTab}`}
            className="mt-4 min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 md:p-5"
          >
            {documentsSubTab === "pd" && (
              <DocsLinkSection
                project={project}
                hasDocsLink={hasDocsLink}
                isEditing={isEditingDocs}
                onEditToggle={setIsEditingDocs}
                linkValue={docsLinkValue}
                onLinkValueChange={(val) => setDocsLinkValue(val)}
                onSave={handleSaveDocs}
                showModal={showModal}
                onUpdate={onUpdate}
              />
            )}

            {documentsSubTab === "templates" && canTemplates && (
              <div data-help-id="templates-section">
              <TemplatesSection
                project={project}
                templateName={templateName}
                materialTemplateName={materialTemplateName}
                losersTemplateName={losersTemplateName}
                openTemplateManager={openTemplateManager}
              />
              </div>
            )}

            {/* DocHub Section (Wizard) */}
            {documentsSubTab === "dochub" && canDocHub && (
              <div className="space-y-6">
                {shouldHighlightDocHubSetup && (
                  <div
                    data-help-id="dochub-setup-alert"
                    className="rounded-xl border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
                  >
                    Nová realizační stavba potřebuje vlastní realizační složku. Dokončete prosím napojení Složkomatu níže.
                  </div>
                )}

                <div data-help-id="dochub-status">
                  <DocHubStatusCard
                    state={docHub.state}
                    actions={docHub.actions}
                    setters={docHub.setters}
                    showModal={showModal}
                  />
                </div>

                <div data-help-id="dochub-setup">
                  <DocHubSetupWizard
                    state={docHub.state}
                    actions={docHub.actions}
                    setters={docHub.setters}
                    showModal={showModal}
                  />
                </div>

                {docHub.state.isConnected && !docHub.state.isEditingSetup && (
                  <>
                    {docHub.state.canManageGlobal && (
                      <div data-help-id="dochub-structure">
                        <DocHubStructureEditor
                          state={docHub.state}
                          actions={docHub.actions}
                          setters={docHub.setters}
                          showModal={showModal}
                        />
                      </div>
                    )}

                    <div data-help-id="dochub-links">
                      <DocHubLinks state={docHub.state} showModal={showModal} />
                    </div>

                    {docHub.state.canManageGlobal && (
                      <div data-help-id="dochub-autocreate">
                        <DocHubAutoCreateStatus
                          state={docHub.state}
                          setters={docHub.setters}
                          showModal={showModal}
                          showLog={showDocHubRunLog}
                          setShowLog={setShowDocHubRunLog}
                          showOverview={showDocHubRunOverview}
                          setShowOverview={setShowDocHubRunOverview}
                          logRef={docHubRunLogRef}
                          overviewRef={docHubRunOverviewRef}
                        />
                      </div>
                    )}

                    <div data-help-id="dochub-history">
                      <DocHubHistory
                        project={project}
                        onSelectRun={handleHistorySelect}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Price Lists Section */}
            {documentsSubTab === "ceniky" && (
              <PriceListsSection
                project={project}
                isEditing={isEditingPriceList}
                onEditToggle={setIsEditingPriceList}
                linkValue={priceListLinkValue}
                onLinkValueChange={(val) => setPriceListLinkValue(val)}
                onSave={handleSavePriceList}
                isDocHubConnected={canDocHub && isDocHubConnected}
                docHubCenikyLink={canDocHub ? docHubProjectLinks?.ceniky || null : null}
                showModal={showModal}
              />
            )}
          </main>
        </div>
      </div>

      {/* Template Manager Overlay */}
      {showTemplateManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-6xl h-[85vh] shadow-2xl">
            <TemplateManager
              project={project}
              initialTemplateId={templateManagerInitialId}
              onClose={() => {
                setShowTemplateManager(false);
                setTemplateManagerTarget(null);
                setTemplateManagerInitialId(null);
              }}
              onSelectTemplate={
                templateManagerTarget
                  ? (template) => {
                    if (templateManagerTarget.kind === "inquiry") {
                      onUpdate({
                        inquiryLetterLink: `template:${template.id}`,
                      });
                    } else if (templateManagerTarget.kind === "materialInquiry") {
                      onUpdate({
                        materialInquiryTemplateLink: `template:${template.id}`,
                      });
                    } else if (templateManagerTarget.kind === "losers") {
                      onUpdate({
                        losersEmailTemplateLink: `template:${template.id}`,
                      });
                    }
                    setShowTemplateManager(false);
                    setTemplateManagerTarget(null);
                    setTemplateManagerInitialId(null);
                  }
                  : undefined
              }
            />
          </div>
        </div>
      )}
    </div>
  );
};

export { ProjectDocuments };
