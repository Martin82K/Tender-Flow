import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Header } from "./Header";
import {
  DemandCategory,
  Bid,
  BidStatus,
  Subcontractor,
  ProjectDetails,
  StatusConfig,
  DemandDocument,
} from "../types";
import { SubcontractorSelector } from "./SubcontractorSelector";
import { ConfirmationModal } from "./ConfirmationModal";
import { AlertModal } from "./AlertModal";
import { supabase } from "../services/supabase";
import { invokeAuthedFunction } from "../services/functionsClient";
import { uploadDocument, formatFileSize } from "../services/documentService";
import {
  generateInquiryEmail,
  generateInquiryEmailHtml,
  createMailtoLink,
  downloadEmlFile,
  generateEmlContent,
} from "../services/inquiryService";
import {
  exportToXLSX,
  exportToMarkdown,
  exportToPDF,
} from "../services/exportService";
import {
  formatMoney,
  formatInputNumber,
  parseFormattedNumber,
} from "../utils/formatters";
import {
  getTemplateById,
  getDefaultTemplate,
} from "../services/templateService";
import { Template } from "../types";
import { processTemplate } from "../utils/templateUtils";
import { useAuth } from "../context/AuthContext";
import { getDemoData, saveDemoData } from "../services/demoData";
import {
  getDocHubTenderLinks,
  getDocHubTenderLinksDesktop,
  isProbablyUrl,
  resolveDocHubStructureV1,
  slugifyDocHubSegmentStrict,
} from "../utils/docHub";
import {
  ensureStructure,
  deleteFolder,
  folderExists,
} from "../services/fileSystemService";
import { mcpOpenPath } from "../services/mcpBridgeClient";
import platformAdapter from "../services/platformAdapter";
import { DEFAULT_STATUSES } from "../config/constants";
import {
  Column,
  BidCard,
  EditBidModal,
  CategoryCard,
  CreateContactModal,
  SubcontractorSelectorModal,
  PipelineOverview,
  CategoryFormModal,
  CategoryFormData,
} from "./pipelineComponents";

// --- Components ---
// All reusable components are now imported from pipelineComponents

interface PipelineProps {
  projectId: string;
  projectDetails: ProjectDetails;
  bids: Record<string, Bid[]>;
  contacts: Subcontractor[];
  statuses?: StatusConfig[];
  onAddCategory?: (category: DemandCategory) => void;
  onEditCategory?: (category: DemandCategory) => void;
  onDeleteCategory?: (categoryId: string) => void;
  onBidsChange?: (bids: Record<string, Bid[]>) => void;
  onUpdateContact?: (contact: Subcontractor) => void;
  searchQuery?: string;
  initialOpenCategoryId?: string;
}

type PipelineViewMode = "grid" | "table";

