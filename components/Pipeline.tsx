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
import { supabase } from "../services/supabase";
import { invokeAuthedFunction } from "../services/functionsClient";
import { uploadDocument, formatFileSize } from "../services/documentService";
import {
  generateInquiryEmail,
  createMailtoLink,
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
import { getTemplateById } from "../services/templateService";
import { processTemplate } from "../utils/templateUtils";
import { useAuth } from "../context/AuthContext";
import { getDemoData, saveDemoData } from "../services/demoData";
import { getDocHubTenderLinks, isProbablyUrl, resolveDocHubStructureV1 } from "../utils/docHub";
import { DEFAULT_STATUSES } from "../config/constants";
import {
  Column,
  BidCard,
  EditBidModal,
  CategoryCard,
  CreateContactModal,
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
  searchQuery?: string;
  initialOpenCategoryId?: string;
}

type PipelineViewMode = 'grid' | 'table';

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
  searchQuery = '',
  initialOpenCategoryId,
}) => {
  const { user } = useAuth();
  const projectData = projectDetails;
  const docHubRoot = projectDetails.docHubRootLink?.trim() || "";
  const isDocHubEnabled = !!projectDetails.docHubEnabled && docHubRoot.length > 0;
  const docHubStructure = resolveDocHubStructureV1(projectDetails.docHubStructureV1 || undefined);
  const canUseDocHubBackend =
    !!projectDetails.docHubProvider &&
    !!projectDetails.docHubRootId &&
    projectDetails.docHubStatus === "connected";

  const [docHubUiModal, setDocHubUiModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: "danger" | "info" | "success";
  }>({ isOpen: false, title: "", message: "", variant: "info" });

  const showDocHubModal = (args: {
    title: string;
    message: string;
    variant?: "danger" | "info" | "success";
  }) => {
    setDocHubUiModal({
      isOpen: true,
      title: args.title,
      message: args.message,
      variant: args.variant ?? "info",
    });
  };

  const docHubModalNode = (
    <ConfirmationModal
      isOpen={docHubUiModal.isOpen}
      title={docHubUiModal.title}
      message={docHubUiModal.message}
      variant={docHubUiModal.variant}
      confirmLabel="OK"
      onConfirm={() => setDocHubUiModal((prev) => ({ ...prev, isOpen: false }))}
    />
  );

  const openOrCopyDocHubPath = async (path: string) => {
    if (!path) return;
    if (isProbablyUrl(path)) {
      window.open(path, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      await navigator.clipboard.writeText(path);
      showDocHubModal({ title: "Zkopírováno", message: path, variant: "success" });
    } catch {
      window.prompt("Zkopírujte cestu:", path);
    }
  };

  const openDocHubBackendLink = async (payload: any) => {
    try {
      const data = await invokeAuthedFunction<any>("dochub-get-link", { body: payload });
      const webUrl = (data as any)?.webUrl as string | undefined;
      if (!webUrl) throw new Error("Backend nevrátil webUrl");
      window.open(webUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Neznámá chyba";
      showDocHubModal({ title: "DocHub chyba", message, variant: "danger" });
    }
  };

  const [activeCategory, setActiveCategory] = useState<DemandCategory | null>(
    null
  );
  const [demandFilter, setDemandFilter] = useState<'all' | 'open' | 'closed' | 'sod'>('all');
  const PIPELINE_VIEW_MODE_STORAGE_KEY = 'tender_pipeline_view_mode';
  const [viewMode, setViewMode] = useState<PipelineViewMode>(() => {
    const stored = localStorage.getItem(PIPELINE_VIEW_MODE_STORAGE_KEY);
    return stored === 'table' || stored === 'grid' ? stored : 'grid';
  });
  const [bids, setBids] = useState<Record<string, Bid[]>>(initialBids);
  // const [contacts, setContacts] = useState<Subcontractor[]>(ALL_CONTACTS); // Use prop directly or state if we modify it locally?
  // The component modifies contacts (adding new ones). So we might need state, but initialized from prop.
  // However, App.tsx manages contacts. Ideally we should call a handler to add contact in App.tsx.
  // For now, let's keep local state initialized from prop to minimize refactor,
  // BUT we need to sync back or just rely on the fact that we insert to Supabase and App.tsx might reload?
  // App.tsx doesn't auto-reload contacts on change in child.
  // Let's use a local state initialized from prop for now.
  const [localContacts, setLocalContacts] = useState<Subcontractor[]>(externalContacts);

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
  const updateBidsInternal = (updater: (prev: Record<string, Bid[]>) => Record<string, Bid[]>) => {
    isInternalBidsChange.current = true;
    setBids(prev => {
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
    null
  );
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

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleDeleteBidRequest = (bidId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Odstranit nabídku',
      message: 'Opravdu chcete odebrat tohoto dodavatele z výběrového řízení? Tato akce je nevratná.',
      onConfirm: () => {
        handleDeleteBid(bidId);
        closeConfirmModal();
      }
    });
  };

  // Reset active category when switching projects, unless we have an initial category to open
  useEffect(() => {
    if (initialOpenCategoryId) {
      const categoryToOpen = projectDetails.categories.find(c => c.id === initialOpenCategoryId);
      if (categoryToOpen) {
        setActiveCategory(categoryToOpen);
        // Scroll to view if needed? For now just opening the modal/view is enough.
      }
    } else {
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
        if (user?.role === 'demo') {
          const demoData = getDemoData();
          if (demoData && demoData.projectDetails[projectData.id]) {
            const projectBids = demoData.projectDetails[projectData.id].bids || {};
            // Find which category this bid belongs to
            let categoryId = "";
            for (const [catId, catBids] of Object.entries(projectBids)) {
              if ((catBids as Bid[]).some(b => b.id === bidId)) {
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
          contracted: newContracted
        };
        return { ...prev, [activeCategory.id]: categoryBids };
      }
      return prev;
    });

    // Persist to Supabase or Demo Storage
    try {
      if (user?.role === 'demo') {
        const demoData = getDemoData();
        if (demoData && demoData.projectDetails[projectData.id]) {
          const projectBids = demoData.projectDetails[projectData.id].bids || {};
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
          (b) => b.subcontractorId === contact.id
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
        if (user?.role === 'demo') {
          const demoData = getDemoData();
          if (demoData && demoData.projectDetails[projectData.id]) {
            const projectBids = demoData.projectDetails[projectData.id].bids || {};
            projectBids[activeCategory.id] = [
              ...(projectBids[activeCategory.id] || []),
              ...newBids
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

        console.log("🔵 Attempting to insert bids:", JSON.stringify(bidsToInsert, null, 2));

        const { data, error } = await supabase.from("bids").insert(bidsToInsert).select();

        if (error) {
          console.error("🔴 Error inserting bids:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            fullError: JSON.stringify(error, null, 2)
          });
          alert(`Chyba při ukládání nabídek: ${error.message}\n\nKód: ${error.code}\nDetail: ${error.details || 'N/A'}\nHint: ${error.hint || 'N/A'}`);
        } else {
          console.log("🟢 Successfully inserted bids:", data);
        }
      } catch (err) {
        console.error("🔴 Unexpected error inserting bids:", err);
        alert(`Neočekávaná chyba: ${err}`);
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
          selectedFiles.map((file) => uploadDocument(file, categoryId))
        );
      } catch (error) {
        console.error("Error uploading documents:", error);
        alert("Chyba při nahrávání dokumentů. Zkuste to prosím znovu.");
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
          sod
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
          selectedFiles.map((file) => uploadDocument(file, editingCategory.id))
        );
        uploadedDocuments = [...uploadedDocuments, ...newDocs];
      } catch (error) {
        console.error("Error uploading documents:", error);
        alert("Chyba při nahrávání dokumentů. Zkuste to prosím znovu.");
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
          sod
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

  const handleEditCategoryClick = (category: DemandCategory) => {
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
    setIsEditModalOpen(true);
  };

  const handleToggleCategoryComplete = (category: DemandCategory) => {
    // Toggle between 'open' and 'closed' status
    const newStatus = category.status === 'closed' ? 'open' : 'closed';
    const updatedCategory: DemandCategory = {
      ...category,
      status: newStatus
    };
    onEditCategory?.(updatedCategory);
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (!onDeleteCategory) return;

    setConfirmModal({
      isOpen: true,
      title: 'Smazat poptávku',
      message: 'Opravdu chcete smazat tuto poptávku? Tato akce je nevratná.',
      onConfirm: () => {
        onDeleteCategory(categoryId);
        closeConfirmModal();
      }
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
      ? parseFormattedNumber(updatedBid.price.replace(/[^\d\s,.-]/g, ''))
      : null;

    // Persist to Supabase or Demo Storage
    try {
      if (user?.role === 'demo') {
        const demoData = getDemoData();
        if (demoData && demoData.projectDetails[projectData.id]) {
          const projectBids = demoData.projectDetails[projectData.id].bids || {};
          const categoryBids = projectBids[activeCategory.id] || [];
          const index = categoryBids.findIndex((b: Bid) => b.id === updatedBid.id);
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
        .from('bids')
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
          selection_round: updatedBid.selectionRound || null
        })
        .eq('id', updatedBid.id);

      if (error) {
        console.error('Error updating bid:', error);
      }
    } catch (err) {
      console.error('Unexpected error updating bid:', err);
    }
  };

  const handleDeleteBid = async (bidId: string) => {
    if (!activeCategory) return;

    // Optimistic update
    updateBidsInternal((prev) => {
      const categoryBids = (prev[activeCategory.id] || []).filter(b => b.id !== bidId);
      return { ...prev, [activeCategory.id]: categoryBids };
    });

    // Delete from Supabase or Demo Storage
    try {
      if (user?.role === 'demo') {
        const demoData = getDemoData();
        if (demoData && demoData.projectDetails[projectData.id]) {
          const projectBids = demoData.projectDetails[projectData.id].bids || {};
          projectBids[activeCategory.id] = (projectBids[activeCategory.id] || []).filter((b: Bid) => b.id !== bidId);
          demoData.projectDetails[projectData.id].bids = projectBids;
          saveDemoData(demoData);
        }
        return;
      }

      const { error } = await supabase
        .from('bids')
        .delete()
        .eq('id', bidId);

      if (error) {
        console.error('Error deleting bid:', error);
      }
    } catch (err) {
      console.error('Unexpected error deleting bid:', err);
    }
  };

  const handleCreateContactRequest = (name: string) => {
    setNewContactName(name);
    setIsCreateContactModalOpen(true);
  };

  const handleGenerateInquiry = async (bid: Bid) => {
    if (!activeCategory) return;

    let subject = "";
    let body = "";

    const templateLink = projectDetails.inquiryLetterLink || "";

    // Check if using new template system
    if (templateLink.startsWith('template:')) {
      const templateId = templateLink.split(':')[1];
      const template = await getTemplateById(templateId);

      if (template) {
        // Prepare data for template
        // We pass 'bid' related info indirectly via dummy or generic if needed, 
        // but TemplateUtils currently supports Project and Category. 
        // We might want to extend it to support Bid info later (e.g. {OSLOVENI}, {FIRMA}),
        // but for now the user asked to connect it.
        // NOTE: processTemplate now takes project and category.
        // Let's create a combined data object if we want to support bid details later?
        // actually looking at templateUtils, it works with ProjectDetails and DemandCategory.

        // We should add bid info to template if we want to be perfect, but for now let's just use what we have.
        // Actually I should check if processTemplate generates the BODY directly or if we need to wrap it.
        // Content IS the body.

        // We need to HTML-to-Text for mailto body if possible, OR just put HTML. 
        // Mailto only supports plain text. We must strip HTML or just use newlines.
        // The user put HTML in the template editor. 
        // A simple strip-tags or replacement of <br> with %0D%0A is needed for mailto.

        let rawSubject = template.subject;
        let rawContent = template.content;

        // Process variables
        subject = processTemplate(rawSubject, projectDetails, activeCategory);

        // For body, we need to be careful. Mailto doesn't support HTML.
        // We will try to convert basic HTML to text.
        // <br> -> \n
        // <b>, <i> -> remove tags
        let processedBody = processTemplate(rawContent, projectDetails, activeCategory);

        // Simple HTML to Text conversion for Mailto
        body = processedBody
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '') // Strip other tags
          .replace(/&nbsp;/g, ' ');

      } else {
        // Template not found fallback
        const result = generateInquiryEmail(activeCategory, projectDetails, bid);
        subject = result.subject;
        body = result.body;
      }
    } else {
      // Legacy way
      const result = generateInquiryEmail(activeCategory, projectDetails, bid);
      subject = result.subject;
      body = result.body;
    }

    // Create mailto link
    const mailtoLink = createMailtoLink(bid.email || "", subject, body);

    // Open email client
    window.location.href = mailtoLink;

    // Move bid to 'sent' status
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
  };

  const handleOpenSupplierDocHub = (bid: Bid) => {
    if (!isDocHubEnabled || !activeCategory) return;
    if (canUseDocHubBackend && projectData.id) {
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
    const links = getDocHubTenderLinks(docHubRoot, activeCategory.title, docHubStructure);
    openOrCopyDocHubPath(links.supplierBase(bid.companyName));
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
      alert("Chyba při exportu. Zkuste to prosím znovu.");
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
    const loserBids = categoryBids.filter(bid => {
      // Exclude winners (SOD status)
      if (bid.status === 'sod') return false;

      // Must have at least one valid price
      const hasMainPrice = bid.price && bid.price !== '?' && bid.price !== '-';
      const hasPriceHistory = bid.priceHistory && Object.keys(bid.priceHistory).length > 0;

      return hasMainPrice || hasPriceHistory;
    });

    if (loserBids.length === 0) {
      alert('Nejsou žádní nevybráni účastníci s cenou.');
      return;
    }

    // Get emails
    const emails = loserBids
      .filter(bid => bid.email)
      .map(bid => bid.email);

    if (emails.length === 0) {
      alert('Žádný z nevybraných účastníků nemá uvedený email.');
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
        subject = processTemplate(template.subject, projectDetails, activeCategory);
        const processed = processTemplate(template.content, projectDetails, activeCategory);
        body = htmlToPlainText(processed);
      }
    }

    // Open mailto with BCC to all losers
    window.location.href = `mailto:?bcc=${emails.join(',')}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleSaveNewContact = async (newContact: Subcontractor) => {
    // Optimistic update
    setLocalContacts((prev) => [...prev, newContact]);
    setSelectedSubcontractorIds((prev) => new Set(prev).add(newContact.id));
    setIsCreateContactModalOpen(false);

    // Persist to Supabase or Demo Storage
    try {
      if (user?.role === 'demo') {
        const demoData = getDemoData();
        if (demoData) {
          demoData.contacts = [...demoData.contacts, newContact];
          saveDemoData(demoData);
        }
        return;
      }

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
        // Optionally revert state or show notification
      }
    } catch (err) {
      console.error("Unexpected error saving contact:", err);
    }
  };

  if (activeCategory) {
    // --- DETAIL VIEW (PIPELINE) ---
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        {docHubModalNode}
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
                if (canUseDocHubBackend && projectData.id) {
                  openDocHubBackendLink({
                    projectId: projectData.id,
                    kind: "tender_inquiries",
                    categoryId: activeCategory.id,
                    categoryTitle: activeCategory.title,
                  });
                  return;
                }
                const links = getDocHubTenderLinks(docHubRoot, activeCategory.title, docHubStructure);
                openOrCopyDocHubPath(links.inquiriesBase);
              }}
              className="flex items-center gap-2 bg-violet-100 dark:bg-violet-900/30 hover:bg-violet-200 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
              title={`DocHub: /${docHubStructure.tenders}/${activeCategory.title}/${docHubStructure.tendersInquiries}`}
            >
              <span className="material-symbols-outlined text-[20px]">
                folder_open
              </span>
              <span>DocHub</span>
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
                document.body
              )}
          </div>

          {/* Email Losers Button */}
          <button
            onClick={handleEmailLosers}
            className="flex items-center gap-2 bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-300 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
            title="Odeslat email nevybraným účastníkům s cenou"
          >
            <span className="material-symbols-outlined text-[20px]">
              mail
            </span>
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
                  onOpenDocHubFolder={isDocHubEnabled ? handleOpenSupplierDocHub : undefined}
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
                  onOpenDocHubFolder={isDocHubEnabled ? handleOpenSupplierDocHub : undefined}
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
                  onOpenDocHubFolder={isDocHubEnabled ? handleOpenSupplierDocHub : undefined}
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
                  onOpenDocHubFolder={isDocHubEnabled ? handleOpenSupplierDocHub : undefined}
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
                    className={`absolute -top-2 right-6 rounded-full p-1 z-10 shadow-sm transition-all hover:scale-110 ${bid.contracted
                      ? 'bg-yellow-400 text-yellow-900 ring-2 ring-yellow-300 animate-pulse'
                      : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                      }`}
                    title={bid.contracted ? 'Zasmluvněno ✓' : 'Označit jako zasmluvněno'}
                  >
                    <span className="material-symbols-outlined text-[16px] block">
                      {bid.contracted ? 'task_alt' : 'description'}
                    </span>
                  </button>
                  <BidCard
                    bid={bid}
                    onDragStart={handleDragStart}
                    onEdit={setEditingBid}
                    onDelete={handleDeleteBid}
                    onOpenDocHubFolder={isDocHubEnabled ? handleOpenSupplierDocHub : undefined}
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
                  onOpenDocHubFolder={isDocHubEnabled ? handleOpenSupplierDocHub : undefined}
                />
              ))}
            </Column>
          </div>
        </div>

        {isSubcontractorModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div
              className={`bg-white dark:bg-slate-900 shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col transition-all duration-200 ${isSubcontractorModalMaximized
                ? "fixed inset-0 rounded-none w-full h-full"
                : "rounded-2xl max-w-4xl w-full h-[80vh]"
                }`}
            >
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Vybrat subdodavatele
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setIsSubcontractorModalMaximized(
                        !isSubcontractorModalMaximized
                      )
                    }
                    className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title={
                      isSubcontractorModalMaximized
                        ? "Obnovit velikost"
                        : "Zvětšit na celou obrazovku"
                    }
                  >
                    <span className="material-symbols-outlined">
                      {isSubcontractorModalMaximized
                        ? "close_fullscreen"
                        : "fullscreen"}
                    </span>
                  </button>
                  <button
                    onClick={() => setIsSubcontractorModalOpen(false)}
                    className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden p-6 flex flex-col min-h-0">
                <SubcontractorSelector
                  contacts={localContacts}
                  statuses={DEFAULT_STATUSES}
                  selectedIds={selectedSubcontractorIds}
                  onSelectionChange={setSelectedSubcontractorIds}
                  onAddContact={handleCreateContactRequest}
                  className="flex-1 min-h-0"
                />
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                <div className="text-sm text-slate-500">
                  Vybráno:{" "}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedSubcontractorIds.size}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsSubcontractorModalOpen(false)}
                    className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Zrušit
                  </button>
                  <button
                    onClick={handleAddSubcontractors}
                    disabled={selectedSubcontractorIds.size === 0}
                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Přenést do pipeline
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Contact Modal */}
        {isCreateContactModalOpen && (
          <CreateContactModal
            initialName={newContactName}
            existingSpecializations={Array.from(new Set(localContacts.flatMap(c => c.specialization))).sort()}
            statuses={externalStatuses}
            onClose={() => setIsCreateContactModalOpen(false)}
            onSave={handleSaveNewContact}
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
      </div>
    );
  }

  // --- LIST VIEW (OVERVIEW) ---
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 min-h-screen">
      {docHubModalNode}
      <div className="p-6 lg:p-10 overflow-y-auto">
        {/* Filter Buttons and Add Button */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-300 dark:border-slate-700/50">
            <button
              onClick={() => setDemandFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${demandFilter === 'all'
                ? 'bg-primary text-white shadow'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-800'
                }`}
            >
              Všechny ({projectData.categories.length})
            </button>
            <button
              onClick={() => setDemandFilter('open')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${demandFilter === 'open'
                ? 'bg-amber-500 dark:bg-amber-500/20 text-white dark:text-amber-300 border border-amber-500 dark:border-amber-500/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-800'
                }`}
            >
              Poptávané ({projectData.categories.filter(c => c.status === 'open' || c.status === 'negotiating').length})
            </button>
            <button
              onClick={() => setDemandFilter('closed')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${demandFilter === 'closed'
                ? 'bg-teal-500 dark:bg-teal-500/20 text-white dark:text-teal-300 border border-teal-500 dark:border-teal-500/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-800'
                }`}
            >
              Ukončené ({projectData.categories.filter(c => c.status === 'closed').length})
            </button>
            <button
              onClick={() => setDemandFilter('sod')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${demandFilter === 'sod'
                ? 'bg-emerald-500 dark:bg-emerald-500/20 text-white dark:text-emerald-300 border border-emerald-500 dark:border-emerald-500/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-800'
                }`}
            >
              Zasmluvněné ({projectData.categories.filter(c => {
                if (c.status === 'sod') return true;
                if (c.status === 'closed') {
                  const sodBids = (bids[c.id] || []).filter(b => b.status === 'sod');
                  return sodBids.length > 0 && sodBids.every(b => b.contracted);
                }
                return false;
              }).length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-300 dark:border-slate-700/50">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-2 text-xs font-semibold rounded-lg transition-all ${viewMode === 'grid'
                  ? 'bg-primary text-white shadow'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-800'
                  }`}
                title="Zobrazení: Karty (Grid)"
                aria-label="Zobrazení: Karty (Grid)"
              >
                <span className="material-symbols-outlined text-[18px] leading-none">grid_view</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-2 text-xs font-semibold rounded-lg transition-all ${viewMode === 'table'
                  ? 'bg-primary text-white shadow'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-800'
                  }`}
                title="Zobrazení: Tabulka"
                aria-label="Zobrazení: Tabulka"
              >
                <span className="material-symbols-outlined text-[18px] leading-none">table_rows</span>
              </button>
            </div>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">
                add_home_work
              </span>
              <span className="hidden sm:inline">Nová Poptávka</span>
            </button>
          </div>
        </div>

        {(() => {
          const filteredCategories = [...projectData.categories]
            .sort((a, b) => a.title.localeCompare(b.title, 'cs'))
            .filter((cat) => {
              // First apply status filter
              if (demandFilter === 'all') {
                // continue
              } else if (demandFilter === 'open') {
                if (cat.status !== 'open' && cat.status !== 'negotiating') return false;
              } else if (demandFilter === 'closed') {
                if (cat.status !== 'closed') return false;
              } else if (demandFilter === 'sod') {
                // SOD filter includes:
                // 1. Explicit 'sod' status
                // 2. 'closed' status IF fully contracted (all winning bids have contracts)
                if (cat.status === 'sod') {
                  // continue
                } else if (cat.status === 'closed') {
                  const catBids = bids[cat.id] || [];
                  const sodBids = catBids.filter((b) => b.status === 'sod');
                  const contractedCount = sodBids.filter((b) => b.contracted).length;
                  if (sodBids.length === 0 || sodBids.length !== contractedCount) return false;
                } else {
                  return false;
                }
              }

              // Then apply search query filter
              if (searchQuery && searchQuery.trim() !== '') {
                const query = searchQuery.toLowerCase();
                const catBids = bids[cat.id] || [];
                const companyNames = catBids.map((b) => b.companyName).join(' ').toLowerCase();
                const matches =
                  cat.title.toLowerCase().includes(query) ||
                  cat.description?.toLowerCase().includes(query) ||
                  companyNames.includes(query);
                if (!matches) return false;
              }

              return true;
            });

          const getCategoryStats = (categoryId: string) => {
            const categoryBids = bids[categoryId] || [];
            const bidCount = categoryBids.length;
            const priceOfferCount = categoryBids.filter((b) => b.price && b.price !== '?' && b.price.trim() !== '').length;
            const sodBids = categoryBids.filter((b) => b.status === 'sod');
            const sodBidsCount = sodBids.length;
            const contractedCount = sodBids.filter((b) => b.contracted).length;
            const winningPrice = sodBids.reduce((sum, bid) => {
              const numericPrice = typeof bid.price === 'string' ? parseFloat(bid.price.replace(/[^\d]/g, '')) : 0;
              return sum + (isNaN(numericPrice) ? 0 : numericPrice);
            }, 0);
            return { bidCount, priceOfferCount, sodBidsCount, contractedCount, winningPrice: winningPrice > 0 ? winningPrice : undefined };
          };

          const statusLabels: Record<string, string> = {
            open: 'Poptávání',
            negotiating: 'Vyjednávání',
            closed: 'Uzavřeno',
            sod: 'V realizaci',
          };
          const statusClass: Record<string, string> = {
            open: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
            negotiating: 'bg-amber-500/10 text-amber-300 border border-amber-500/20',
            closed: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
            sod: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
          };
          const getNormalizedStatus = (raw: DemandCategory['status']) =>
            raw === 'sod' ? 'sod' : raw === 'closed' ? 'closed' : raw === 'negotiating' ? 'negotiating' : 'open';

          if (viewMode === 'table') {
            return (
              <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-[900px] w-full text-sm">
                    <thead className="bg-slate-100 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-700/40">
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <th className="px-4 py-3">Stav</th>
                        <th className="px-4 py-3">Poptávka</th>
                        <th className="px-4 py-3">Termín</th>
                        <th className="px-4 py-3">Realizace</th>
                        <th className="px-4 py-3 text-right">Cena</th>
                        <th className="px-4 py-3 text-right">Poptáno</th>
                        <th className="px-4 py-3 text-right">CN</th>
                        <th className="px-4 py-3 text-right">Smlouvy</th>
                        <th className="px-4 py-3 text-right">Akce</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700/40">
                      {filteredCategories.map((category) => {
                        const stats = getCategoryStats(category.id);
                        const normalizedStatus = getNormalizedStatus(category.status);
                        const deadline = category.deadline ? new Date(category.deadline).toLocaleDateString('cs-CZ') : '—';
                        const realization =
                          category.realizationStart || category.realizationEnd
                            ? `${category.realizationStart ? new Date(category.realizationStart).toLocaleDateString('cs-CZ') : '?'} – ${category.realizationEnd ? new Date(category.realizationEnd).toLocaleDateString('cs-CZ') : '?'}`
                            : '—';
                        const priceValue = stats.winningPrice ?? category.sodBudget;
                        const price = formatMoney(priceValue);
                        return (
                          <tr
                            key={category.id}
                            className="hover:bg-slate-50 dark:hover:bg-slate-950/30 cursor-pointer"
                            onClick={() => setActiveCategory(category)}
                          >
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${statusClass[normalizedStatus]}`}>
                                {statusLabels[normalizedStatus]}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-900 dark:text-white">{category.title}</div>
                              {category.description && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{category.description}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{deadline}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{realization}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">{price}</td>
                            <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">{stats.bidCount}</td>
                            <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">{stats.priceOfferCount}</td>
                            <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                              {stats.sodBidsCount > 0 ? `${stats.contractedCount}/${stats.sodBidsCount}` : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2">
                                {handleToggleCategoryComplete && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleCategoryComplete(category);
                                    }}
                                    className={`p-2 rounded-lg transition-colors ${category.status === 'closed'
                                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                                      : 'bg-slate-200/70 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                                      }`}
                                    title={category.status === 'closed' ? 'Označit jako otevřenou' : 'Označit jako ukončenou'}
                                  >
                                    <span className="material-symbols-outlined text-[18px]">
                                      {category.status === 'closed' ? 'check_circle' : 'task_alt'}
                                    </span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditCategoryClick(category);
                                  }}
                                  className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors"
                                  title="Upravit"
                                >
                                  <span className="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCategory(category.id);
                                  }}
                                  className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                                  title="Smazat"
                                >
                                  <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredCategories.map((category) => {
                const stats = getCategoryStats(category.id);
                const categoryWithPrice = { ...category, winningPrice: stats.winningPrice };
                return (
                  <CategoryCard
                    key={category.id}
                    category={categoryWithPrice}
                    bidCount={stats.bidCount}
                    priceOfferCount={stats.priceOfferCount}
                    contractedCount={stats.contractedCount}
                    sodBidsCount={stats.sodBidsCount}
                    onClick={() => setActiveCategory(category)}
                    onEdit={handleEditCategoryClick}
                    onDelete={handleDeleteCategory}
                    onToggleComplete={handleToggleCategoryComplete}
                  />
                );
              })}

              {/* Add New Placeholder */}
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex flex-col items-center justify-center text-center bg-white dark:bg-slate-900/60 border-2 border-dashed border-primary dark:border-slate-700/40 rounded-2xl p-5 hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-900/70 dark:hover:border-emerald-500/30 transition-all min-h-[200px] group"
              >
                <div className="size-12 rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-primary/10 dark:group-hover:bg-emerald-500/20 transition-all">
                  <span className="material-symbols-outlined text-slate-400 dark:text-slate-400 group-hover:text-primary dark:group-hover:text-emerald-400">
                    add
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                  Vytvořit novou sekci
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Např. Klempířské práce
                </p>
              </button>
            </div>
          );
        })()}
      </div>

      {/* Create Category Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-700/50 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Nová Poptávka / Sekce
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="flex flex-col overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Název sekce *
                  </label>
                  <input
                    required
                    type="text"
                    value={newCategoryForm.title}
                    onChange={(e) =>
                      setNewCategoryForm({
                        ...newCategoryForm,
                        title: e.target.value,
                      })
                    }
                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                    placeholder="Např. Klempířské konstrukce"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Cena SOD (Investor)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatInputNumber(newCategoryForm.sodBudget)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\s/g, "");
                        if (/^\d*$/.test(raw)) {
                          setNewCategoryForm({
                            ...newCategoryForm,
                            sodBudget: raw,
                          });
                        }
                      }}
                      className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                      placeholder="500 000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Interní Plán
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatInputNumber(newCategoryForm.planBudget)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\s/g, "");
                        if (/^\d*$/.test(raw)) {
                          setNewCategoryForm({
                            ...newCategoryForm,
                            planBudget: raw,
                          });
                        }
                      }}
                      className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                      placeholder="450 000"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Popis prací
                  </label>
                  <textarea
                    rows={4}
                    value={newCategoryForm.description}
                    onChange={(e) =>
                      setNewCategoryForm({
                        ...newCategoryForm,
                        description: e.target.value,
                      })
                    }
                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white resize-none"
                    placeholder="Detailní popis požadovaných prací..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Termín poptávky
                  </label>
                  <input
                    type="date"
                    value={newCategoryForm.deadline}
                    onChange={(e) =>
                      setNewCategoryForm({
                        ...newCategoryForm,
                        deadline: e.target.value,
                      })
                    }
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Termín pro podání cenové nabídky
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Termín realizace (nepovinné)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1">Od</p>
                      <input
                        type="date"
                        value={newCategoryForm.realizationStart}
                        onChange={(e) =>
                          setNewCategoryForm({
                            ...newCategoryForm,
                            realizationStart: e.target.value,
                          })
                        }
                        className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1">Do</p>
                      <input
                        type="date"
                        value={newCategoryForm.realizationEnd}
                        onChange={(e) =>
                          setNewCategoryForm({
                            ...newCategoryForm,
                            realizationEnd: e.target.value,
                          })
                        }
                        min={newCategoryForm.realizationStart || undefined}
                        className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Předpokládaný termín realizace prací
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                    Dokumenty
                  </label>
                  <div className="flex flex-col gap-3">
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      <div className="flex flex-col items-center justify-center">
                        <span className="material-symbols-outlined text-slate-400 text-[28px] mb-1">
                          upload_file
                        </span>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Klikněte pro výběr souborů
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          PDF, Word, Excel, obrázky (max 10MB)
                        </p>
                      </div>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          if (e.target.files) {
                            const newFiles = Array.from(e.target.files).filter(
                              (f: File) => f.size <= 10 * 1024 * 1024
                            );
                            if (newFiles.length < e.target.files.length) {
                              alert(
                                "Některé soubory překročily limit 10MB a nebyly přidány."
                              );
                            }
                            setSelectedFiles((prev) => [...prev, ...newFiles]);
                          }
                        }}
                      />
                    </label>
                    {selectedFiles.length > 0 && (
                      <div className="space-y-2">
                        {selectedFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="material-symbols-outlined text-slate-400 text-[18px]">
                                description
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                                  {file.name}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {formatFileSize(file.size)}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedFiles((prev) =>
                                  prev.filter((_, i) => i !== index)
                                )
                              }
                              className="text-slate-400 hover:text-red-500 transition-colors ml-2"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                close
                              </span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950/30 border-t border-slate-200 dark:border-slate-700/40 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 bg-white dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={uploadingFiles}
                  className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {uploadingFiles && (
                    <span className="material-symbols-outlined animate-spin text-[16px]">
                      progress_activity
                    </span>
                  )}
                  {uploadingFiles ? "Nahrávání..." : "Vytvořit poptávku"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-700/50 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Upravit Poptávku
              </h3>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingCategory(null);
                }}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleEditCategory} className="flex flex-col overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Název sekce *
                  </label>
                  <input
                    required
                    type="text"
                    value={newCategoryForm.title}
                    onChange={(e) =>
                      setNewCategoryForm({
                        ...newCategoryForm,
                        title: e.target.value,
                      })
                    }
                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                    placeholder="Např. Klempířské konstrukce"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Cena SOD (Investor)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatInputNumber(newCategoryForm.sodBudget)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\s/g, "");
                        if (/^\d*$/.test(raw)) {
                          setNewCategoryForm({
                            ...newCategoryForm,
                            sodBudget: raw,
                          });
                        }
                      }}
                      className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                      placeholder="500 000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Interní Plán
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatInputNumber(newCategoryForm.planBudget)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\s/g, "");
                        if (/^\d*$/.test(raw)) {
                          setNewCategoryForm({
                            ...newCategoryForm,
                            planBudget: raw,
                          });
                        }
                      }}
                      className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                      placeholder="450 000"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Popis prací
                  </label>
                  <textarea
                    rows={4}
                    value={newCategoryForm.description}
                    onChange={(e) =>
                      setNewCategoryForm({
                        ...newCategoryForm,
                        description: e.target.value,
                      })
                    }
                    className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none resize-none"
                    placeholder="Detailní popis požadovaných prací..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Termín poptávky
                  </label>
                  <input
                    type="date"
                    value={newCategoryForm.deadline}
                    onChange={(e) =>
                      setNewCategoryForm({
                        ...newCategoryForm,
                        deadline: e.target.value,
                      })
                    }
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-600 dark:text-slate-500 mt-1">
                    Termín pro podání cenové nabídky
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Termín realizace (nepovinné)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-slate-500 mb-1">Od</p>
                      <input
                        type="date"
                        value={newCategoryForm.realizationStart}
                        onChange={(e) =>
                          setNewCategoryForm({
                            ...newCategoryForm,
                            realizationStart: e.target.value,
                          })
                        }
                        className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 mb-1">Do</p>
                      <input
                        type="date"
                        value={newCategoryForm.realizationEnd}
                        onChange={(e) =>
                          setNewCategoryForm({
                            ...newCategoryForm,
                            realizationEnd: e.target.value,
                          })
                        }
                        min={newCategoryForm.realizationStart || undefined}
                        className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-600 dark:text-slate-500 mt-1">
                    Předpokládaný termín realizace prací
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700/50 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingCategory(null);
                  }}
                  className="px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-slate-300 text-sm font-medium hover:bg-slate-600/50 transition-colors"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={uploadingFiles}
                  className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl text-sm font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {uploadingFiles && (
                    <span className="material-symbols-outlined animate-spin text-[16px]">
                      progress_activity
                    </span>
                  )}
                  {uploadingFiles ? "Ukládání..." : "Uložit změny"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
