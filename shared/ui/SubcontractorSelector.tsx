import React, { useState, useMemo, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
  formatRegionCoverage,
  formatSpecializations,
  getStatusConfig,
  getStatusTextClasses,
} from "@/shared/ui/contacts/contactDisplay";

// Column visibility configuration
type ColumnId =
  | "specializace"
  | "kontakt"
  | "telefon"
  | "ico"
  | "region"
  | "regions"
  | "hodnoceni"
  | "stav";

const COLUMN_DEFINITIONS: { id: ColumnId; label: string }[] = [
  { id: "specializace", label: "Specializace" },
  { id: "kontakt", label: "Kontakt" },
  { id: "telefon", label: "Telefon / Email" },
  { id: "ico", label: "IČO" },
  { id: "region", label: "Region" },
  { id: "regions", label: "Kraj působnosti" },
  { id: "hodnoceni", label: "Hodnocení" },
  { id: "stav", label: "Stav" },
];

const STORAGE_KEY = "tf-contacts-visible-columns";
const DEFAULT_VISIBLE: ColumnId[] = [
  "specializace",
  "kontakt",
  "telefon",
  "ico",
  "region",
  "regions",
  "hodnoceni",
  "stav",
];

function loadVisibleColumns(): Set<ColumnId> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ColumnId[];
      return new Set(parsed);
    }
  } catch {
    /* ignore */
  }
  return new Set(DEFAULT_VISIBLE);
}

function saveVisibleColumns(columns: Set<ColumnId>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(columns)));
}

// ─── Virtualized table component ───────────────────────────────────────────
const ROW_HEIGHT = 72;

interface VirtualizedContactTableProps {
  filteredContacts: Subcontractor[];
  totalCount: number;
  selectedIds: Set<string>;
  visibleColumns: Set<ColumnId>;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  isColumnVisible: (id: ColumnId) => boolean;
  statuses: StatusConfig[];
  handleSelectAll: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSelectOne: (id: string) => void;
  onEditContact?: (contact: Subcontractor) => void;
  onContextMenu: (e: React.MouseEvent, contact: Subcontractor) => void;
  onClearFilters: () => void;
}

