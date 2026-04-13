import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Subcontractor, StatusConfig } from "@/types";
import { StarRating } from "@/shared/ui/StarRating";

// Column visibility configuration
type ColumnId = 'specializace' | 'kontakt' | 'telefon' | 'ico' | 'region' | 'hodnoceni' | 'stav';

const COLUMN_DEFINITIONS: { id: ColumnId; label: string }[] = [
  { id: 'specializace', label: 'Specializace' },
  { id: 'kontakt', label: 'Kontakt' },
  { id: 'telefon', label: 'Telefon / Email' },
  { id: 'ico', label: 'IČO' },
  { id: 'region', label: 'Region' },
  { id: 'hodnoceni', label: 'Hodnocení' },
  { id: 'stav', label: 'Stav' },
];

const STORAGE_KEY = 'tf-contacts-visible-columns';
const DEFAULT_VISIBLE: ColumnId[] = ['specializace', 'kontakt', 'telefon', 'ico', 'region', 'hodnoceni', 'stav'];

function loadVisibleColumns(): Set<ColumnId> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ColumnId[];
      return new Set(parsed);
    }
  } catch { /* ignore */ }
  return new Set(DEFAULT_VISIBLE);
}

function saveVisibleColumns(columns: Set<ColumnId>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(columns)));
}

// ─── Virtualized table component ───────────────────────────────────────────
const ROW_HEIGHT = 72; // estimated row height in px

interface VirtualizedContactTableProps {
  filteredContacts: Subcontractor[];
  totalCount: number;
  selectedIds: Set<string>;
  visibleColumns: Set<ColumnId>;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  isColumnVisible: (id: ColumnId) => boolean;
  getStatusConfig: (id: string) => StatusConfig;
  getStatusColorClasses: (color: string) => string;
  getStatusDotColor: (color: string) => string;
  handleSelectAll: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSelectOne: (id: string) => void;
  onEditContact?: (contact: Subcontractor) => void;
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
  getStatusConfig,
  getStatusColorClasses,
  getStatusDotColor,
  handleSelectAll,
  handleSelectOne,
  onEditContact,
  onClearFilters,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: filteredContacts.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  // Column definitions: min = guaranteed minimum (enables scroll on small screens),
  // flex = whether column grows to fill remaining space on wide screens.
  const COL_DEFS: Record<ColumnId | 'edit' | 'checkbox' | 'firma', { min: number; flex?: boolean }> = {
    edit: { min: 48 }, checkbox: { min: 40 }, firma: { min: 180, flex: true },
    specializace: { min: 150, flex: true }, kontakt: { min: 160, flex: true },
    telefon: { min: 160, flex: true }, ico: { min: 90 }, region: { min: 100 },
    hodnoceni: { min: 130 }, stav: { min: 130 },
  };

  const { gridCols, tableMinWidth } = useMemo(() => {
    const toCol = (id: ColumnId | 'edit' | 'checkbox' | 'firma') => {
      const d = COL_DEFS[id];
      return d.flex ? `minmax(${d.min}px, 1fr)` : `${d.min}px`;
    };
    const cols = ['edit', 'checkbox', 'firma'].map(id => toCol(id as any));
    let minW = COL_DEFS.edit.min + COL_DEFS.checkbox.min + COL_DEFS.firma.min;
    const ordered: ColumnId[] = ['specializace', 'kontakt', 'telefon', 'ico', 'region', 'hodnoceni', 'stav'];
    for (const col of ordered) {
      if (visibleColumns.has(col)) {
        cols.push(toCol(col));
        minW += COL_DEFS[col].min;
      }
    }
    return { gridCols: cols.join(' '), tableMinWidth: minW };
  }, [visibleColumns]);

  // Determine last visible column once
  const orderedCols: ColumnId[] = ['specializace', 'kontakt', 'telefon', 'ico', 'region', 'hodnoceni', 'stav'];
  const lastCol = [...orderedCols].reverse().find(c => visibleColumns.has(c)) || null;
  const lastCellClass = (id: ColumnId) => id === lastCol ? 'rounded-r-xl border-r' : '';
  const firmaIsLast = lastCol === null;

  const cellBase = "px-6 py-4";

