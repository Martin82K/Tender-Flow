import { useState } from "react";
import type { Bid, DemandCategory, Subcontractor } from "@/types";
import { insertBids } from "@/features/projects/api";
import { getDemoData, saveDemoData } from "@/services/demoData";
import { invokeAuthedFunction } from "@/services/functionsClient";
import { ensureStructure } from "@/services/fileSystemService";
import { buildHierarchyTree, resolveDocHubStructureV1 } from "@/utils/docHub";

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
  projectDataDocHubStructureV1?: string;
  isDocHubEnabled: boolean;
  docHubRoot: string;
  showAlert: (args: ShowAlertArgs) => void;
}

export const usePipelineSubcontractorSelection = ({
  activeCategory,
  bids,
  updateBidsInternal,
  userRole,
  projectDataId,
  projectDataDocHubProvider,
  projectDataDocHubStructureV1,
  isDocHubEnabled,
  docHubRoot,
  showAlert,
}: UsePipelineSubcontractorSelectionInput) => {
  const [isSubcontractorModalOpen, setIsSubcontractorModalOpen] =
    useState(false);
  const [isSubcontractorModalMaximized, setIsSubcontractorModalMaximized] =
    useState(false);
  const [selectedSubcontractorIds, setSelectedSubcontractorIds] = useState<
    Set<string>
  >(new Set());

  const handleAddSubcontractors = async (localContacts: Subcontractor[]) => {
    if (!activeCategory) return;

    const newBids: Bid[] = [];
    selectedSubcontractorIds.forEach((id) => {
      const contact = localContacts.find((c) => c.id === id);
      if (!contact) return;

      const existing = (bids[activeCategory.id] || []).find(
        (bid) => bid.subcontractorId === contact.id,
      );
      if (existing) return;

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
    });

    if (newBids.length > 0) {
      updateBidsInternal((prev) => ({
        ...prev,
        [activeCategory.id]: [...(prev[activeCategory.id] || []), ...newBids],
      }));

      try {
        if (userRole === "demo") {
          const demoData = getDemoData();
          if (demoData && demoData.projectDetails[projectDataId]) {
            const projectBids = demoData.projectDetails[projectDataId].bids || {};
            projectBids[activeCategory.id] = [
              ...(projectBids[activeCategory.id] || []),
              ...newBids,
            ];
            demoData.projectDetails[projectDataId].bids = projectBids;
            saveDemoData(demoData);
          }
        } else {
          const bidsToInsert = newBids.map((bid) => ({
            id: bid.id,
            demand_category_id: activeCategory.id,
            subcontractor_id: bid.subcontractorId,
            company_name: bid.companyName,
            contact_person: bid.contactPerson,
            email: bid.email,
            phone: bid.phone,
            price: null,
            price_display: bid.price,
            notes: bid.notes || null,
            status: bid.status,
            tags: bid.tags || [],
          }));

          const { data, error } = await insertBids(bidsToInsert);

          if (error) {
            console.error("Error inserting bids:", {
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint,
            });
            showAlert({
              title: "Chyba při ukládání",
              message: `Chyba při ukládání nabídek: ${error.message}\n\nKód: ${error.code}\nDetail: ${error.details || "N/A"}\nHint: ${error.hint || "N/A"}`,
              variant: "danger",
            });
          } else {
            console.log("Successfully inserted bids:", data);

            if (isDocHubEnabled) {
              const provider = projectDataDocHubProvider;
              if (provider === "onedrive") {
                const localSuppliers: Record<string, Array<{ id: string; name: string }>> = {};
                localSuppliers[activeCategory.id] = newBids.map((bid) => ({
                  id: bid.subcontractorId,
                  name: bid.companyName,
                }));

                const structure = resolveDocHubStructureV1(
                  projectDataDocHubStructureV1 || undefined,
                );
                const hierarchyTree = buildHierarchyTree(
                  structure.extraHierarchy || [],
                );

                ensureStructure({
                  rootPath: docHubRoot,
                  structure,
                  categories: [
                    { id: activeCategory.id, title: activeCategory.title },
                  ],
                  suppliers: localSuppliers,
                  hierarchy: hierarchyTree,
                }).then((res) => {
                  if (!res.success) {
                    console.error("Auto-create folders failed:", res.error);
                    showAlert({
                      title: "Chyba vytvoření složek",
                      message: res.error || "Neznámá chyba",
                      variant: "danger",
                    });
                  }
                });
              } else if (
                provider === "gdrive" ||
                provider === "onedrive_cloud"
              ) {
                invokeAuthedFunction("dochub-autocreate", {
                  body: { projectId: projectDataId },
                }).catch((err) =>
                  console.error("Cloud auto-create trigger failed:", err),
                );
              }
            }
          }
        }
      } catch (error) {
        console.error("Unexpected error inserting bids:", error);
        showAlert({
          title: "Chyba",
          message: `Neočekávaná chyba: ${error}`,
          variant: "danger",
        });
      }
    }

    setIsSubcontractorModalOpen(false);
    setSelectedSubcontractorIds(new Set());
  };

  return {
    isSubcontractorModalOpen,
    setIsSubcontractorModalOpen,
    isSubcontractorModalMaximized,
    setIsSubcontractorModalMaximized,
    selectedSubcontractorIds,
    setSelectedSubcontractorIds,
    handleAddSubcontractors,
  };
};
