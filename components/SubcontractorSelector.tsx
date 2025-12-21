import React, { useState, useMemo, useEffect } from "react";
import { Subcontractor, StatusConfig } from "../types";

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
  const [searchText, setSearchText] = useState("");
  const [filterSpecialization, setFilterSpecialization] =
    useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Get unique specializations
  const specializations = useMemo(() => {
    const specs = new Set(contacts.flatMap((c) => c.specialization));
    return Array.from(specs).sort();
  }, [contacts]);

  // Filter Logic
  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const matchesSearch =
        contact.company.toLowerCase().includes(searchText.toLowerCase()) ||
        contact.contacts.some(c => 
          c.name.toLowerCase().includes(searchText.toLowerCase()) ||
          c.email.toLowerCase().includes(searchText.toLowerCase()) ||
          c.phone.toLowerCase().includes(searchText.toLowerCase())
        ) ||
        contact.specialization.some(s => s.toLowerCase().includes(searchText.toLowerCase()));

      const matchesSpec =
        filterSpecialization === "all" ||
        contact.specialization.includes(filterSpecialization);
      const matchesStatus =
        filterStatus === "all" || contact.status === filterStatus;

      return matchesSearch && matchesSpec && matchesStatus;
    });
  }, [contacts, searchText, filterSpecialization, filterStatus]);

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
    <div className={`flex flex-col gap-6 ${className || ""}`}>
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
              className="w-full h-12 pl-4 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-200 appearance-none focus:ring-primary focus:border-primary"
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
              className="w-full h-12 pl-4 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-200 appearance-none focus:ring-primary focus:border-primary"
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
      <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm text-left text-slate-600 dark:text-slate-400">
            <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-100 dark:bg-slate-800 border-b dark:border-slate-700 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = isIndeterminate;
                    }}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
                  />
                </th>
                <th className="px-6 py-4 font-medium">Firma</th>
                <th className="px-6 py-4 font-medium">Specializace</th>
                <th className="px-6 py-4 font-medium">Kontakt</th>
                <th className="px-6 py-4 font-medium">Telefon / Email</th>
                <th className="px-6 py-4 font-medium">IČO</th>
                <th className="px-6 py-4 font-medium">Region</th>
                <th className="px-6 py-4 font-medium">Stav</th>
                <th className="px-6 py-4 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredContacts.map((contact) => {
                const status = getStatusConfig(contact.status);
                return (
                  <tr
                    key={contact.id}
                    className={`bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group ${
                      selectedIds.has(contact.id)
                        ? "bg-blue-50/50 dark:bg-blue-900/10"
                        : ""
                    }`}
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(contact.id)}
                        onChange={() => handleSelectOne(contact.id)}
                        className="rounded border-slate-300 text-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
                      />
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {contact.company}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {contact.specialization.map((spec, index) => (
                          <span key={index} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded text-xs whitespace-nowrap">
                            {spec}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-900 dark:text-slate-200">
                      <div className="flex flex-col gap-1">
                        {contact.contacts.map((c, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px] text-slate-400">
                              person
                            </span>
                            <span className={idx === 0 ? "font-medium" : "text-xs text-slate-500"}>
                              {c.name !== "-" ? c.name : <span className="italic">Nezadáno</span>}
                              {c.position && <span className="ml-1 text-[10px] opacity-70">({c.position})</span>}
                            </span>
                          </div>
                        ))}
                        {contact.contacts.length === 0 && (
                          <span className="text-slate-400 italic">Bez kontaktu</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        {contact.contacts.map((c, idx) => (
                          <div key={idx} className={`flex flex-col gap-0.5 ${idx > 0 ? "mt-1 pt-1 border-t border-slate-100 dark:border-slate-800/50" : ""}`}>
                            {c.phone !== "-" && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="material-symbols-outlined text-[14px] text-slate-400">
                                  call
                                </span>
                                {c.phone}
                              </div>
                            )}
                            {c.email !== "-" && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="material-symbols-outlined text-[14px] text-slate-400">
                                  mail
                                </span>
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
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {contact.ico || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {contact.region || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColorClasses(
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
                    </td>
                    <td className="px-6 py-4 text-right">
                      {onEditContact && (
                        <button
                          onClick={() => onEditContact(contact)}
                          className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors opacity-0 group-hover:opacity-100"
                          title="Upravit"
                        >
                          <span className="material-symbols-outlined">
                            edit
                          </span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredContacts.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-10 text-center text-slate-500 italic"
                  >
                    Nebyly nalezeny žádné kontakty odpovídající filtrům.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 text-center">
          Zobrazeno {filteredContacts.length} z {contacts.length} kontaktů
        </div>
      </div>
    </div>
  );
};