  return (
    <>
      <div ref={scrollRef} className="overflow-auto flex-1 min-w-0 px-1">
        {/* Header */}
        <div
          className="grid items-end text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky top-0 z-10 bg-white dark:bg-slate-900 pb-1"
          style={{ gridTemplateColumns: gridCols, minWidth: tableMinWidth }}
        >
          <div className="px-6 py-2 font-medium"></div>
          <div className="px-6 py-2">
            <input
              type="checkbox"
              checked={isAllSelected}
              ref={(input) => {
                if (input) input.indeterminate = isIndeterminate;
              }}
              onChange={handleSelectAll}
              className="rounded border-slate-300 text-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
            />
          </div>
          <div className="px-6 py-2 font-medium">Firma</div>
          {isColumnVisible('specializace') && <div className="px-6 py-2 font-medium">Specializace</div>}
          {isColumnVisible('kontakt') && <div className="px-6 py-2 font-medium">Kontakt</div>}
          {isColumnVisible('telefon') && <div className="px-6 py-2 font-medium">Telefon / Email</div>}
          {isColumnVisible('ico') && <div className="px-6 py-2 font-medium">IČO</div>}
          {isColumnVisible('region') && <div className="px-6 py-2 font-medium">Region</div>}
          {isColumnVisible('hodnoceni') && <div className="px-6 py-2 font-medium">Hodnocení</div>}
          {isColumnVisible('stav') && <div className="px-6 py-2 font-medium">Stav</div>}
        </div>

        {/* Body */}
        <div
          className="relative text-sm text-slate-600 dark:text-slate-400"
          style={{ height: `${virtualizer.getTotalSize()}px`, minWidth: tableMinWidth }}
        >
          {filteredContacts.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="flex flex-col items-center justify-center text-slate-400">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-3xl">search_off</span>
                </div>
                <p className="font-medium">Nebyly nalezeny žádné kontakty</p>
                <p className="text-sm mt-1">Zkuste upravit filtry nebo hledaný výraz.</p>
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
              const status = getStatusConfig(contact.status);
              const selected = selectedIds.has(contact.id);
              const rowBg = selected
                ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800";

              return (
                <div
                  key={contact.id}
                  ref={virtualizer.measureElement}
                  data-index={virtualRow.index}
                  onDoubleClick={() => onEditContact?.(contact)}
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
                    {onEditContact && (
                      <button
                        onClick={() => onEditContact(contact)}
                        className="p-2 rounded-lg text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 hover:bg-orange-50/60 dark:hover:bg-orange-500/10 transition-colors"
                        title="Upravit"
                      >
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </button>
                    )}
                  </div>
                  <div className={cellBase}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => handleSelectOne(contact.id)}
                      className="rounded border-slate-300 text-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
                    />
                  </div>
                  <div className={`${cellBase} font-bold text-slate-900 dark:text-white whitespace-nowrap`}>
                    <div className="text-[15px]">{contact.company}</div>
                  </div>
                  {isColumnVisible('specializace') && (
                    <div className={cellBase}>
                      <div className="flex flex-wrap gap-1.5">
                        {contact.specialization.map((spec, index) => (
                          <span key={index} className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap">
                            {spec}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {isColumnVisible('kontakt') && (
                    <div className={`${cellBase} text-slate-900 dark:text-slate-200`}>
                      <div className="flex flex-col gap-2">
                        {contact.contacts.map((c, idx) => {
                          const initials = c.name
                            .split(' ')
                            .map(n => n[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase();

                          return (
                            <div key={idx} className="flex items-center gap-3">
                              <div className="size-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-slate-200 dark:border-slate-600 shadow-sm">
                                {initials || '?'}
                              </div>
                              <div className="flex flex-col">
                                <span className={idx === 0 ? "text-sm font-medium" : "text-xs text-slate-500"}>
                                  {c.name !== "-" ? c.name : <span className="italic">Nezadáno</span>}
                                </span>
                                {c.position && <span className="text-[10px] text-slate-400 font-medium">{c.position}</span>}
                              </div>
                            </div>
                          );
                        })}
                        {contact.contacts.length === 0 && (
                          <span className="text-slate-400 italic text-xs">Bez kontaktu</span>
                        )}
                      </div>
                    </div>
                  )}
                  {isColumnVisible('telefon') && (
                    <div className={cellBase}>
                      <div className="flex flex-col gap-2">
                        {contact.contacts.map((c, idx) => (
                          <div key={idx} className={`flex flex-col gap-0.5 ${idx > 0 ? "mt-1 pt-1 border-t border-slate-100 dark:border-slate-800/50" : ""}`}>
                            {c.phone !== "-" && (
                              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                <span className="material-symbols-outlined text-[14px] text-slate-400">call</span>
                                {c.phone}
                              </div>
                            )}
                            {c.email !== "-" && (
                              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                <span className="material-symbols-outlined text-[14px] text-slate-400">mail</span>
                                <a
                                  href={`mailto:${c.email}`}
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
                  {isColumnVisible('ico') && (
                    <div className={`${cellBase} font-mono text-xs`}>
                      {contact.ico || "-"}
                    </div>
                  )}
                  {isColumnVisible('region') && (
                    <div className={`${cellBase} text-sm text-slate-600 dark:text-slate-400`}>
                      {contact.region || "-"}
                    </div>
                  )}
                  {isColumnVisible('hodnoceni') && (
                    <div className={cellBase}>
                      {contact.vendorRatingAverage !== undefined && contact.vendorRatingAverage !== null ? (
                        <div
                          className="inline-flex items-center gap-2"
                          title={contact.vendorRatingCount ? `Hodnoceno: ${contact.vendorRatingCount}×` : undefined}
                        >
                          <StarRating value={contact.vendorRatingAverage} readOnly size="sm" />
                          <span className="text-xs text-slate-500">
                            {contact.vendorRatingAverage.toFixed(1)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Neohodnoceno</span>
                      )}
                    </div>
                  )}
                  {isColumnVisible('stav') && (
                    <div className={cellBase}>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap shadow-sm border border-transparent ${getStatusColorClasses(
                          status.color
                        )}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(
                            status.color
                          )}`}
                        ></span>
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
  onEditContact?: (contact: Subcontractor) => void; // Optional, for Contacts view
  onAddContact?: (name: string) => void; // Optional, for creating new contact
  className?: string;
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
}) => {
  const filterSelectClassName =
    "select-no-native-arrow w-full h-12 pl-4 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-200 bg-none focus:ring-primary focus:border-primary";

  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterSpecialization, setFilterSpecialization] =
    useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Debounce search input by 250ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 250);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnId>>(loadVisibleColumns);
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  const toggleColumn = (id: ColumnId) => {
    setVisibleColumns(prev => {
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

  // Close column menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setIsColumnMenuOpen(false);
      }
    };
    if (isColumnMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isColumnMenuOpen]);

  // Get unique specializations
  const specializations = useMemo(() => {
    const specs = new Set(contacts.flatMap((c) => c.specialization));
    return Array.from(specs).sort();
  }, [contacts]);

  // Filter Logic (uses debounced search for performance)
  const filteredContacts = useMemo(() => {
    const search = debouncedSearch.toLowerCase();
    return contacts.filter((contact) => {
      const matchesSearch = !search ||
        contact.company.toLowerCase().includes(search) ||
        contact.contacts.some(c =>
          c.name.toLowerCase().includes(search) ||
          c.email.toLowerCase().includes(search) ||
          c.phone.toLowerCase().includes(search)
        ) ||
        contact.specialization.some(s => s.toLowerCase().includes(search));

      const matchesSpec =
        filterSpecialization === "all" ||
        contact.specialization.includes(filterSpecialization);
      const matchesStatus =
        filterStatus === "all" || contact.status === filterStatus;

      return matchesSearch && matchesSpec && matchesStatus;
    });
  }, [contacts, debouncedSearch, filterSpecialization, filterStatus]);

  // Notify parent about filtered contacts change
  useEffect(() => {
    if (onFilteredContactsChange) {
      onFilteredContactsChange(filteredContacts);
    }
  }, [filteredContacts, onFilteredContactsChange]);

  // Helpers
  const getStatusConfig = (id: string) =>
    statuses.find((s) => s.id === id) || { label: id, color: "slate", id };

  const getStatusColorClasses = (color: string) => {
    switch (color) {
      case "green":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300";
      case "red":
        return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300";
      case "yellow":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300";
      case "blue":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300";
      case "purple":
        return "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300";
      default:
        return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300";
    }
  };

  const getStatusDotColor = (color: string) => {
    switch (color) {
      case "green":
        return "bg-green-500";
      case "red":
        return "bg-red-500";
      case "yellow":
        return "bg-yellow-500";
      case "blue":
        return "bg-blue-500";
      case "purple":
        return "bg-purple-500";
      default:
        return "bg-slate-500";
    }
  };

  // Selection Handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(filteredContacts.map((c) => c.id));
      // Merge with existing selection if needed, or just replace?
      // Usually "Select All" selects visible items.
      // Let's create a new set with visible items added to existing selection?
      // Or just select visible. Let's select visible.
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
    filteredContacts.length > 0 &&
    filteredContacts.every((c) => selectedIds.has(c.id));
  const isIndeterminate = selectedIds.size > 0 && !isAllSelected;

  return (
    <div className={`flex flex-col gap-6 min-w-0 ${className || ""}`}>
      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 flex items-center rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 h-12">
            <span className="material-symbols-outlined text-slate-500 dark:text-slate-400">
              search
            </span>
            <input
              type="text"
              placeholder="Hledat jméno, firmu, specializaci..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="flex-1 bg-transparent border-none focus:ring-0 ml-2 text-slate-900 dark:text-white placeholder-slate-500"
            />
          </div>

          <div className="relative w-full md:w-64">
            <select
              value={filterSpecialization}
              onChange={(e) => setFilterSpecialization(e.target.value)}
              className={filterSelectClassName}
            >
              <option value="all">Všechny specializace</option>
              {specializations.map((spec) => (
                <option key={spec} value={spec}>
                  {spec}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
              expand_more
            </span>
          </div>

          <div className="relative w-full md:w-48">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={filterSelectClassName}
            >
              <option value="all">Všechny stavy</option>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
              expand_more
            </span>
          </div>

          {/* Column Visibility Toggle */}
          <div className="relative" ref={columnMenuRef}>
            <button
              type="button"
              onClick={() => setIsColumnMenuOpen(prev => !prev)}
              className="h-12 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 whitespace-nowrap"
              title="Zobrazení sloupců"
            >
              <span className="material-symbols-outlined text-[20px]">view_column</span>
              <span className="hidden md:inline text-sm font-medium">Sloupce</span>
              {visibleColumns.size < COLUMN_DEFINITIONS.length && (
                <span className="bg-primary text-white text-[10px] font-bold rounded-full size-5 flex items-center justify-center">
                  {visibleColumns.size}
                </span>
              )}
            </button>

            {isColumnMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 py-2 animate-fade-in">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Zobrazit sloupce</span>
                </div>
                {COLUMN_DEFINITIONS.map(col => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => toggleColumn(col.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                  >
                    <div className={`size-5 rounded border-2 flex items-center justify-center transition-colors ${
                      visibleColumns.has(col.id)
                        ? 'bg-primary border-primary'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}>
                      {visibleColumns.has(col.id) && (
                        <span className="material-symbols-outlined text-white text-[14px]">check</span>
                      )}
                    </div>
                    <span className="text-sm text-slate-700 dark:text-slate-300">{col.label}</span>
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
        </div>

        {/* Active Filters Tags */}
        {(filterSpecialization !== "all" ||
          filterStatus !== "all" ||
          searchText) && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {filterSpecialization !== "all" && (
                <button
                  onClick={() => setFilterSpecialization("all")}
                  className="flex items-center gap-2 bg-primary/10 dark:bg-primary/20 text-primary px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap hover:bg-red-100 hover:text-red-600 transition-colors"
                >
                  {filterSpecialization}{" "}
                  <span className="material-symbols-outlined text-[16px]">
                    close
                  </span>
                </button>
              )}
              {filterStatus !== "all" && (
                <button
                  onClick={() => setFilterStatus("all")}
                  className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap hover:bg-red-100 hover:text-red-600 transition-colors"
                >
                  Status: {getStatusConfig(filterStatus).label}{" "}
                  <span className="material-symbols-outlined text-[16px]">
                    close
                  </span>
                </button>
              )}
              {searchText && (
                <button
                  onClick={() => setSearchText("")}
                  className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap hover:bg-red-100 hover:text-red-600 transition-colors"
                >
                  Hledat: "{searchText}"{" "}
                  <span className="material-symbols-outlined text-[16px]">
                    close
                  </span>
                </button>
              )}
              <button
                onClick={() => {
                  setFilterSpecialization("all");
                  setFilterStatus("all");
                  setSearchText("");
                }}
                className="text-xs text-slate-500 hover:text-primary underline ml-2"
              >
                Vymazat vše
              </button>
            </div>
          )}
      </div>

      {/* Create New Contact Option */}
      {onAddContact && searchText && (
        <button
          onClick={() => onAddContact(searchText)}
          className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-left group"
        >
          <div className="size-10 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-300 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined">add</span>
          </div>
          <div>
            <h4 className="font-bold text-blue-900 dark:text-blue-100">Vytvořit nového dodavatele: "{searchText}"</h4>
            <p className="text-xs text-blue-600 dark:text-blue-300">Přidat do databáze a vybrat pro tuto poptávku</p>
          </div>
        </button>
      )}

      {/* Table */}
      <div className="flex-1 flex flex-col min-h-0">
        <VirtualizedContactTable
          filteredContacts={filteredContacts}
          totalCount={contacts.length}
          selectedIds={selectedIds}
          visibleColumns={visibleColumns}
          isAllSelected={isAllSelected}
          isIndeterminate={isIndeterminate}
          isColumnVisible={isColumnVisible}
          getStatusConfig={getStatusConfig}
          getStatusColorClasses={getStatusColorClasses}
          getStatusDotColor={getStatusDotColor}
          handleSelectAll={handleSelectAll}
          handleSelectOne={handleSelectOne}
          onEditContact={onEditContact}
          onClearFilters={() => {
            setSearchText("");
            setFilterSpecialization("all");
            setFilterStatus("all");
          }}
        />
      </div>
    </div>
  );
};
