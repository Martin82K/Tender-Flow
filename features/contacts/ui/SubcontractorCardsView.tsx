import React, { useMemo, useState } from "react";
import { Subcontractor, StatusConfig } from "@/types";
import { StarRating } from "@/shared/ui/StarRating";
import { formatDecimal } from "@/utils/formatters";
import { useContactsFilters } from "@/shared/ui/contacts/useContactsFilters";
import { ContactsFilterBar } from "@/shared/ui/contacts/ContactsFilterBar";
import {
  ContactContextMenu,
  ContactContextMenuItem,
} from "@/shared/ui/contacts/ContactContextMenu";
import {
  contactInitials,
  formatRegionCoverage,
  formatSpecializations,
  getStatusConfig,
  getStatusTextClasses,
} from "@/shared/ui/contacts/contactDisplay";

interface SubcontractorCardsViewProps {
  contacts: Subcontractor[];
  statuses: StatusConfig[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onEditContact?: (contact: Subcontractor) => void;
  onFilteredContactsChange?: (contacts: Subcontractor[]) => void;
  className?: string;
}

interface CardProps {
  contact: Subcontractor;
  selected: boolean;
  status: StatusConfig;
  onToggleSelect: (id: string) => void;
  onEdit?: (contact: Subcontractor) => void;
  onContextMenu: (e: React.MouseEvent, contact: Subcontractor) => void;
}

const SubcontractorCard: React.FC<CardProps> = React.memo(
  ({ contact, selected, status, onToggleSelect, onEdit, onContextMenu }) => {
    const primary = contact.contacts?.[0];
    const initials = primary
      ? contactInitials(primary.name !== "-" ? primary.name : contact.company)
      : contactInitials(contact.company);

    const isRated =
      contact.vendorRatingAverage !== undefined &&
      contact.vendorRatingAverage !== null;

    return (
      <div
        data-testid="subcontractor-card"
        role="listitem"
        onDoubleClick={() => onEdit?.(contact)}
        onContextMenu={(e) => onContextMenu(e, contact)}
        className={`relative flex flex-col gap-3 rounded-2xl border p-5 shadow-sm transition-all duration-200 cursor-pointer hover:shadow-lg hover:-translate-y-[2px] ${
          selected
            ? "bg-blue-50/60 dark:bg-blue-900/15 border-blue-300 dark:border-blue-700"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="size-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-slate-600 shadow-sm shrink-0">
              {initials || "?"}
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-bold text-slate-900 dark:text-white truncate">
                {contact.company}
              </h3>
              {contact.ico && contact.ico !== "-" && (
                <p className="text-[11px] font-mono text-slate-400">
                  IČO {contact.ico}
                </p>
              )}
            </div>
          </div>
          <input
            type="checkbox"
            aria-label={`Vybrat ${contact.company}`}
            checked={selected}
            onChange={() => onToggleSelect(contact.id)}
            onClick={(e) => e.stopPropagation()}
            className="rounded border-slate-300 text-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600 shrink-0"
          />
        </div>

        {contact.specialization.length > 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
            {formatSpecializations(contact.specialization)}
          </p>
        )}

        {primary && primary.name && primary.name !== "-" && (
          <div className="flex flex-col gap-0.5 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {primary.name}
              {primary.position && (
                <span className="text-slate-400 font-normal">
                  {" "}
                  · {primary.position}
                </span>
              )}
            </span>
            {primary.phone && primary.phone !== "-" && (
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-slate-400">
                  call
                </span>
                {primary.phone}
              </span>
            )}
            {primary.email && primary.email !== "-" && (
              <a
                href={`mailto:${primary.email}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 hover:text-primary truncate"
              >
                <span className="material-symbols-outlined text-[14px] text-slate-400">
                  mail
                </span>
                <span className="truncate">{primary.email}</span>
              </a>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2 mt-auto border-t border-slate-100 dark:border-slate-800">
          <span
            className={`text-xs font-bold ${getStatusTextClasses(status.color)}`}
            title={`Stav: ${status.label}`}
          >
            {status.label}
          </span>
          {isRated ? (
            <div
              className="inline-flex items-center gap-1.5"
              title={
                contact.vendorRatingCount
                  ? `Hodnoceno: ${contact.vendorRatingCount}×`
                  : undefined
              }
            >
              <StarRating
                value={contact.vendorRatingAverage!}
                readOnly
                size="sm"
              />
              <span className="text-[11px] text-slate-500">
                {formatDecimal(contact.vendorRatingAverage!, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400">Neohodnoceno</span>
          )}
        </div>

        {contact.regions && contact.regions.length > 0 && (
          <p
            className="text-[11px] text-slate-500 dark:text-slate-400 truncate"
            title={formatRegionCoverage(contact.regions)}
          >
            <span className="material-symbols-outlined text-[12px] align-middle mr-1 text-slate-400">
              place
            </span>
            {formatRegionCoverage(contact.regions)}
          </p>
        )}
      </div>
    );
  },
);
SubcontractorCard.displayName = "SubcontractorCard";

export const SubcontractorCardsView: React.FC<SubcontractorCardsViewProps> = ({
  contacts,
  statuses,
  selectedIds,
  onSelectionChange,
  onEditContact,
  onFilteredContactsChange,
  className,
}) => {
  const filters = useContactsFilters(contacts);

  React.useEffect(() => {
    onFilteredContactsChange?.(filters.filteredContacts);
  }, [filters.filteredContacts, onFilteredContactsChange]);

  const [menuState, setMenuState] = useState<{
    contact: Subcontractor | null;
    position: { x: number; y: number } | null;
  }>({ contact: null, position: null });

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const handleContextMenu = (e: React.MouseEvent, contact: Subcontractor) => {
    if (!onEditContact) return;
    e.preventDefault();
    setMenuState({ contact, position: { x: e.clientX, y: e.clientY } });
  };

  const closeMenu = () =>
    setMenuState({ contact: null, position: null });

  const contextMenuItems: ContactContextMenuItem[] = useMemo(() => {
    const items: ContactContextMenuItem[] = [];
    if (onEditContact) {
      items.push({
        id: "edit",
        label: "Editace kontaktu",
        icon: "edit",
        onSelect: (c) => onEditContact(c),
      });
    }
    return items;
  }, [onEditContact]);

  const isAllSelected =
    filters.filteredContacts.length > 0 &&
    filters.filteredContacts.every((c) => selectedIds.has(c.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(filters.filteredContacts.map((c) => c.id)));
    }
  };

  return (
    <div className={`flex flex-col gap-6 min-w-0 ${className || ""}`}>
      <ContactsFilterBar
        state={filters.state}
        statuses={statuses}
        specializations={filters.specializations}
        onSearchChange={filters.setSearchText}
        onSpecializationChange={filters.setSpecialization}
        onStatusChange={filters.setStatus}
        onRegionChange={filters.setRegion}
        onClear={filters.clear}
        trailingSlot={
          <button
            type="button"
            onClick={handleToggleSelectAll}
            className="h-12 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 whitespace-nowrap text-sm font-medium"
            title={isAllSelected ? "Zrušit výběr" : "Vybrat vše zobrazené"}
          >
            <span className="material-symbols-outlined text-[20px]">
              {isAllSelected ? "deselect" : "select_all"}
            </span>
            <span className="hidden md:inline">
              {isAllSelected ? "Zrušit výběr" : "Vybrat vše"}
            </span>
          </button>
        }
      />

      {filters.filteredContacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-3xl">search_off</span>
          </div>
          <p className="font-medium">Nebyly nalezeny žádné kontakty</p>
          <p className="text-sm mt-1">Zkuste upravit filtry nebo hledaný výraz.</p>
          <button
            onClick={filters.clear}
            className="mt-4 text-primary font-bold text-sm hover:underline"
          >
            Vymazat filtry
          </button>
        </div>
      ) : (
        <div
          role="list"
          aria-label="Karty dodavatelů"
          data-testid="subcontractor-cards-grid"
          className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {filters.filteredContacts.map((contact) => (
            <SubcontractorCard
              key={contact.id}
              contact={contact}
              selected={selectedIds.has(contact.id)}
              status={getStatusConfig(statuses, contact.status)}
              onToggleSelect={handleToggleSelect}
              onEdit={onEditContact}
              onContextMenu={handleContextMenu}
            />
          ))}
        </div>
      )}

      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs text-slate-500 text-center border border-slate-200 dark:border-slate-800">
        Zobrazeno {filters.filteredContacts.length} z {contacts.length} kontaktů
      </div>

      <ContactContextMenu
        contact={menuState.contact}
        position={menuState.position}
        items={contextMenuItems}
        onClose={closeMenu}
      />
    </div>
  );
};
