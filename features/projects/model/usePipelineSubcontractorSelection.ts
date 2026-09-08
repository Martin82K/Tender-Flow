import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PROJECT_DETAILS_KEYS } from "@shared/queryKeys/projectDetailKeys";
import { mergeConfirmedBids, toPipelineBid } from "./pipelineBidPersistence";
import type { Bid, DemandCategory, DocHubStructureV1, ProjectDetails, Subcontractor } from "@/types";
import { insertBids } from "@/features/projects/api";
import { projectDemoDataApi } from "@features/projects/api/projectDemoDataApi";
import { invokeAuthedFunction } from "@infra/functions/functionsClient";
import { ensureStructure } from "@infra/files/fileSystemService";
import { isDesktop } from "@infra/platform/platformAdapter";
import {
  buildHierarchyTree,
  ensureExtraHierarchy,
  resolveDocHubStructureV1,
} from "@/shared/dochub/docHub";

interface ShowAlertArgs {
  title: string;
  message: string;
  variant?: "danger" | "info" | "success";
}

interface UsePipelineSubcontractorSelectionInput {
  activeCategory: DemandCategory | null;
  bids: Record<string, Bid[]>;
  updateBidsInternal: (
    updater: (prev: Record<string, Bid[]>) => Record<string, Bid[]>,
  ) => void;
  userRole?: string;
  projectDataId: string;
  projectDataDocHubProvider?: string;
  projectDataDocHubStructureV1?: Partial<DocHubStructureV1> | null;
  isDocHubEnabled: boolean;
  docHubRoot: string;
  showAlert: (args: ShowAlertArgs) => void;
}