export const Pipeline: React.FC<PipelineProps> = ({
  projectId,
  projectDetails,
  bids: initialBids,
  contacts: externalContacts,
  statuses: externalStatuses = DEFAULT_STATUSES,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onBidsChange,
  onUpdateContact,
  searchQuery = "",
  initialOpenCategoryId,
}) => {
  const { user } = useAuth();
  // ... (existing code omitted for brevity)

  // ... inside the render, look for EditBidModal ...

  const projectData = projectDetails;
  const docHubRoot = projectDetails.docHubRootLink?.trim() || "";
  const isDocHubEnabled =
    !!projectDetails.docHubEnabled && docHubRoot.length > 0;
  const docHubStructure = resolveDocHubStructureV1(
    projectDetails.docHubStructureV1 || undefined,
  );
  const canUseDocHubBackend =
    !!projectDetails.docHubProvider &&
    projectDetails.docHubProvider !== "mcp" &&
    projectDetails.docHubProvider !== "onedrive" &&
    !!projectDetails.docHubRootId &&
    projectDetails.docHubStatus === "connected";

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: "danger" | "info" | "success";
    copyableText?: string;
  }>({ isOpen: false, title: "", message: "", variant: "info" });

  const showAlert = (args: {
    title: string;
    message: string;
    variant?: "danger" | "info" | "success";
    copyableText?: string;
  }) => {
    setAlertModal({
      isOpen: true,
      title: args.title,
      message: args.message,
      variant: args.variant ?? "info",
      copyableText: args.copyableText,
    });
  };

  const alertModalNode = (
    <AlertModal
      isOpen={alertModal.isOpen}
      title={alertModal.title}
      message={alertModal.message}
      variant={alertModal.variant}
      copyableText={alertModal.copyableText}
      onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
    />
  );

  const openOrCopyDocHubPath = async (path: string) => {
    console.log("[DocHub] openOrCopyDocHubPath called with path:", path);
    if (!path) {
      console.warn("[DocHub] Empty path, returning");
      return;
    }
    if (isProbablyUrl(path)) {
      console.log("[DocHub] Path is URL, opening in browser");
      window.open(path, "_blank", "noopener,noreferrer");
      return;
    }

    // Try native Electron folder opening first (for Tender Flow Desktop / onedrive provider)
    console.log(
      "[DocHub] Attempting to open local path. isDocHubEnabled:",
      isDocHubEnabled,
    );
    if (isDocHubEnabled && !isProbablyUrl(path)) {
      try {
        // Dynamic import to avoid issues on web
        const { fileSystemAdapter, isDesktop } =
          await import("../services/platformAdapter");
        console.log("[DocHub] isDesktop:", isDesktop);
        if (isDesktop) {
          console.log(
            "[DocHub] Calling fileSystemAdapter.openInExplorer with path:",
            path,
          );
          await fileSystemAdapter.openInExplorer(path);
          console.log("[DocHub] openInExplorer completed successfully");
          return; // Opened successfully - Desktop doesn't need MCP fallback
        }

        // Only try MCP if NOT on desktop (web browser with MCP bridge)
        console.log("[DocHub] Not on desktop, trying MCP open for path:", path);
        const result = await mcpOpenPath(path);
        console.log("[DocHub] MCP result:", result);
        if (result.success) return; // Opened successfully
      } catch (e) {
        console.warn("[DocHub] Open failed, falling back to copy", e);
      }
    }

    try {
      await navigator.clipboard.writeText(path);
      showAlert({
        title: "Zkopírováno",
        message: path,
        variant: "success",
      });
    } catch {
      showAlert({
        title: "Kopírování selhalo",
        message: "Automatické kopírování selhalo. Zkopírujte cestu ručně:",
        variant: "info",
        copyableText: path,
      });
    }
  };

  const openDocHubBackendLink = async (payload: any) => {
    // Safety guard: Never allow backend calls for MCP/Tender Flow Desktop
    if (
      projectData.docHubProvider === "mcp" ||
      projectData.docHubProvider === "onedrive"
    ) {
      console.warn(
        "[DocHub] Blocked backend call for MCP/Tender Flow Desktop provider",
      );
      return;
    }

    try {
      const data = await invokeAuthedFunction<any>("dochub-get-link", {
        body: payload,
      });
      const webUrl = (data as any)?.webUrl as string | undefined;
      if (!webUrl) throw new Error("Backend nevrátil webUrl");
      window.open(webUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Neznámá chyba";
      showAlert({ title: "DocHub chyba", message, variant: "danger" });
    }
  };

  const [activeCategory, setActiveCategory] = useState<DemandCategory | null>(
    null,
  );
  const [demandFilter, setDemandFilter] = useState<
    "all" | "open" | "closed" | "sod"
  >("all");
  const PIPELINE_VIEW_MODE_STORAGE_KEY = "tender_pipeline_view_mode";
  const [viewMode, setViewMode] = useState<PipelineViewMode>(() => {
    const stored = localStorage.getItem(PIPELINE_VIEW_MODE_STORAGE_KEY);
    return stored === "table" || stored === "grid" ? stored : "grid";
  });
  const [bids, setBids] = useState<Record<string, Bid[]>>(initialBids);
  // const [contacts, setContacts] = useState<Subcontractor[]>(ALL_CONTACTS); // Use prop directly or state if we modify it locally?
  // The component modifies contacts (adding new ones). So we might need state, but initialized from prop.
  // However, App.tsx manages contacts. Ideally we should call a handler to add contact in App.tsx.
  // For now, let's keep local state initialized from prop to minimize refactor,
  // BUT we need to sync back or just rely on the fact that we insert to Supabase and App.tsx might reload?
  // App.tsx doesn't auto-reload contacts on change in child.
  // Let's use a local state initialized from prop for now.
  const [localContacts, setLocalContacts] =
    useState<Subcontractor[]>(externalContacts);

  // Track whether the bids change is internal (user action) vs from props
  const isInternalBidsChange = useRef(false);
  // Store pending bids to notify parent after render
  const pendingBidsNotification = useRef<Record<string, Bid[]> | null>(null);

  useEffect(() => {
    setLocalContacts(externalContacts);
  }, [externalContacts]);

  useEffect(() => {
    // Only update from props if not an internal change
    if (!isInternalBidsChange.current) {
      setBids(initialBids);
    }
    isInternalBidsChange.current = false;
  }, [initialBids]);

  useEffect(() => {
    localStorage.setItem(PIPELINE_VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  // Notify parent after render when we have pending changes
  useEffect(() => {
    if (pendingBidsNotification.current !== null && onBidsChange) {
      onBidsChange(pendingBidsNotification.current);
      pendingBidsNotification.current = null;
    }
  });

  // Helper to update bids and mark as internal change
  const updateBidsInternal = (
    updater: (prev: Record<string, Bid[]>) => Record<string, Bid[]>,
  ) => {
    isInternalBidsChange.current = true;
    setBids((prev) => {
      const newBids = updater(prev);
      // Store for notification after render (not during render)
      pendingBidsNotification.current = newBids;
      return newBids;
    });
  };

  // Subcontractor Selection State
  const [isSubcontractorModalOpen, setIsSubcontractorModalOpen] =
    useState(false);
  const [selectedSubcontractorIds, setSelectedSubcontractorIds] = useState<
    Set<string>
  >(new Set());

  // Edit Bid State
  const [editingBid, setEditingBid] = useState<Bid | null>(null);

  // Create New Category State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<DemandCategory | null>(
    null,
  );
  // Linked tender plan dates for syncing (loaded when editing category)
  const [linkedTenderPlanDates, setLinkedTenderPlanDates] = useState<{
    dateFrom: string;
    dateTo: string;
  } | null>(null);
  const [newCategoryForm, setNewCategoryForm] = useState({
    title: "",
    sodBudget: "",
    planBudget: "",
    description: "",
    deadline: "",
    realizationStart: "",
    realizationEnd: "",
  });
  const [isSubcontractorModalMaximized, setIsSubcontractorModalMaximized] =
    useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  // Create Contact State
  const [isCreateContactModalOpen, setIsCreateContactModalOpen] =
    useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [editingContact, setEditingContact] = useState<Subcontractor | null>(
    null,
  );

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const closeConfirmModal = () => {
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
  };

  const handleDeleteBidRequest = (bidId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Odstranit nabídku",
      message:
        "Opravdu chcete odebrat tohoto dodavatele z výběrového řízení? Tato akce je nevratná.",
      onConfirm: () => {
        handleDeleteBid(bidId);
        closeConfirmModal();
      },
    });
  };

  // Track previous project ID to detect actual project changes
  const prevProjectIdRef = useRef<string | null>(null);

  // Reset active category when switching projects, unless we have an initial category to open
  useEffect(() => {
    const projectActuallyChanged =
      prevProjectIdRef.current !== null &&
      prevProjectIdRef.current !== projectId;
    prevProjectIdRef.current = projectId;

    if (initialOpenCategoryId) {
      const categoryToOpen = projectDetails.categories.find(
        (c) => c.id === initialOpenCategoryId,
      );
      if (categoryToOpen) {
        setActiveCategory(categoryToOpen);
      }
    } else if (projectActuallyChanged) {
      // Only reset if project actually changed, not on initial render or category updates
      setActiveCategory(null);
    }
  }, [projectId, initialOpenCategoryId, projectDetails.categories]);

  const getBidsForColumn = (categoryId: string, status: BidStatus) => {
    return (bids[categoryId] || []).filter((bid) => bid.status === status);
  };

  const handleDragStart = (e: React.DragEvent, bidId: string) => {
    e.dataTransfer.setData("bidId", bidId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: BidStatus) => {
    e.preventDefault();
    const bidId = e.dataTransfer.getData("bidId");

    if (activeCategory && bidId) {
      // Optimistic update
      updateBidsInternal((prev) => {
        const categoryBids = [...(prev[activeCategory.id] || [])];
        const bidIndex = categoryBids.findIndex((b) => b.id === bidId);

        if (bidIndex > -1 && categoryBids[bidIndex].status !== targetStatus) {
          categoryBids[bidIndex] = {
            ...categoryBids[bidIndex],
            status: targetStatus,
          };
          return { ...prev, [activeCategory.id]: categoryBids };
        }
        return prev;
      });

      // Persist to Supabase or Demo Storage
      try {
        if (user?.role === "demo") {
          const demoData = getDemoData();
          if (demoData && demoData.projectDetails[projectData.id]) {
            const projectBids =
              demoData.projectDetails[projectData.id].bids || {};
            // Find which category this bid belongs to
            let categoryId = "";
            for (const [catId, catBids] of Object.entries(projectBids)) {
              if ((catBids as Bid[]).some((b) => b.id === bidId)) {
                categoryId = catId;
                break;
              }
            }

            if (categoryId) {
              const categoryBids = projectBids[categoryId] || [];
              const index = categoryBids.findIndex((b: Bid) => b.id === bidId);
              if (index > -1) {
                categoryBids[index].status = targetStatus;
                projectBids[categoryId] = categoryBids;
                demoData.projectDetails[projectData.id].bids = projectBids;
                saveDemoData(demoData);
              }
            }
          }
          return;
        }

        const { error } = await supabase
          .from("bids")
          .update({ status: targetStatus })
          .eq("id", bidId);

        if (error) {
          console.error("Error updating bid status:", error);
        }
      } catch (err) {
        console.error("Unexpected error updating bid:", err);
      }
    }
  };

  // Toggle contracted status for a bid (marks as signed contract)
  const handleToggleContracted = async (bid: Bid) => {
    if (!activeCategory) return;

    const newContracted = !bid.contracted;

    // Optimistic update
    updateBidsInternal((prev) => {
      const categoryBids = [...(prev[activeCategory.id] || [])];
      const index = categoryBids.findIndex((b) => b.id === bid.id);
      if (index > -1) {
        categoryBids[index] = {
          ...categoryBids[index],
          contracted: newContracted,
        };
        return { ...prev, [activeCategory.id]: categoryBids };
      }
      return prev;
    });

    // Persist to Supabase or Demo Storage
    try {
      if (user?.role === "demo") {
        const demoData = getDemoData();
        if (demoData && demoData.projectDetails[projectData.id]) {
          const projectBids =
            demoData.projectDetails[projectData.id].bids || {};
          const categoryBids = projectBids[activeCategory.id] || [];
          const index = categoryBids.findIndex((b: Bid) => b.id === bid.id);
          if (index > -1) {
            categoryBids[index].contracted = newContracted;
            projectBids[activeCategory.id] = categoryBids;
            demoData.projectDetails[projectData.id].bids = projectBids;
            saveDemoData(demoData);
          }
        }
        return;
      }

      const { error } = await supabase
        .from("bids")
        .update({ contracted: newContracted })
        .eq("id", bid.id);

      if (error) {
        console.error("Error updating bid contracted status:", error);
      }
    } catch (err) {
      console.error("Unexpected error updating bid:", err);
    }
  };

  const handleAddSubcontractors = async () => {
    if (!activeCategory) return;

    const newBids: Bid[] = [];
    selectedSubcontractorIds.forEach((id) => {
      const contact = localContacts.find((c) => c.id === id);
      if (contact) {
        // Check if already exists
        const existing = (bids[activeCategory.id] || []).find(
          (b) => b.subcontractorId === contact.id,
        );
        if (!existing) {
          const primaryContact = contact.contacts[0];
          newBids.push({
            id: `bid_${Date.now()}_${contact.id}`,
            subcontractorId: contact.id,
            companyName: contact.company,
            contactPerson: primaryContact?.name || "-",
            email: primaryContact?.email || "-",
            phone: primaryContact?.phone || "-",
            price: "?",
            status: "contacted",
            tags: [],
          });
        }
      }
    });

    if (newBids.length > 0) {
      // Optimistic update
      updateBidsInternal((prev) => ({
        ...prev,
        [activeCategory.id]: [...(prev[activeCategory.id] || []), ...newBids],
      }));

      // Persist to Supabase or Demo Storage
      try {
        if (user?.role === "demo") {
          const demoData = getDemoData();
          if (demoData && demoData.projectDetails[projectData.id]) {
            const projectBids =
              demoData.projectDetails[projectData.id].bids || {};
            projectBids[activeCategory.id] = [
              ...(projectBids[activeCategory.id] || []),
              ...newBids,
            ];
            demoData.projectDetails[projectData.id].bids = projectBids;
            saveDemoData(demoData);
          }
          return;
        }

        const bidsToInsert = newBids.map((bid) => ({
          id: bid.id,
          demand_category_id: activeCategory.id,
          subcontractor_id: bid.subcontractorId,
          company_name: bid.companyName,
          contact_person: bid.contactPerson,
          email: bid.email,
          phone: bid.phone,
          price: null, // Numeric price, null for new bids
          price_display: bid.price, // String display like "?" or "1.5M Kč"
          notes: bid.notes || null,
          status: bid.status,
          tags: bid.tags || [],
        }));

        console.log(
          "🔵 Attempting to insert bids:",
          JSON.stringify(bidsToInsert, null, 2),
        );

        const { data, error } = await supabase
          .from("bids")
          .insert(bidsToInsert)
          .select();

        if (error) {
          console.error("🔴 Error inserting bids:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            fullError: JSON.stringify(error, null, 2),
          });

          showAlert({
            title: "Chyba při ukládání",
            message: `Chyba při ukládání nabídek: ${error.message}\n\nKód: ${error.code}\nDetail: ${error.details || "N/A"}\nHint: ${error.hint || "N/A"}`,
            variant: "danger",
          });
        } else {
          console.log("🟢 Successfully inserted bids:", data);

          // AUTO-CREATE: Unified (Desktop, MCP, Cloud)
          if (isDocHubEnabled) {
            const provider = projectData.docHubProvider;

            // Desktop & MCP: Use fileSystemService (which delegates to Electron or MCP)
            if (provider === "onedrive" || provider === "mcp") {
              const mcpSuppliers: Record<
                string,
                Array<{ id: string; name: string }>
              > = {};
              mcpSuppliers[activeCategory.id] = newBids.map((b) => ({
                id: b.subcontractorId,
                name: b.companyName,
              }));

              const structure = resolveDocHubStructureV1(
                projectData.docHubStructureV1 || undefined,
              );
              const { buildHierarchyTree } = await import("../utils/docHub"); // Import helper if not top-level
              const hierarchyTree = buildHierarchyTree(
                structure.extraHierarchy || [],
              );

              // For MCP, docHubRoot is the path. For Desktop (onedrive), it is also the path.
              ensureStructure({
                rootPath: docHubRoot,
                structure,
                categories: [
                  { id: activeCategory.id, title: activeCategory.title },
                ],
                suppliers: mcpSuppliers,
                hierarchy: hierarchyTree,
              }).then((res) => {
                if (res.success) {
                  // toast.success("Složky vytvořeny.");
                } else {
                  console.error("Auto-create folders failed:", res.error);
                  showAlert({
                    title: "Chyba vytvoření složek",
                    message: res.error || "Neznámá chyba",
                    variant: "danger",
                  });
                }
              });
            } else if (provider === "gdrive" || provider === "onedrive_cloud") {
              // Cloud: Trigger backend
              invokeAuthedFunction("dochub-autocreate", {
                body: { projectId: projectData.id },
              }).catch((e) =>
                console.error("Cloud auto-create trigger failed:", e),
              );
            }
          }
        }
      } catch (err) {
        console.error("🔴 Unexpected error inserting bids:", err);

        showAlert({
          title: "Chyba",
          message: `Neočekávaná chyba: ${err}`,
          variant: "danger",
        });
      }
    }

    setIsSubcontractorModalOpen(false);
    setSelectedSubcontractorIds(new Set());
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddCategory) return;

    const sod = parseFloat(newCategoryForm.sodBudget) || 0;
    const categoryId = `cat_${Date.now()}`;

    // Upload documents if any
    let uploadedDocuments: DemandDocument[] = [];
    if (selectedFiles.length > 0) {
      setUploadingFiles(true);
      try {
        uploadedDocuments = await Promise.all(
          selectedFiles.map((file) => uploadDocument(file, categoryId)),
        );
      } catch (error) {
        console.error("Error uploading documents:", error);
        console.error("Error uploading documents:", error);
        showAlert({
          title: "Chyba",
          message: "Chyba při nahrávání dokumentů. Zkuste to prosím znovu.",
          variant: "danger",
        });
        setUploadingFiles(false);
        setUploadingFiles(false);
        return;
      }
      setUploadingFiles(false);
    }

    const newCat: DemandCategory = {
      id: categoryId,
      title: newCategoryForm.title,
      budget:
        "~" +
        new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(
          sod,
        ) +
        " Kč", // Legacy
      sodBudget: sod,
      planBudget: parseFloat(newCategoryForm.planBudget) || 0,
      description: newCategoryForm.description,
      status: "open",
      subcontractorCount: 0,
      documents: uploadedDocuments.length > 0 ? uploadedDocuments : undefined,
      deadline: newCategoryForm.deadline || undefined,
      realizationStart: newCategoryForm.realizationStart || undefined,
      realizationEnd: newCategoryForm.realizationEnd || undefined,
    };

    onAddCategory(newCat);
    setNewCategoryForm({
      title: "",
      sodBudget: "",
      planBudget: "",
      description: "",
      deadline: "",
      realizationStart: "",
      realizationEnd: "",
    });
    setSelectedFiles([]);
    setIsAddModalOpen(false);
  };

  const handleEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onEditCategory || !editingCategory) return;

    const sod = parseFloat(newCategoryForm.sodBudget) || 0;

    // Upload documents if any new files selected
    let uploadedDocuments: DemandDocument[] = editingCategory.documents || [];
    if (selectedFiles.length > 0) {
      setUploadingFiles(true);
      try {
        const newDocs = await Promise.all(
          selectedFiles.map((file) => uploadDocument(file, editingCategory.id)),
        );
        uploadedDocuments = [...uploadedDocuments, ...newDocs];
      } catch (error) {
        console.error("Error uploading documents:", error);
        showAlert({
          title: "Chyba",
          message: "Chyba při nahrávání dokumentů. Zkuste to prosím znovu.",
          variant: "danger",
        });
        setUploadingFiles(false);
        return;
      }
      setUploadingFiles(false);
    }

    const updatedCat: DemandCategory = {
      ...editingCategory,
      title: newCategoryForm.title,
      budget:
        "~" +
        new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(
          sod,
        ) +
        " Kč",
      sodBudget: sod,
      planBudget: parseFloat(newCategoryForm.planBudget) || 0,
      description: newCategoryForm.description,
      documents: uploadedDocuments.length > 0 ? uploadedDocuments : undefined,
      deadline: newCategoryForm.deadline || undefined,
      realizationStart: newCategoryForm.realizationStart || undefined,
      realizationEnd: newCategoryForm.realizationEnd || undefined,
    };

    onEditCategory(updatedCat);
    setNewCategoryForm({
      title: "",
      sodBudget: "",
      planBudget: "",
      description: "",
      deadline: "",
      realizationStart: "",
      realizationEnd: "",
    });
    setSelectedFiles([]);
    setEditingCategory(null);
    setIsEditModalOpen(false);
  };

  // Wrapper for CategoryFormModal - Create mode
  const handleCreateCategoryFromModal = async (
    formData: CategoryFormData,
    files: File[],
  ) => {
    if (!onAddCategory) return;

    const sod = parseFloat(formData.sodBudget) || 0;
    const categoryId = `cat_${Date.now()}`;

    // Upload documents if any
    let uploadedDocuments: DemandDocument[] = [];
    if (files.length > 0) {
      try {
        uploadedDocuments = await Promise.all(
          files.map((file) => uploadDocument(file, categoryId)),
        );
      } catch (error) {
        console.error("Error uploading documents:", error);
        showAlert({
          title: "Chyba",
          message: "Chyba při nahrávání dokumentů. Zkuste to prosím znovu.",
          variant: "danger",
        });
        return;
      }
    }

    const newCat: DemandCategory = {
      id: categoryId,
      title: formData.title,
      budget:
        "~" +
        new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(
          sod,
        ) +
        " Kč",
      sodBudget: sod,
      planBudget: parseFloat(formData.planBudget) || 0,
      description: formData.description,
      status: "open",
      subcontractorCount: 0,
      documents: uploadedDocuments.length > 0 ? uploadedDocuments : undefined,
      deadline: formData.deadline || undefined,
      realizationStart: formData.realizationStart || undefined,
      realizationEnd: formData.realizationEnd || undefined,
    };

    onAddCategory(newCat);
    setIsAddModalOpen(false);
  };

  // Wrapper for CategoryFormModal - Edit mode
  const handleEditCategoryFromModal = async (
    formData: CategoryFormData,
    files: File[],
  ) => {
    if (!onEditCategory || !editingCategory) return;

    const sod = parseFloat(formData.sodBudget) || 0;

    // Upload documents if any new files selected
    let uploadedDocuments: DemandDocument[] = editingCategory.documents || [];
    if (files.length > 0) {
      try {
        const newDocs = await Promise.all(
          files.map((file) => uploadDocument(file, editingCategory.id)),
        );
        uploadedDocuments = [...uploadedDocuments, ...newDocs];
      } catch (error) {
        console.error("Error uploading documents:", error);
        showAlert({
          title: "Chyba",
          message: "Chyba při nahrávání dokumentů. Zkuste to prosím znovu.",
          variant: "danger",
        });
        return;
      }
    }

    const updatedCat: DemandCategory = {
      ...editingCategory,
      title: formData.title,
      budget:
        "~" +
        new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(
          sod,
        ) +
        " Kč",
      sodBudget: sod,
      planBudget: parseFloat(formData.planBudget) || 0,
      description: formData.description,
      documents: uploadedDocuments.length > 0 ? uploadedDocuments : undefined,
      deadline: formData.deadline || undefined,
      realizationStart: formData.realizationStart || undefined,
      realizationEnd: formData.realizationEnd || undefined,
    };

    onEditCategory(updatedCat);
    setEditingCategory(null);
    setIsEditModalOpen(false);
  };

  const handleEditCategoryClick = async (category: DemandCategory) => {
    setEditingCategory(category);
    setNewCategoryForm({
      title: category.title,
      sodBudget: category.sodBudget.toString(),
      planBudget: category.planBudget.toString(),
      description: category.description,
      deadline: category.deadline || "",
      realizationStart: category.realizationStart || "",
      realizationEnd: category.realizationEnd || "",
    });
    setSelectedFiles([]);
    setLinkedTenderPlanDates(null); // Reset before loading
    setIsEditModalOpen(true);

    // Load linked tender plan dates from database
    try {
      const { data, error } = await supabase
        .from("tender_plans")
        .select("date_from, date_to")
        .eq("project_id", projectId)
        .or(`category_id.eq.${category.id},name.ilike.${category.title}`)
        .limit(1)
        .single();

      if (!error && data) {
        setLinkedTenderPlanDates({
          dateFrom: data.date_from || "",
          dateTo: data.date_to || "",
        });
      }
    } catch (err) {
      // Silently ignore - linked plan may not exist
      console.debug("No linked tender plan found for category:", category.id);
    }
  };

  const handleToggleCategoryComplete = (category: DemandCategory) => {
    // Toggle between 'open' and 'closed' status
    const newStatus = category.status === "closed" ? "open" : "closed";
    const updatedCategory: DemandCategory = {
      ...category,
      status: newStatus,
    };
    onEditCategory?.(updatedCategory);
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (!onDeleteCategory) return;

    setConfirmModal({
      isOpen: true,
      title: "Smazat poptávku",
      message: "Opravdu chcete smazat tuto poptávku? Tato akce je nevratná.",
      onConfirm: () => {
        onDeleteCategory(categoryId);
        closeConfirmModal();
      },
    });
  };

  const handleSaveBid = async (updatedBid: Bid) => {
    if (!activeCategory) return;

    // Optimistic update
    updateBidsInternal((prev) => {
      const categoryBids = [...(prev[activeCategory.id] || [])];
      const index = categoryBids.findIndex((b) => b.id === updatedBid.id);
      if (index > -1) {
        categoryBids[index] = updatedBid;
        return { ...prev, [activeCategory.id]: categoryBids };
      }
      return prev;
    });
    setEditingBid(null);

    // Parse numeric price from display string
    const numericPrice = updatedBid.price
      ? parseFormattedNumber(updatedBid.price.replace(/[^\d\s,.-]/g, ""))
      : null;

    // Persist to Supabase or Demo Storage
    try {
      if (user?.role === "demo") {
        const demoData = getDemoData();
        if (demoData && demoData.projectDetails[projectData.id]) {
          const projectBids =
            demoData.projectDetails[projectData.id].bids || {};
          const categoryBids = projectBids[activeCategory.id] || [];
          const index = categoryBids.findIndex(
            (b: Bid) => b.id === updatedBid.id,
          );
          if (index > -1) {
            categoryBids[index] = updatedBid;
            projectBids[activeCategory.id] = categoryBids;
            demoData.projectDetails[projectData.id].bids = projectBids;
            saveDemoData(demoData);
          }
        }
        return;
      }

      const { error } = await supabase
        .from("bids")
        .update({
          contact_person: updatedBid.contactPerson,
          email: updatedBid.email,
          phone: updatedBid.phone,
          price: numericPrice && numericPrice > 0 ? numericPrice : null,
          price_display: updatedBid.price,
          price_history: updatedBid.priceHistory || null,
          notes: updatedBid.notes,
          status: updatedBid.status,
          update_date: updatedBid.updateDate || null,
          selection_round: updatedBid.selectionRound || null,
        })
        .eq("id", updatedBid.id);

      if (error) {
        console.error("Error updating bid:", error);
      }
    } catch (err) {
      console.error("Unexpected error updating bid:", err);
    }
  };

  const handleDeleteBid = async (bidId: string) => {
    if (!activeCategory) return;

    // Find bid before deletion for MCP cleanup
    const bidToDelete = (bids[activeCategory.id] || []).find(
      (b) => b.id === bidId,
    );

    // Optimistic update
    updateBidsInternal((prev) => {
      const categoryBids = (prev[activeCategory.id] || []).filter(
        (b) => b.id !== bidId,
      );
      return { ...prev, [activeCategory.id]: categoryBids };
    });

    // Delete from Supabase or Demo Storage
    try {
      if (user?.role === "demo") {
        const demoData = getDemoData();
        if (demoData && demoData.projectDetails[projectData.id]) {
          const projectBids =
            demoData.projectDetails[projectData.id].bids || {};
          projectBids[activeCategory.id] = (
            projectBids[activeCategory.id] || []
          ).filter((b: Bid) => b.id !== bidId);
          demoData.projectDetails[projectData.id].bids = projectBids;
          saveDemoData(demoData);
        }
        return;
      }

      const { error } = await supabase.from("bids").delete().eq("id", bidId);

      if (error) {
        console.error("Error deleting bid:", error);
      } else {
        // AUTO-DELETE: MCP
        if (
          bidToDelete &&
          isDocHubEnabled &&
          projectData.dochub_provider === "mcp" &&
          docHubRoot
        ) {
          const structure = resolveDocHubStructureV1(
            projectData.docHubStructureV1 || undefined,
          );
          const links = getDocHubTenderLinks(
            docHubRoot,
            activeCategory.title,
            structure,
          );
          const supplierFolder = links.supplierBase(bidToDelete.companyName);

          deleteFolder(docHubRoot, supplierFolder, { provider: "mcp" }).catch(
            (err) => {
              console.error("MCP Auto-delete supplier folder failed:", err);
            },
          );
        }
      }
    } catch (err) {
      console.error("Unexpected error deleting bid:", err);
    }
  };

  const handleCreateContactRequest = (name: string) => {
    setNewContactName(name);
    setIsCreateContactModalOpen(true);
  };

  const handleGenerateInquiry = async (bid: Bid) => {
    if (!activeCategory) return;

    // Determine mode: Desktop always uses EML for better formatting
    const isDesktopApp = platformAdapter.isDesktop;
    const userPreferredMode = user?.preferences?.emailClientMode || "mailto";
    const mode = isDesktopApp ? "eml" : userPreferredMode;

    let subject = "";
    let body = "";
    let htmlBody = ""; // used for EML mode

    const templateLink = projectDetails.inquiryLetterLink || "";

    // Determine which template to use
    let template: Template | undefined;

    if (templateLink.startsWith("template:")) {
      // A) Project has a specific template configured
      const templateId = templateLink.split(":")[1];
      template = await getTemplateById(templateId);
    } else {
      // B) No project-specific template, try to load default template
      template = await getDefaultTemplate();
    }

    if (!template) {
      showAlert({
        title: "Chyba šablony",
        message:
          "Nepodařilo se načíst šablonu emailu. Prosím zkontrolujte nastavení šablon.",
        variant: "danger",
      });
      return;
    }

    // Use template system
    subject = processTemplate(template.subject, projectDetails, activeCategory);

    if (mode === "eml") {
      // EML Mode: Process as HTML, convert newlines to <br> if needed
      const rawBody = processTemplate(
        template.content,
        projectDetails,
        activeCategory,
        "html",
      );
      // Let's assume standard templates are plain-text formatted.
      htmlBody = rawBody.replace(/\n/g, "<br>");

      // Wrap in basic HTML structure
      htmlBody = `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; color: #333;">${htmlBody}</body></html>`;
    } else {
      // Mailto Mode: Plain text
      let processedBody = processTemplate(
        template.content,
        projectDetails,
        activeCategory,
        "text",
      );

      // Cleanup HTML tags if any (legacy safety)
      body = processedBody
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ");
    }

    // Execute based on mode
    if (mode === "eml") {
      // Desktop: Open EML directly without download dialog
      if (platformAdapter.isDesktop) {
        const emlContent = generateEmlContent(
          bid.email || "",
          subject,
          htmlBody,
        );
        const filename = `Poptavka_${Date.now()}.eml`;
        console.log("[Pipeline] Opening EML on desktop:", filename);
        platformAdapter.shell.openTempFile(emlContent, filename);
      } else {
        // Web: Download EML file
        downloadEmlFile(bid.email || "", subject, htmlBody);
      }
      // Optimistic update status
      updateBidsInternal((prev) => {
        const categoryBids = [...(prev[activeCategory.id] || [])];
        const index = categoryBids.findIndex((b) => b.id === bid.id);
        if (index > -1) {
          categoryBids[index] = { ...categoryBids[index], status: "sent" };
          return { ...prev, [activeCategory.id]: categoryBids };
        }
        return prev;
      });
    } else {
      // Mailto - open in default email client
      const mailtoLink = createMailtoLink(bid.email || "", subject, body);
      console.log("[Pipeline] Sending inquiry via mailto:", mailtoLink);
      platformAdapter.shell.openExternal(mailtoLink);

      // Optimistic update status
      setTimeout(() => {
        updateBidsInternal((prev) => {
          const categoryBids = [...(prev[activeCategory.id] || [])];
          const index = categoryBids.findIndex((b) => b.id === bid.id);
          if (index > -1) {
            categoryBids[index] = { ...categoryBids[index], status: "sent" };
            return { ...prev, [activeCategory.id]: categoryBids };
          }
          return prev;
        });
      }, 100);
    }
  };

  const handleOpenSupplierDocHub = (bid: Bid) => {
    console.log("[DocHub] handleOpenSupplierDocHub called", {
      bid: bid.companyName,
      isDocHubEnabled,
      docHubRoot,
      activeCategory: activeCategory?.title,
      docHubProvider: projectData.docHubProvider,
      docHubStructure,
    });

    if (!isDocHubEnabled || !activeCategory) {
      console.warn(
        "[DocHub] Early exit: isDocHubEnabled=",
        isDocHubEnabled,
        "activeCategory=",
        activeCategory,
      );
      return;
    }

    // Explicitly force local handling for MCP/Tender Flow Desktop to avoid backend calls
    const isMcpOrLocal =
      projectData.docHubProvider === "mcp" ||
      projectData.docHubProvider === "onedrive";

    if (canUseDocHubBackend && projectData.id && !isMcpOrLocal) {
      openDocHubBackendLink({
        projectId: projectData.id,
        kind: "supplier",
        categoryId: activeCategory.id,
        categoryTitle: activeCategory.title,
        supplierId: bid.subcontractorId,
        supplierName: bid.companyName,
      });
      return;
    }

    // For desktop: use desktop-specific function that preserves diacritics
    // For web/MCP: use original function with slugified names
    const isDesktopMode =
      typeof window !== "undefined" && window.electronAPI?.platform?.isDesktop;
    console.log("[DocHub] isDesktopMode:", isDesktopMode);

    if (isDesktopMode) {
      // Desktop: Check for both standard (Raw) and strict (Underscored) folder names
      const handleDesktopPath = async () => {
        // 1. Try standard path (preserves spaces/diacritics if any)
        const supplierPath = getDocHubTenderLinksDesktop(
          docHubRoot,
          activeCategory.title,
          bid.companyName,
          projectDetails.docHubStructureV1,
        );

        if (await folderExists(supplierPath)) {
          console.log("[DocHub] Found aligned folder:", supplierPath);
          openOrCopyDocHubPath(supplierPath);
          return;
        }

        // 2. Try strict slugified path (Cloud style: spaces -> underscores)
        const strictName = slugifyDocHubSegmentStrict(bid.companyName);
        const strictPath = getDocHubTenderLinksDesktop(
          docHubRoot,
          activeCategory.title,
          strictName,
          projectDetails.docHubStructureV1,
        );

        if (await folderExists(strictPath)) {
          console.log(
            "[DocHub] Found strict (underscored) folder:",
            strictPath,
          );
          openOrCopyDocHubPath(strictPath);
          return;
        }

        // Fallback to standard if neither found explicitly (let Explorer handle error or opening parent)
        console.log(
          "[DocHub] Folder not found, attempting standard:",
          supplierPath,
        );
        openOrCopyDocHubPath(supplierPath);
      };

      handleDesktopPath();
    } else {
      const links = getDocHubTenderLinks(
        docHubRoot,
        activeCategory.title,
        docHubStructure,
      );
      openOrCopyDocHubPath(links.supplierBase(bid.companyName));
    }
  };

  const handleExport = (format: "xlsx" | "markdown" | "pdf") => {
    if (!activeCategory) return;

    const categoryBids = bids[activeCategory.id] || [];

    try {
      switch (format) {
        case "xlsx":
          exportToXLSX(activeCategory, categoryBids, projectDetails);
          break;
        case "markdown":
          exportToMarkdown(activeCategory, categoryBids, projectDetails);
          break;
        case "pdf":
          exportToPDF(activeCategory, categoryBids, projectDetails);
          break;
      }
      setIsExportMenuOpen(false);
    } catch (error) {
      console.error("Export error:", error);
      showAlert({
        title: "Chyba exportu",
        message: "Chyba při exportu. Zkuste to prosím znovu.",
        variant: "danger",
      });
    }
  };

  // Handle sending email to losers (non-winners with at least one price)
  const htmlToPlainText = (html: string) =>
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<p[^>]*>/gi, "")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<\/li>/gi, "\n")
      .replace(/<\/ul>/gi, "\n")
      .replace(/<\/ol>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  const handleEmailLosers = async () => {
    if (!activeCategory) return;

    const categoryBids = bids[activeCategory.id] || [];

    // Filter bids: not in "sod" status AND has at least one price (in price or priceHistory)
    const loserBids = categoryBids.filter((bid) => {
      // Exclude winners (SOD status)
      if (bid.status === "sod") return false;

      // Must have at least one valid price
      const hasMainPrice = bid.price && bid.price !== "?" && bid.price !== "-";
      const hasPriceHistory =
        bid.priceHistory && Object.keys(bid.priceHistory).length > 0;

      return hasMainPrice || hasPriceHistory;
    });

    if (loserBids.length === 0) {
      showAlert({
        title: "Info",
        message: "Nejsou žádní nevybráni účastníci s cenou.",
        variant: "info",
      });
      return;
    }

    // Get emails
    const emails = loserBids.filter((bid) => bid.email).map((bid) => bid.email);

    if (emails.length === 0) {
      showAlert({
        title: "Info",
        message: "Žádný z nevybraných účastníků nemá uvedený email.",
        variant: "info",
      });
      return;
    }

    let subject = `${projectDetails.title} - ${activeCategory.title} - Výsledek výběrového řízení`;
    let body =
      `Vážený obchodní partnere,\n\n` +
      `děkujeme za Vaši nabídku v rámci výběrového řízení na zakázku "${projectDetails.title}" - ${activeCategory.title}.\n\n` +
      `Po pečlivém zvážení všech nabídek jsme se rozhodli pokračovat s jiným dodavatelem.\n\n` +
      `Věříme, že budeme mít možnost spolupracovat na dalších projektech v budoucnosti.\n\n` +
      `S pozdravem`;

    const templateLink = projectDetails.losersEmailTemplateLink || "";
    if (templateLink.startsWith("template:")) {
      const templateId = templateLink.split(":")[1];
      const template = await getTemplateById(templateId);
      if (template) {
        subject = processTemplate(
          template.subject,
          projectDetails,
          activeCategory,
        );
        const processed = processTemplate(
          template.content,
          projectDetails,
          activeCategory,
        );
        body = htmlToPlainText(processed);
      }
    }

    // Open mailto with BCC to all losers
    window.location.href = `mailto:?bcc=${emails.join(
      ",",
    )}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleSaveNewContact = async (newContact: Subcontractor) => {
    // Persist to Supabase or Demo Storage FIRST
    try {
      if (user?.role === "demo") {
        const demoData = getDemoData();
        if (demoData) {
          demoData.contacts = [...demoData.contacts, newContact];
          saveDemoData(demoData);
        }
      } else {
        const { error } = await supabase.from("subcontractors").insert({
          id: newContact.id,
          company_name: newContact.company,
          contact_person_name: newContact.name,
          email: newContact.email,
          phone: newContact.phone,
          specialization: newContact.specialization,
          ico: newContact.ico,
          region: newContact.region,
          status_id: newContact.status,
        });

        if (error) {
          console.error("Error saving contact to Supabase:", error);
          throw error; // Re-throw to prevent modal close
        }
      }

      // Only update UI and close modal if save was successful
      setLocalContacts((prev) => [...prev, newContact]);
      setSelectedSubcontractorIds((prev) => new Set(prev).add(newContact.id));
      setIsCreateContactModalOpen(false);
    } catch (err) {
      console.error("Unexpected error saving contact:", err);
      // Modal stays open so user can retry
    }
  };

  const handleUpdateContact = async (updatedContact: Subcontractor) => {
    // Persist to Supabase or Demo Storage FIRST
    try {
      if (user?.role === "demo") {
        const demoData = getDemoData();
        if (demoData) {
          demoData.contacts = demoData.contacts.map((c: Subcontractor) =>
            c.id === updatedContact.id ? updatedContact : c,
          );
          saveDemoData(demoData);
        }
      } else {
        const { error } = await supabase
          .from("subcontractors")
          .update({
            company_name: updatedContact.company,
            contact_person_name: updatedContact.name,
            email: updatedContact.email,
            phone: updatedContact.phone,
            specialization: updatedContact.specialization,
            ico: updatedContact.ico,
            region: updatedContact.region,
            status_id: updatedContact.status,
          })
          .eq("id", updatedContact.id);

        if (error) {
          console.error("Error updating contact in Supabase:", error);
          throw error; // Re-throw to prevent modal close
        }
      }

      // Only update UI and close modal if update was successful
      setLocalContacts((prev) =>
        prev.map((c) => (c.id === updatedContact.id ? updatedContact : c)),
      );
      setEditingContact(null);
    } catch (err) {
      console.error("Unexpected error updating contact:", err);
      // Modal stays open so user can retry
    }
  };

  if (activeCategory) {
    // --- DETAIL VIEW (PIPELINE) ---
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        {alertModalNode}
        <Header
          title={activeCategory.title}
          subtitle={`${projectData.title} > Průběh výběrového řízení`}
          showSearch={false}
          showNotifications={false}
        >
          <button
            onClick={() => setActiveCategory(null)}
            className="mr-auto flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors px-2"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span className="text-sm font-medium">Zpět na přehled</span>
          </button>
          <button
            onClick={() => setIsSubcontractorModalOpen(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            <span>Přidat dodavatele</span>
          </button>

          {isDocHubEnabled && (
            <button
              onClick={() => {
                // For desktop: open tender/category folder directly
                const isDesktopMode =
                  typeof window !== "undefined" &&
                  window.electronAPI?.platform?.isDesktop;

                if (canUseDocHubBackend && projectData.id && !isDesktopMode) {
                  openDocHubBackendLink({
                    projectId: projectData.id,
                    kind: "tender",
                    categoryId: activeCategory.id,
                    categoryTitle: activeCategory.title,
                  });
                  return;
                }

                // Desktop: build path to tender folder from hierarchy
                if (isDesktopMode) {
                  const hierarchy = (projectDetails.docHubStructureV1 as any)
                    ?.extraHierarchy;
                  const tendersItem = hierarchy?.find(
                    (item: any) =>
                      item.key === "tenders" && item.enabled !== false,
                  );
                  const tendersFolder =
                    tendersItem?.name || "03_Vyberova_rizeni";
                  const cleanTitle = activeCategory.title
                    .replace(/[<>:"|?*]/g, "")
                    .trim();
                  const tenderPath = [
                    docHubRoot,
                    tendersFolder,
                    cleanTitle,
                  ].join("\\");
                  console.log("[DocHub] Opening tender folder:", tenderPath);
                  openOrCopyDocHubPath(tenderPath);
                } else {
                  const links = getDocHubTenderLinks(
                    docHubRoot,
                    activeCategory.title,
                    docHubStructure,
                  );
                  openOrCopyDocHubPath(links.tenderBase);
                }
              }}
              className="flex items-center gap-2 bg-violet-100 dark:bg-violet-900/30 hover:bg-violet-200 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
              title={`Otevřít složku: ${activeCategory.title}`}
            >
              <span className="material-symbols-outlined text-[20px]">
                folder_open
              </span>
              <span>Otevřít složku</span>
            </button>
          )}

          {/* Export Button with Dropdown */}
          <div className="relative">
            <button
              ref={exportButtonRef}
              onClick={() => {
                if (!isExportMenuOpen && exportButtonRef.current) {
                  const rect = exportButtonRef.current.getBoundingClientRect();
                  setMenuPosition({
                    top: rect.bottom + 8,
                    left: rect.right - 224, // w-56 = 14rem = 224px
                  });
                }
                setIsExportMenuOpen(!isExportMenuOpen);
              }}
              className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">
                download
              </span>
              <span>Export</span>
              <span className="material-symbols-outlined text-[16px]">
                expand_more
              </span>
            </button>

            {isExportMenuOpen &&
              createPortal(
                <>
                  <div
                    className="fixed inset-0 z-[9998] bg-transparent"
                    onClick={() => setIsExportMenuOpen(false)}
                  />
                  <div
                    className="fixed w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-[9999]"
                    style={{
                      top: `${menuPosition.top}px`,
                      left: `${menuPosition.left}px`,
                    }}
                  >
                    <button
                      onClick={() => handleExport("xlsx")}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left border-b border-slate-100 dark:border-slate-700"
                    >
                      <span className="material-symbols-outlined text-green-600 text-[20px]">
                        table_chart
                      </span>
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          Excel
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          .xlsx formát
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleExport("markdown")}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left border-b border-slate-100 dark:border-slate-700"
                    >
                      <span className="material-symbols-outlined text-blue-600 text-[20px]">
                        code
                      </span>
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          Markdown
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          .md formát
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleExport("pdf")}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-red-600 text-[20px]">
                        picture_as_pdf
                      </span>
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          PDF
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          .pdf formát
                        </div>
                      </div>
                    </button>
                  </div>
                </>,
                document.body,
              )}
          </div>

          {/* Email Losers Button */}
          <button
            onClick={handleEmailLosers}
            className="flex items-center gap-2 bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-300 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
            title="Odeslat email nevybraným účastníkům s cenou"
          >
            <span className="material-symbols-outlined text-[20px]">mail</span>
            <span>Email nevybraným</span>
          </button>
        </Header>

        {/* Document List Section */}
        {activeCategory.documents && activeCategory.documents.length > 0 && (
          <div className="px-6 pt-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-slate-600 dark:text-slate-400 text-[20px]">
                  folder_open
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Přiložené dokumenty
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {activeCategory.documents.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
                  >
                    <span className="material-symbols-outlined text-slate-400 text-[20px]">
                      description
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-primary">
                        {doc.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {formatFileSize(doc.size)}
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 group-hover:text-primary text-[16px]">
                      download
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
          <div className="flex h-full space-x-4 min-w-max">
            {/* 1. Oslovení (Contacted) */}
            <Column
              title="Oslovení"
              status="contacted"
              color="slate"
              count={getBidsForColumn(activeCategory.id, "contacted").length}
              onDrop={handleDrop}
            >
              {getBidsForColumn(activeCategory.id, "contacted").map((bid) => (
                <BidCard
                  key={bid.id}
                  bid={bid}
                  onDragStart={handleDragStart}
                  onEdit={setEditingBid}
                  onDelete={handleDeleteBidRequest}
                  onGenerateInquiry={handleGenerateInquiry}
                  onOpenDocHubFolder={
                    isDocHubEnabled ? handleOpenSupplierDocHub : undefined
                  }
                />
              ))}
              {getBidsForColumn(activeCategory.id, "contacted").length ===
                0 && (
                <div className="text-center p-4 text-slate-400 text-sm italic">
                  Žádní dodavatelé v této fázi
                </div>
              )}
            </Column>

            {/* 2. Odesláno (Sent) */}
            <Column
              title="Odesláno"
              status="sent"
              color="blue"
              count={getBidsForColumn(activeCategory.id, "sent").length}
              onDrop={handleDrop}
            >
              {getBidsForColumn(activeCategory.id, "sent").map((bid) => (
                <BidCard
                  key={bid.id}
                  bid={bid}
                  onDragStart={handleDragStart}
                  onEdit={setEditingBid}
                  onDelete={handleDeleteBidRequest}
                  onOpenDocHubFolder={
                    isDocHubEnabled ? handleOpenSupplierDocHub : undefined
                  }
                />
              ))}
              {getBidsForColumn(activeCategory.id, "sent").length === 0 && (
                <div className="text-center p-4 text-slate-400 text-sm italic">
                  Žádní dodavatelé v této fázi
                </div>
              )}
            </Column>

            {/* 3. Cenová nabídka (Offers) */}
            <Column
              title="Cenová nabídka"
              status="offer"
              color="amber"
              count={getBidsForColumn(activeCategory.id, "offer").length}
              onDrop={handleDrop}
            >
              {getBidsForColumn(activeCategory.id, "offer").map((bid) => (
                <BidCard
                  key={bid.id}
                  bid={bid}
                  onDragStart={handleDragStart}
                  onEdit={setEditingBid}
                  onDelete={handleDeleteBidRequest}
                  onOpenDocHubFolder={
                    isDocHubEnabled ? handleOpenSupplierDocHub : undefined
                  }
                />
              ))}
            </Column>

            {/* 4. Užší výběr (Shortlist) */}
            <Column
              title="Užší výběr"
              status="shortlist"
              color="blue"
              count={getBidsForColumn(activeCategory.id, "shortlist").length}
              onDrop={handleDrop}
            >
              {getBidsForColumn(activeCategory.id, "shortlist").map((bid) => (
                <BidCard
                  key={bid.id}
                  bid={bid}
                  onDragStart={handleDragStart}
                  onEdit={setEditingBid}
                  onDelete={handleDeleteBidRequest}
                  onOpenDocHubFolder={
                    isDocHubEnabled ? handleOpenSupplierDocHub : undefined
                  }
                />
              ))}
            </Column>

            {/* 5. Jednání o SOD (Contract Negotiation) */}
            <Column
              title="Jednání o SOD"
              status="sod"
              color="green"
              count={getBidsForColumn(activeCategory.id, "sod").length}
              onDrop={handleDrop}
            >
              {getBidsForColumn(activeCategory.id, "sod").map((bid) => (
                <div key={bid.id} className="relative">
                  {/* Trophy icon */}
                  <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 rounded-full p-1 z-10 shadow-sm pointer-events-none">
                    <span className="material-symbols-outlined text-[16px] block">
                      trophy
                    </span>
                  </div>
                  {/* Contract icon - clickable */}
                  <button
                    onClick={() => handleToggleContracted(bid)}
                    className={`absolute -top-2 right-6 rounded-full p-1 z-10 shadow-sm transition-all hover:scale-110 ${
                      bid.contracted
                        ? "bg-yellow-400 text-yellow-900 ring-2 ring-yellow-300 animate-pulse"
                        : "bg-slate-600 text-slate-300 hover:bg-slate-500"
                    }`}
                    title={
                      bid.contracted
                        ? "Zasmluvněno ✓"
                        : "Označit jako zasmluvněno"
                    }
                  >
                    <span className="material-symbols-outlined text-[16px] block">
                      {bid.contracted ? "task_alt" : "description"}
                    </span>
                  </button>
                  <BidCard
                    bid={bid}
                    onDragStart={handleDragStart}
                    onEdit={setEditingBid}
                    onDelete={handleDeleteBid}
                    onOpenDocHubFolder={
                      isDocHubEnabled ? handleOpenSupplierDocHub : undefined
                    }
                  />
                </div>
              ))}
            </Column>

            {/* 6. Zamítnuto (Rejected) */}
            <Column
              title="Zamítnuto / Odstoupili"
              status="rejected"
              color="red"
              onDrop={handleDrop}
            >
              {getBidsForColumn(activeCategory.id, "rejected").map((bid) => (
                <BidCard
                  key={bid.id}
                  bid={bid}
                  onDragStart={handleDragStart}
                  onEdit={setEditingBid}
                  onDelete={handleDeleteBid}
                  onOpenDocHubFolder={
                    isDocHubEnabled ? handleOpenSupplierDocHub : undefined
                  }
                />
              ))}
            </Column>
          </div>
        </div>

        <SubcontractorSelectorModal
          isOpen={isSubcontractorModalOpen}
          isMaximized={isSubcontractorModalMaximized}
          contacts={localContacts}
          statuses={DEFAULT_STATUSES}
          selectedIds={selectedSubcontractorIds}
          onSelectionChange={setSelectedSubcontractorIds}
          onToggleMaximize={() =>
            setIsSubcontractorModalMaximized(!isSubcontractorModalMaximized)
          }
          onClose={() => setIsSubcontractorModalOpen(false)}
          onConfirm={handleAddSubcontractors}
          onAddContact={handleCreateContactRequest}
          onEditContact={setEditingContact}
        />
        {(isCreateContactModalOpen || editingContact) && (
          <CreateContactModal
            initialName={newContactName}
            initialData={editingContact || undefined}
            existingSpecializations={Array.from(
              new Set(localContacts.flatMap((c) => c.specialization)),
            ).sort()}
            statuses={externalStatuses}
            onClose={() => {
              setIsCreateContactModalOpen(false);
              setEditingContact(null);
            }}
            onSave={editingContact ? handleUpdateContact : handleSaveNewContact}
          />
        )}

        {/* Edit Bid Modal */}
        {editingBid && (
          <EditBidModal
            bid={editingBid}
            onClose={() => setEditingBid(null)}
            onSave={handleSaveBid}
          />
        )}

        {/* Confirmation Modal - Shared */}
        <ConfirmationModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={closeConfirmModal}
          confirmLabel="Odstranit"
          variant="danger"
        />
      </div>
    );
  }

  // --- LIST VIEW (OVERVIEW) ---
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 min-h-screen">
      {alertModalNode}
      <PipelineOverview
        categories={projectData.categories}
        bids={bids}
        searchQuery={searchQuery}
        demandFilter={demandFilter}
        viewMode={viewMode}
        onFilterChange={setDemandFilter}
        onViewModeChange={setViewMode}
        onCategoryClick={setActiveCategory}
        onAddClick={() => setIsAddModalOpen(true)}
        onEditCategory={handleEditCategoryClick}
        onDeleteCategory={handleDeleteCategory}
        onToggleCategoryComplete={handleToggleCategoryComplete}
      />

      {/* Create Category Modal */}
      <CategoryFormModal
        isOpen={isAddModalOpen}
        mode="create"
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreateCategoryFromModal}
      />

      {/* Edit Category Modal */}
      <CategoryFormModal
        isOpen={isEditModalOpen}
        mode="edit"
        initialData={editingCategory || undefined}
        existingDocuments={editingCategory?.documents}
        linkedTenderPlanDates={linkedTenderPlanDates}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingCategory(null);
          setLinkedTenderPlanDates(null);
        }}
        onSubmit={handleEditCategoryFromModal}
      />
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
        confirmLabel="Odstranit"
        variant="danger"
      />
    </div>
  );
};
