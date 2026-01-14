/**
 * ProjectDocuments Component
 * Manages document links, templates, DocHub integration for projects.
 * Extracted from ProjectLayout.tsx for better modularity.
 */

import React, { useEffect, useRef, useState } from "react";
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
  if (val >= 1000000) return (val / 1000000).toFixed(1) + "M Kč";
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(val);
};

const formatMoneyFull = (val: number): string => {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(val);
};

export interface ProjectDocumentsProps {
  project: ProjectDetails;
  onUpdate: (updates: Partial<ProjectDetails>) => void;
}

const ProjectDocuments: React.FC<ProjectDocumentsProps> = ({
  project,
  onUpdate,
}) => {
  type DocumentsSubTab = "pd" | "templates" | "dochub" | "ceniky";
  const [isEditingDocs, setIsEditingDocs] = useState(false);
  const [isEditingLetter, setIsEditingLetter] = useState(false);
  const [documentsSubTab, setDocumentsSubTab] = useState<DocumentsSubTab>("pd");
  const [docsLinkValue, setDocsLinkValue] = useState("");
  const [priceListLinkValue, setPriceListLinkValue] = useState("");
  const [letterLinkValue, setLetterLinkValue] = useState("");
  // DocHub Integration Hook
  const docHub = useDocHubIntegration(project, onUpdate);
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
  const [losersTemplateName, setLosersTemplateName] = useState<string | null>(
    null
  );
  const [templateManagerTarget, setTemplateManagerTarget] = useState<
    { kind: "inquiry" } | { kind: "losers" } | null
  >(null);
  const [templateManagerInitialId, setTemplateManagerInitialId] = useState<
    string | null
  >(null);

  const extractTemplateId = (link: string | null | undefined) => {
    if (!link) return null;
    if (!link.startsWith("template:")) return null;
    return link.split(":")[1] || null;
  };

  const openTemplateManager = (opts: {
    target: { kind: "inquiry" } | { kind: "losers" } | null;
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
      getTemplateById(templateId).then((template) => {
        setTemplateName(template?.name || "Neznámá šablona");
      });
    } else {
      setTemplateName(null);
    }
  }, [project.inquiryLetterLink]);

  useEffect(() => {
    if (project.losersEmailTemplateLink?.startsWith("template:")) {
      const templateId = project.losersEmailTemplateLink.split(":")[1];
      getTemplateById(templateId).then((template) => {
        setLosersTemplateName(template?.name || "Neznámá šablona");
      });
    } else {
      setLosersTemplateName(null);
    }
  }, [project.losersEmailTemplateLink]);

  const handleSaveDocs = () => {
    onUpdate({ documentationLink: docsLinkValue });
    setIsEditingDocs(false);
  };

  const handleSavePriceList = () => {
    onUpdate({ priceListLink: priceListLinkValue });
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

  const hasDocsLink =
    project.documentationLink && project.documentationLink.trim() !== "";

  return (
    <div className="p-6 lg:p-10 flex flex-col gap-6 overflow-y-auto h-full bg-slate-50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 min-h-screen">
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
        <div className="flex items-center gap-3 mb-8 px-4 md:px-0">
          <div className="size-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-emerald-400 text-2xl">
              folder_open
            </span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Dokumenty
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Správa dokumentace, šablon a napojení na Složkomat
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8 animate-fadeIn">
          {/* Sidebar Navigation */}
          <aside className="w-full md:w-64 flex-shrink-0">
            <nav className="flex flex-col gap-2">
              <button
                onClick={() => setDocumentsSubTab("pd")}
                className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${documentsSubTab === "pd"
                  ? "bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                  : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[20px]">
                    description
                  </span>
                  Projektová dokumentace
                </div>
              </button>

              <button
                onClick={() => setDocumentsSubTab("templates")}
                className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${documentsSubTab === "templates"
                  ? "bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                  : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[20px]">
                    history_edu
                  </span>
                  Šablony
                </div>
              </button>

              <button
                onClick={() => setDocumentsSubTab("dochub")}
                className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${documentsSubTab === "dochub"
                  ? "bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                  : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[20px]">
                    cloud_sync
                  </span>
                  Složkomat
                </div>
              </button>

              <button
                onClick={() => setDocumentsSubTab("ceniky")}
                className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${documentsSubTab === "ceniky"
                  ? "bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                  : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[20px]">
                    price_change
                  </span>
                  Ceníky
                </div>
              </button>
            </nav>

            {/* Tips Section Sidebar */}
            <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl mx-2 md:mx-0">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-blue-400 text-[20px]">
                  lightbulb
                </span>
                <div>
                  <h4 className="font-semibold text-blue-300 text-sm mb-1">
                    Tip
                  </h4>
                  <p className="text-xs text-blue-400/80 leading-relaxed">
                    Udržujte dokumentaci aktuální a dobře organizovanou pro snadný přístup celého týmu.
                  </p>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0 bg-white dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700/40 rounded-2xl shadow-sm p-6">
            {documentsSubTab === "pd" && (
              <DocsLinkSection
                project={project}
                hasDocsLink={hasDocsLink}
                isEditing={isEditingDocs}
                onEditToggle={setIsEditingDocs}
                linkValue={docsLinkValue}
                onLinkValueChange={(val) => setDocsLinkValue(val)}
                onSave={handleSaveDocs}
                isDocHubConnected={isDocHubConnected}
                docHubPdLink={docHubProjectLinks?.pd || null}
                docHubStructure={docHubStructure}
                showModal={showModal}
                onUpdate={onUpdate}
              />
            )}

            {documentsSubTab === "templates" && (
              <TemplatesSection
                project={project}
                templateName={templateName}
                losersTemplateName={losersTemplateName}
                openTemplateManager={openTemplateManager}
              />
            )}

            {/* DocHub Section (Wizard) */}
            {documentsSubTab === "dochub" && (
              <div className="space-y-6">
                <DocHubStatusCard
                  state={docHub.state}
                  actions={docHub.actions}
                  setters={docHub.setters}
                  showModal={showModal}
                />

                <DocHubSetupWizard
                  state={docHub.state}
                  actions={docHub.actions}
                  setters={docHub.setters}
                  showModal={showModal}
                />

                {docHub.state.isConnected && !docHub.state.isEditingSetup && (
                  <>
                    <DocHubStructureEditor
                      state={docHub.state}
                      actions={docHub.actions}
                      setters={docHub.setters}
                      showModal={showModal}
                    />

                    <DocHubLinks state={docHub.state} showModal={showModal} />

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

                    <DocHubHistory
                      project={project}
                      onSelectRun={handleHistorySelect}
                    />
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
                isDocHubConnected={isDocHubConnected}
                docHubCenikyLink={docHubProjectLinks?.ceniky || null}
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
