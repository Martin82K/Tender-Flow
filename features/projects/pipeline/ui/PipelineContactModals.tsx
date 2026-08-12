import React from "react";

import type { StatusConfig, Subcontractor } from "@/types";
import { CreateContactModal } from "./CreateContactModal";
import { SubcontractorSelectorModal } from "./SubcontractorSelectorModal";

export interface PipelineContactModalsProps {
  isSelectorOpen: boolean;
  isSelectorMaximized: boolean;
  contacts: Subcontractor[];
  selectorStatuses: StatusConfig[];
  contactStatuses: StatusConfig[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onToggleSelectorMaximize: () => void;
  onCloseSelector: () => void;
  onConfirmSelection: () => void;
  onAddContact: (name: string) => void;
  onEditContact: (contact: Subcontractor) => void;
  projectPosition?: { lat: number; lng: number } | null;
  isCreateContactOpen: boolean;
  newContactName: string;
  editingContact: Subcontractor | null;
  existingSpecializations: string[];
  onCloseContact: () => void;
  onSaveNewContact: (contact: Subcontractor) => void;
  onUpdateContact: (contact: Subcontractor) => void;
}

export const PipelineContactModals: React.FC<PipelineContactModalsProps> = ({
  isSelectorOpen,
  isSelectorMaximized,
  contacts,
  selectorStatuses,
  contactStatuses,
  selectedIds,
  onSelectionChange,
  onToggleSelectorMaximize,
  onCloseSelector,
  onConfirmSelection,
  onAddContact,
  onEditContact,
  projectPosition,
  isCreateContactOpen,
  newContactName,
  editingContact,
  existingSpecializations,
  onCloseContact,
  onSaveNewContact,
  onUpdateContact,
}) => (
  <>
    <SubcontractorSelectorModal
      isOpen={isSelectorOpen}
      isMaximized={isSelectorMaximized}
      contacts={contacts}
      statuses={selectorStatuses}
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      onToggleMaximize={onToggleSelectorMaximize}
      onClose={onCloseSelector}
      onConfirm={onConfirmSelection}
      onAddContact={onAddContact}
      onEditContact={onEditContact}
      projectPosition={projectPosition}
    />
    {(isCreateContactOpen || editingContact) && (
      <CreateContactModal
        initialName={newContactName}
        initialData={editingContact || undefined}
        existingSpecializations={existingSpecializations}
        statuses={contactStatuses}
        onClose={onCloseContact}
        onSave={editingContact ? onUpdateContact : onSaveNewContact}
      />
    )}
  </>
);