const VirtualizedContactTable: React.FC<VirtualizedContactTableProps> = ({
  filteredContacts,
  totalCount,
  selectedIds,
  visibleColumns,
  isAllSelected,
  isIndeterminate,
  isColumnVisible,
  statuses,
  handleSelectAll,
  handleSelectOne,
  onEditContact,
  onContextMenu,
  onClearFilters,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: filteredContacts.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const COL_DEFS: Record<
    ColumnId | "checkbox" | "firma",
    { min: number; flex?: boolean }
  > = {
    checkbox: { min: 40 },
    firma: { min: 180, flex: true },
    specializace: { min: 170, flex: true },
    kontakt: { min: 160, flex: true },
    telefon: { min: 160, flex: true },
    ico: { min: 90 },
    region: { min: 100 },
    regions: { min: 140, flex: true },
    hodnoceni: { min: 130 },
    stav: { min: 110 },
  };

  const orderedCols: ColumnId[] = [
    "specializace",
    "kontakt",
    "telefon",
    "ico",
    "region",
    "regions",
    "hodnoceni",
    "stav",
  ];

  const { gridCols, tableMinWidth } = useMemo(() => {
    const toCol = (id: ColumnId | "checkbox" | "firma") => {
      const d = COL_DEFS[id];
      return d.flex ? `minmax(${d.min}px, 1fr)` : `${d.min}px`;
    };
    const cols = ["checkbox", "firma"].map((id) => toCol(id as any));
    let minW = COL_DEFS.checkbox.min + COL_DEFS.firma.min;
    for (const col of orderedCols) {
      if (visibleColumns.has(col)) {
        cols.push(toCol(col));
        minW += COL_DEFS[col].min;
      }
    }
    return { gridCols: cols.join(" "), tableMinWidth: minW };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleColumns]);

  const cellBase = "px-6 py-4";

  return (
    <>
      <div ref={scrollRef} className="overflow-auto flex-1 min-w-0 px-1">
        {/* Header */}
        <div
          className="grid items-end text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky top-0 z-10 bg-white dark:bg-slate-900 pb-1"
          style={{ gridTemplateColumns: gridCols, minWidth: tableMinWidth }}
        >
          <div className="px-6 py-2">
            <input
              type="checkbox"
              aria-label="Vybrat vše"
              checked={isAllSelected}
              ref={(input) => {
                if (input) input.indeterminate = isIndeterminate;
              }}
              onChange={handleSelectAll}
              className="rounded border-slate-300 text-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
            />
          </div>
          <div className="px-6 py-2 font-medium">Firma</div>
          {isColumnVisible("specializace") && (
            <div className="px-6 py-2 font-medium">Specializace</div>
          )}
          {isColumnVisible("kontakt") && (
            <div className="px-6 py-2 font-medium">Kontakt</div>
          )}
          {isColumnVisible("telefon") && (
            <div className="px-6 py-2 font-medium">Telefon / Email</div>
          )}
          {isColumnVisible("ico") && (
            <div className="px-6 py-2 font-medium">IČO</div>
          )}
          {isColumnVisible("region") && (
            <div className="px-6 py-2 font-medium">Region</div>
          )}
          {isColumnVisible("regions") && (
            <div className="px-6 py-2 font-medium">Kraj působnosti</div>
          )}
          {isColumnVisible("hodnoceni") && (
            <div className="px-6 py-2 font-medium">Hodnocení</div>
          )}
          {isColumnVisible("stav") && (
            <div className="px-6 py-2 font-medium">Stav</div>
          )}
        </div>

        {/* Body */}
        <div
          className="relative text-sm text-slate-600 dark:text-slate-400"
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            minWidth: tableMinWidth,
          }}
        >
          {filteredContacts.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="flex flex-col items-center justify-center text-slate-400">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-3xl">
                    search_off
                  </span>
                </div>
                <p className="font-medium">Nebyly nalezeny žádné kontakty</p>
                <p className="text-sm mt-1">
                  Zkuste upravit filtry nebo hledaný výraz.
                </p>
                <button
                  onClick={onClearFilters}
                  className="mt-4 text-primary font-bold text-sm hover:underline"
                >
                  Vymazat filtry
                </button>
              </div>
            </div>
          ) : (
            virtualizer.getVirtualItems().map((virtualRow) => {
              const contact = filteredContacts[virtualRow.index];
              const status = getStatusConfig(statuses, contact.status);
              const selected = selectedIds.has(contact.id);
              const rowBg = selected
                ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800";

              return (
                <div
                  key={contact.id}
                  ref={virtualizer.measureElement}
                  data-index={virtualRow.index}
                  data-testid="contact-row"
                  onDoubleClick={() => onEditContact?.(contact)}
                  onContextMenu={(e) => onContextMenu(e, contact)}
                  className={`
                    grid items-center absolute left-0 w-full mt-3 rounded-xl border
                    group transition-all duration-200 cursor-pointer
                    hover:shadow-md hover:-translate-y-[1px]
                    ${rowBg}
                    ${selected ? "shadow-md -translate-y-[1px]" : "shadow-sm"}
                  `}
                  style={{
                    gridTemplateColumns: gridCols,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className={cellBase}>
                    <input
                      type="checkbox"
                      aria-label={`Vybrat ${contact.company}`}
                      checked={selected}
                      onChange={() => handleSelectOne(contact.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-slate-300 text-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
                    />
                  </div>
                  <div
                    className={`${cellBase} font-bold text-slate-900 dark:text-white whitespace-nowrap`}
                  >
                    <div className="text-[15px]">{contact.company}</div>
                  </div>
                  {isColumnVisible("specializace") && (
                    <div className={cellBase}>
                      <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-snug">
                        {formatSpecializations(contact.specialization) || "—"}
                      </p>
                    </div>
                  )}
                  {isColumnVisible("kontakt") && (
                    <div
                      className={`${cellBase} text-slate-900 dark:text-slate-200`}
                    >
                      <div className="flex flex-col gap-2">
                        {contact.contacts.map((c, idx) => {
                          const initials = c.name
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase();
                          return (
                            <div
                              key={idx}
                              className="flex items-center gap-3"
                            >
                              <div className="size-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-slate-200 dark:border-slate-600 shadow-sm">
                                {initials || "?"}
                              </div>
                              <div className="flex flex-col">
                                <span
                                  className={
                                    idx === 0
                                      ? "text-sm font-medium"
                                      : "text-xs text-slate-500"
                                  }
                                >
                                  {c.name !== "-" ? (
                                    c.name
                                  ) : (
                                    <span className="italic">Nezadáno</span>
                                  )}
                                </span>
                                {c.position && (
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    {c.position}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {contact.contacts.length === 0 && (
                          <span className="text-slate-400 italic text-xs">
                            Bez kontaktu
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {isColumnVisible("telefon") && (
                    <div className={cellBase}>
                      <div className="flex flex-col gap-2">
                        {contact.contacts.map((c, idx) => (
                          <div
                            key={idx}
                            className={`flex flex-col gap-0.5 ${
                              idx > 0
                                ? "mt-1 pt-1 border-t border-slate-100 dark:border-slate-800/50"
                                : ""
                            }`}
                          >
                            {c.phone !== "-" && (
                              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                <span className="material-symbols-outlined text-[14px] text-slate-400">
                                  call
                                </span>
                                {c.phone}
                              </div>
                            )}
                            {c.email !== "-" && (
                              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                <span className="material-symbols-outlined text-[14px] text-slate-400">
                                  mail
                                </span>
                                <a
                                  href={`mailto:${c.email}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="hover:text-primary hover:underline truncate max-w-[150px]"
                                >
                                  {c.email}
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {isColumnVisible("ico") && (
                    <div className={`${cellBase} font-mono text-xs`}>
                      {contact.ico || "-"}
                    </div>
                  )}
                  {isColumnVisible("region") && (
                    <div
                      className={`${cellBase} text-sm text-slate-600 dark:text-slate-400`}
                    >
                      {contact.region || "-"}
                    </div>
                  )}
                  {isColumnVisible("regions") && (
                    <div
                      className={`${cellBase} text-xs text-slate-600 dark:text-slate-400`}
                    >
                      <span
                        className="truncate block"
                        title={formatRegionCoverage(contact.regions)}
                      >
                        {formatRegionCoverage(contact.regions)}
                      </span>
                    </div>
                  )}
                  {isColumnVisible("hodnoceni") && (
                    <div className={cellBase}>
                      {contact.vendorRatingAverage !== undefined &&
                      contact.vendorRatingAverage !== null ? (
                        <div
                          className="inline-flex items-center gap-2"
                          title={
                            contact.vendorRatingCount
                              ? `Hodnoceno: ${contact.vendorRatingCount}×`
                              : undefined
                          }
                        >
                          <StarRating
                            value={contact.vendorRatingAverage}
                            readOnly
                            size="sm"
                          />
                          <span className="text-xs text-slate-500">
                            {formatDecimal(contact.vendorRatingAverage, {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                            })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">
                          Neohodnoceno
                        </span>
                      )}
                    </div>
                  )}
                  {isColumnVisible("stav") && (
                    <div className={cellBase}>
                      <span
                        className={`text-xs font-bold whitespace-nowrap ${getStatusTextClasses(
                          status.color,
                        )}`}
                        title={`Stav: ${status.label}`}
                      >
                        {status.label}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl mt-2 text-xs text-slate-500 text-center border border-slate-200 dark:border-slate-800">
        Zobrazeno {filteredContacts.length} z {totalCount} kontaktů
      </div>
    </>
  );
};

// ─── Main component ────────────────────────────────────────────────────────
interface SubcontractorSelectorProps {
  contacts: Subcontractor[];
  statuses: StatusConfig[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onFilteredContactsChange?: (contacts: Subcontractor[]) => void;
  onEditContact?: (contact: Subcontractor) => void;
  onAddContact?: (name: string) => void;
  className?: string;
  /** When provided, enables the "Nejblíže ke stavbě" distance filter */
  projectPosition?: { lat: number; lng: number } | null;
}

export const SubcontractorSelector: React.FC<SubcontractorSelectorProps> = ({
  contacts,
  statuses,
  selectedIds,
  onSelectionChange,
  onFilteredContactsChange,
  onEditContact,
  onAddContact,
  className,
  projectPosition,
}) => {
  const filters = useContactsFilters(contacts, projectPosition);

  // Column visibility
  const [visibleColumns, setVisibleColumns] =
    useState<Set<ColumnId>>(loadVisibleColumns);
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  const toggleColumn = (id: ColumnId) => {
    setVisibleColumns((prev) => {
      const next = new Set<ColumnId>(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      saveVisibleColumns(next);
      return next;
    });
  };

  const isColumnVisible = (id: ColumnId) => visibleColumns.has(id);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        columnMenuRef.current &&
        !columnMenuRef.current.contains(e.target as Node)
      ) {
        setIsColumnMenuOpen(false);
      }
    };
    if (isColumnMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isColumnMenuOpen]);

  // Notify parent about filtered contacts change
  useEffect(() => {
    if (onFilteredContactsChange) {
      onFilteredContactsChange(filters.filteredContacts);
    }
  }, [filters.filteredContacts, onFilteredContactsChange]);

  // Context menu state
  const [menuState, setMenuState] = useState<{
    contact: Subcontractor | null;
    position: { x: number; y: number } | null;
  }>({ contact: null, position: null });

  const handleContextMenu = (e: React.MouseEvent, contact: Subcontractor) => {
    if (!onEditContact) return;
    e.preventDefault();
    setMenuState({ contact, position: { x: e.clientX, y: e.clientY } });
  };

  const closeMenu = () => setMenuState({ contact: null, position: null });

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

  // Selection Handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(filters.filteredContacts.map((c) => c.id));
      onSelectionChange(allIds);
    } else {
      onSelectionChange(new Set());
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    onSelectionChange(newSelected);
  };

  const isAllSelected =
    filters.filteredContacts.length > 0 &&
    filters.filteredContacts.every((c) => selectedIds.has(c.id));
  const isIndeterminate = selectedIds.size > 0 && !isAllSelected;

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
        onDistanceChange={filters.setDistanceKm}
        hasProjectPosition={!!filters.projectPosition}
        onClear={filters.clear}
        trailingSlot={
          <div className="relative" ref={columnMenuRef}>
            <button
              type="button"
              onClick={() => setIsColumnMenuOpen((prev) => !prev)}
              className="h-12 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 whitespace-nowrap"
              title="Zobrazení sloupců"
            >
              <span className="material-symbols-outlined text-[20px]">
                view_column
              </span>
              <span className="hidden md:inline text-sm font-medium">
                Sloupce
              </span>
              {visibleColumns.size < COLUMN_DEFINITIONS.length && (
                <span className="bg-primary text-white text-[10px] font-bold rounded-full size-5 flex items-center justify-center">
                  {visibleColumns.size}
                </span>
              )}
            </button>

            {isColumnMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 py-2 animate-fade-in">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Zobrazit sloupce
                  </span>
                </div>
                {COLUMN_DEFINITIONS.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => toggleColumn(col.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                  >
                    <div
                      className={`size-5 rounded border-2 flex items-center justify-center transition-colors ${
                        visibleColumns.has(col.id)
                          ? "bg-primary border-primary"
                          : "border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      {visibleColumns.has(col.id) && (
                        <span className="material-symbols-outlined text-white text-[14px]">
                          check
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {col.label}
                    </span>
                  </button>
                ))}
                <div className="px-3 pt-2 pb-1 border-t border-slate-100 dark:border-slate-800 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const all = new Set(DEFAULT_VISIBLE);
                      setVisibleColumns(all);
                      saveVisibleColumns(all);
                    }}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Zobrazit vše
                  </button>
                </div>
              </div>
            )}
          </div>
        }
      />

      {/* Create New Contact Option */}
      {onAddContact && filters.state.searchText && (
        <button
          onClick={() => onAddContact(filters.state.searchText)}
          className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-left group"
        >
          <div className="size-10 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-300 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined">add</span>
          </div>
          <div>
            <h4 className="font-bold text-blue-900 dark:text-blue-100">
              Vytvořit nového dodavatele: "{filters.state.searchText}"
            </h4>
            <p className="text-xs text-blue-600 dark:text-blue-300">
              Přidat do databáze a vybrat pro tuto poptávku
            </p>
          </div>
        </button>
      )}

      {/* Table */}
      <div className="flex-1 flex flex-col min-h-0">
        <VirtualizedContactTable
          filteredContacts={filters.filteredContacts}
          totalCount={contacts.length}
          selectedIds={selectedIds}
          visibleColumns={visibleColumns}
          isAllSelected={isAllSelected}
          isIndeterminate={isIndeterminate}
          isColumnVisible={isColumnVisible}
          statuses={statuses}
          handleSelectAll={handleSelectAll}
          handleSelectOne={handleSelectOne}
          onEditContact={onEditContact}
          onContextMenu={handleContextMenu}
          onClearFilters={filters.clear}
        />
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
