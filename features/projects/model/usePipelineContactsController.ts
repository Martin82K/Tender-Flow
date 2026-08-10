import { useEffect, useState } from "react";
import type { Subcontractor } from "@/types";
import { insertSubcontractor, updateSubcontractor } from "@/features/projects/api";
import { projectDemoDataApi } from "@features/projects/api/projectDemoDataApi";
import { validateSubcontractorCompanyName } from "@/shared/dochub/subcontractorNameRules";

interface ShowAlertArgs {
  title: string;
  message: string;
  variant?: "danger" | "info" | "success";
}

interface UsePipelineContactsControllerInput {
  externalContacts: Subcontractor[];
  userRole?: string;
  organizationId?: string;
  projectDataId: string;
  showAlert: (args: ShowAlertArgs) => void;
  persistNewContact?: (contact: Subcontractor) => Promise<void> | void;
  persistContactUpdate?: (contact: Subcontractor) => Promise<void> | void;
  onContactSaved?: (contact: Subcontractor) => void;
}

export const usePipelineContactsController = ({
  externalContacts,
  userRole,
  organizationId,
  projectDataId,
  showAlert,
  persistNewContact,
  persistContactUpdate,
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
        const demoData = projectDemoDataApi.getDemoData();
        if (demoData) {
          demoData.contacts = [...demoData.contacts, newContact];
          projectDemoDataApi.saveDemoData(demoData);
        }
      } else {
        if (persistNewContact) {
          await persistNewContact(newContact);
        } else {
          const { error } = await insertSubcontractor(newContact, organizationId);
          if (error) {
            console.error("Error saving contact to Supabase:", error);
            throw error;
          }
        }
      }

      setLocalContacts((prev) => [...prev, newContact]);
      setIsCreateContactModalOpen(false);
      onContactSaved?.(newContact);
    } catch (error) {
      console.error("Unexpected error saving contact:", error);
      showAlert({
        title: "Kontakt se nepodařilo uložit",
        message: "Nový kontakt nebyl uložen. Zkontrolujte připojení a oprávnění a zkuste to znovu.",
        variant: "danger",
      });
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
        const demoData = projectDemoDataApi.getDemoData();
        if (demoData) {
          demoData.contacts = demoData.contacts.map((contact: Subcontractor) =>
            contact.id === updatedContact.id ? updatedContact : contact,
          );
          projectDemoDataApi.saveDemoData(demoData);
        }
      } else {
        if (persistContactUpdate) {
          await persistContactUpdate(updatedContact);
        } else {
          const { data, error } = await updateSubcontractor(updatedContact);
          if (error || !data) {
            console.error("Error updating contact in Supabase:", error);
            throw error || new Error("Kontakt nebyl aktualizován");
          }
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
      showAlert({
        title: "Kontakt se nepodařilo uložit",
        message: "Změny nebyly uloženy. Zkontrolujte připojení a oprávnění a zkuste to znovu.",
        variant: "danger",
      });
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
