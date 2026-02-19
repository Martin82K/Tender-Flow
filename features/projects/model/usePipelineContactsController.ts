import { useEffect, useState } from "react";
import type { Subcontractor } from "@/types";
import { insertSubcontractor, updateSubcontractor } from "@/features/projects/api";
import { getDemoData, saveDemoData } from "@/services/demoData";
import { validateSubcontractorCompanyName } from "@/shared/dochub/subcontractorNameRules";

interface ShowAlertArgs {
  title: string;
  message: string;
  variant?: "danger" | "info" | "success";
}

interface UsePipelineContactsControllerInput {
  externalContacts: Subcontractor[];
  userRole?: string;
  projectDataId: string;
  showAlert: (args: ShowAlertArgs) => void;
  onContactSaved?: (contact: Subcontractor) => void;
}

export const usePipelineContactsController = ({
  externalContacts,
  userRole,
  projectDataId,
  showAlert,
  onContactSaved,
}: UsePipelineContactsControllerInput) => {
  const [localContacts, setLocalContacts] =
    useState<Subcontractor[]>(externalContacts);
  const [isCreateContactModalOpen, setIsCreateContactModalOpen] =
    useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [editingContact, setEditingContact] = useState<Subcontractor | null>(null);

  useEffect(() => {
    setLocalContacts(externalContacts);
  }, [externalContacts]);

  const handleCreateContactRequest = (name: string) => {
    setNewContactName(name);
    setIsCreateContactModalOpen(true);
  };

  const closeContactModal = () => {
    setIsCreateContactModalOpen(false);
    setEditingContact(null);
  };

  const handleSaveNewContact = async (newContact: Subcontractor) => {
    try {
      const companyValidation = validateSubcontractorCompanyName(
        newContact.company,
      );
      if (!companyValidation.isValid) {
        showAlert({
          title: "Neplatny nazev dodavatele",
          message:
            companyValidation.reason || "Upravte nazev firmy a zkuste to znovu.",
          variant: "danger",
        });
        return;
      }

      if (userRole === "demo") {
        const demoData = getDemoData();
        if (demoData) {
          demoData.contacts = [...demoData.contacts, newContact];
          saveDemoData(demoData);
        }
      } else {
        const { error } = await insertSubcontractor(newContact);
        if (error) {
          console.error("Error saving contact to Supabase:", error);
          throw error;
        }
      }

      setLocalContacts((prev) => [...prev, newContact]);
      setIsCreateContactModalOpen(false);
      onContactSaved?.(newContact);
    } catch (error) {
      console.error("Unexpected error saving contact:", error);
    }
  };

  const handleUpdateContact = async (updatedContact: Subcontractor) => {
    try {
      const companyValidation = validateSubcontractorCompanyName(
        updatedContact.company,
      );
      if (!companyValidation.isValid) {
        showAlert({
          title: "Neplatny nazev dodavatele",
          message:
            companyValidation.reason || "Upravte nazev firmy a zkuste to znovu.",
          variant: "danger",
        });
        return;
      }

      if (userRole === "demo") {
        const demoData = getDemoData();
        if (demoData) {
          demoData.contacts = demoData.contacts.map((contact: Subcontractor) =>
            contact.id === updatedContact.id ? updatedContact : contact,
          );
          saveDemoData(demoData);
        }
      } else {
        const { error } = await updateSubcontractor(updatedContact);
        if (error) {
          console.error("Error updating contact in Supabase:", error);
          throw error;
        }
      }

      setLocalContacts((prev) =>
        prev.map((contact) =>
          contact.id === updatedContact.id ? updatedContact : contact,
        ),
      );
      setEditingContact(null);
    } catch (error) {
      console.error("Unexpected error updating contact:", error);
    }
  };

  return {
    localContacts,
    isCreateContactModalOpen,
    newContactName,
    editingContact,
    setEditingContact,
    handleCreateContactRequest,
    closeContactModal,
    handleSaveNewContact,
    handleUpdateContact,
  };
};