export const usePipelineSubcontractorSelection = ({
  activeCategory,
  updateBidsInternal,
  userRole,
  projectDataId,
  projectDataDocHubProvider,
  projectDataDocHubStructureV1,
  isDocHubEnabled,
  docHubRoot,
  showAlert,
}: UsePipelineSubcontractorSelectionInput) => {
  const [isSubcontractorModalOpen, setModalOpen] =
    useState(false);
  const [isSubcontractorModalMaximized, setIsSubcontractorModalMaximized] =
    useState(true);

  useEffect(() => {
    if (isSubcontractorModalOpen) {
      setIsSubcontractorModalMaximized(true);
    }
  }, [isSubcontractorModalOpen]);
  const [selectedSubcontractorIds, setSelectedSubcontractorIds] = useState<
    Set<string>
  >(new Set());

  const queryClient = useQueryClient();
  const [isAddingSubcontractors, setIsAddingSubcontractors] = useState(false);
  const operationRef = useRef<object | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; operationRef.current = null; };
  }, []);

  useEffect(() => {
    // A request owns the selector it started in, never a later project/category.
    operationRef.current = null;
    setIsAddingSubcontractors(false);
    setModalOpen(false);
    setSelectedSubcontractorIds(new Set());
  }, [projectDataId, activeCategory?.id]);

  const setIsSubcontractorModalOpen = (open: boolean) => {
    if (!operationRef.current) setModalOpen(open);
  };

  const scopeRef = useRef({ projectId: projectDataId, categoryId: activeCategory?.id });
  scopeRef.current = { projectId: projectDataId, categoryId: activeCategory?.id };

  const createSupplierFolders = async (category: DemandCategory, newBids: Bid[]) => {
    if (!isDocHubEnabled || newBids.length === 0) return;
    const notify = (args: ShowAlertArgs) => {
      if (mountedRef.current && scopeRef.current.projectId === projectDataId && scopeRef.current.categoryId === category.id) showAlert(args);
    };
    try {
      if (projectDataDocHubProvider === "onedrive") {
        if (!isDesktop) {
          notify({ title: "Složky nelze vytvořit", message: "Pro automatické vytváření složek dodavatelů spusťte Tender Flow Desktop.", variant: "info" });
          return;
        }
        const structure = resolveDocHubStructureV1(projectDataDocHubStructureV1 || undefined);
        const result = await ensureStructure({
          rootPath: docHubRoot, structure,
          categories: [{ id: category.id, title: category.title }],
          suppliers: { [category.id]: newBids.map(bid => ({ id: bid.subcontractorId, name: bid.companyName })) },
          hierarchy: buildHierarchyTree(ensureExtraHierarchy(structure.extraHierarchy)),
        });
        if (!result.success) throw new Error("Folder creation failed");
      } else if (projectDataDocHubProvider === "gdrive" || projectDataDocHubProvider === "onedrive_cloud") {
        await invokeAuthedFunction("dochub-autocreate", { body: { projectId: projectDataId } });
      } else {
        notify({ title: "DocHub není připojen", message: "Nastavte poskytovatele DocHub v záložce Dokumenty.", variant: "info" });
      }
    } catch {
      notify({ title: "Chyba vytvoření složek", message: "Dodavatelé jsou uloženi, ale složky se nepodařilo vytvořit.", variant: "info" });
    }
  };

  const handleAddSubcontractors = async (localContacts: Subcontractor[]) => {
    if (!activeCategory || operationRef.current) return;
    const operation = {};
    operationRef.current = operation;
    setIsAddingSubcontractors(true);
    const category = activeCategory;
    const current = () => mountedRef.current && operationRef.current === operation;
    const contacts = localContacts.filter(contact => selectedSubcontractorIds.has(contact.id));

    try {
      if (contacts.length === 0) return;
      const newBids: Bid[] = contacts.map(contact => ({
        id: crypto.randomUUID(),
        subcontractorId: contact.id,
        companyName: contact.company,
        contactPerson: contact.contacts[0]?.name || "-",
        email: contact.contacts[0]?.email || "-",
        phone: contact.contacts[0]?.phone || "-",
        price: "?", status: "contacted", tags: [],
      }));

      if (userRole === "demo") {
        const demoData = projectDemoDataApi.getDemoData();
        const details = demoData?.projectDetails[projectDataId];
        if (!demoData || !details) throw new Error("Demo projekt není dostupný.");
        const existing = details.bids?.[category.id] ?? [];
        const added = newBids.filter(bid => !existing.some(item => item.subcontractorId === bid.subcontractorId));
        const next = { ...details.bids, [category.id]: [...existing, ...added] };
        demoData.projectDetails[projectDataId] = { ...details, bids: next };
        projectDemoDataApi.saveDemoData(demoData);
        if (current()) updateBidsInternal(prev => ({ ...prev, [category.id]: next[category.id] }));
      } else {
        const response = await insertBids(newBids.map(bid => ({
          id: bid.id, demand_category_id: category.id, subcontractor_id: bid.subcontractorId,
          company_name: bid.companyName, contact_person: bid.contactPerson,
          email: bid.email, phone: bid.phone, price: null, price_display: bid.price,
          notes: null, status: bid.status, tags: bid.tags || [],
        })));
        if (!response.data?.length) throw new Error("Uložení dodavatelů se nepodařilo ověřit.");

        const confirmed = response.data.map(toPipelineBid);
        const queryKey = PROJECT_DETAILS_KEYS.detail(projectDataId);
        // An old in-flight snapshot must not erase a write that just committed.
        await queryClient.cancelQueries({ queryKey, exact: true });
        queryClient.setQueryData<ProjectDetails | null>(queryKey, old => old ? {
          ...old,
          bids: { ...old.bids, [category.id]: mergeConfirmedBids(old.bids?.[category.id] ?? [], confirmed) },
        } : old);
        try {
          await queryClient.invalidateQueries({ queryKey, exact: true, refetchType: "active" }, { throwOnError: true });
        } catch {
          if (current() && !response.error) showAlert({
            title: "Dodavatelé uloženi",
            message: "Uložení proběhlo, ale přehled se nepodařilo obnovit. Zkuste obnovit projekt.",
            variant: "info",
          });
        }
        const insertedIds = new Set(response.insertedIds);
        void createSupplierFolders(category, confirmed.filter(bid => insertedIds.has(bid.id)));
        if (response.error) {
          if (current()) {
            const confirmedSuppliers = new Set(confirmed.map(bid => bid.subcontractorId));
            setSelectedSubcontractorIds(previous => new Set([...previous].filter(id => !confirmedSuppliers.has(id))));
            showAlert({
              title: "Uložena část dodavatelů",
              message: `Potvrzeno ${confirmedSuppliers.size} z ${new Set(contacts.map(contact => contact.id)).size} dodavatelů. Zbývající výběr můžete zkusit přidat znovu.`,
              variant: "info",
            });
          }
          return;
        }
      }
      if (current()) {
        setModalOpen(false);
        setSelectedSubcontractorIds(new Set());
      }
    } catch {
      if (current()) showAlert({
        title: "Uložení se nepodařilo ověřit",
        message: "Zkontrolujte připojení a oprávnění k projektu a zkuste přidání znovu. Již uložené dodavatele opakování nezdvojí.",
        variant: "danger",
      });
    } finally {
      if (current()) { operationRef.current = null; setIsAddingSubcontractors(false); }
    }
  };

  return {
    isSubcontractorModalOpen,
    isAddingSubcontractors,
    setIsSubcontractorModalOpen,
    isSubcontractorModalMaximized,
    setIsSubcontractorModalMaximized,
    selectedSubcontractorIds,
    setSelectedSubcontractorIds,
    handleAddSubcontractors,
  };
};
