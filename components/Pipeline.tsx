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
import { supabase } from "../services/supabase";
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

const DEFAULT_STATUSES: StatusConfig[] = [
  { id: "available", label: "K dispozici", color: "green" },
  { id: "busy", label: "Zaneprázdněn", color: "red" },
  { id: "waiting", label: "Čeká", color: "yellow" },
];

// --- Components ---

interface ColumnProps {
  title: string;
  status: BidStatus;
  color: "slate" | "blue" | "amber" | "green" | "red";
  children: React.ReactNode;
  count?: number;
  onDrop: (e: React.DragEvent, status: BidStatus) => void;
}

const Column: React.FC<ColumnProps> = ({
  title,
  status,
  color,
  children,
  count,
  onDrop,
}) => {
  const [isOver, setIsOver] = useState(false);

  const colorStyles = {
    slate: {
      wrapper:
        "border-slate-700/50 bg-slate-800/30",
      headerBorder: "border-slate-700/50",
      headerBg: "bg-slate-800/50",
    },
    blue: {
      wrapper:
        "border-blue-600/30 bg-blue-500/10",
      headerBorder: "border-blue-600/30",
      headerBg: "bg-blue-900/30",
    },
    amber: {
      wrapper:
        "border-amber-600/30 bg-amber-500/10",
      headerBorder: "border-amber-600/30",
      headerBg: "bg-amber-900/30",
    },
    green: {
      wrapper:
        "border-emerald-600/30 bg-emerald-500/10",
      headerBorder: "border-emerald-600/30",
      headerBg: "bg-emerald-900/30",
    },
    red: {
      wrapper:
        "border-red-600/30 bg-red-500/10",
      headerBorder: "border-red-600/30",
      headerBg: "bg-red-900/30",
    },
  };

  const styles = colorStyles[color];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = () => {
    setIsOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    setIsOver(false);
    onDrop(e, status);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col w-80 flex-shrink-0 rounded-2xl h-full max-h-full border backdrop-blur-xl transition-colors ${styles.wrapper
        } ${isOver ? "ring-2 ring-emerald-500/50 ring-inset" : ""}`}
    >
      <div
        className={`p-4 border-b ${styles.headerBorder} ${styles.headerBg} sticky top-0 rounded-t-2xl z-10 backdrop-blur-sm flex justify-between items-center transition-colors`}
      >
        <h2 className="text-white text-sm font-bold uppercase tracking-wide">
          {title}
        </h2>
        {count !== undefined && (
          <span className="bg-slate-700/50 text-xs font-bold px-2.5 py-1 rounded-full text-slate-300 border border-slate-600/50">
            {count}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3 p-3 overflow-y-auto no-scrollbar flex-1">
        {children}
      </div>
    </div>
  );
};

const EditBidModal: React.FC<{
  bid: Bid;
  onClose: () => void;
  onSave: (updatedBid: Bid) => void;
}> = ({ bid, onClose, onSave }) => {
  const [form, setForm] = useState({ ...bid });
  const [priceDisplay, setPriceDisplay] = useState(
    bid.price && bid.price !== "?" && bid.price !== "-"
      ? formatInputNumber(parseFormattedNumber(bid.price.replace(/[^\d\s,.-]/g, '')))
      : ""
  );

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow only digits, spaces, and commas
    const cleaned = raw.replace(/[^\d\s,]/g, '');
    setPriceDisplay(cleaned);

    // Parse and store numeric value
    const numericValue = parseFormattedNumber(cleaned);
    const priceStr = numericValue > 0 ? formatInputNumber(numericValue) + " Kč" : (cleaned ? cleaned : "?");

    // Update price and priceHistory for current round
    const currentRound = form.selectionRound || 1;
    const newPriceHistory = { ...(form.priceHistory || {}) };

    if (numericValue > 0) {
      // Add/update price for current round
      newPriceHistory[currentRound] = priceStr;
    } else {
      // Remove price from current round when cleared
      delete newPriceHistory[currentRound];
    }

    setForm({
      ...form,
      price: priceStr,
      priceHistory: Object.keys(newPriceHistory).length > 0 ? newPriceHistory : undefined
    });
  };

  const handlePriceBlur = () => {
    // Format on blur
    const numericValue = parseFormattedNumber(priceDisplay);
    if (numericValue > 0) {
      setPriceDisplay(formatInputNumber(numericValue));
    }
  };

  const handleRoundChange = (round: number) => {
    const newRound = form.selectionRound === round ? undefined : round;

    // When changing round, load existing price for that round if available
    let newPriceDisplay = "";
    if (newRound && form.priceHistory && form.priceHistory[newRound]) {
      const existingPrice = form.priceHistory[newRound];
      newPriceDisplay = formatInputNumber(parseFormattedNumber(existingPrice.replace(/[^\d\s,.-]/g, '')));
    }

    setPriceDisplay(newPriceDisplay);
    setForm({
      ...form,
      selectionRound: newRound,
      price: newRound && form.priceHistory?.[newRound] ? form.priceHistory[newRound] : form.price
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-700/50 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-700/50 flex justify-between items-center shrink-0">
          <h3 className="text-lg font-bold text-white">
            Upravit nabídku
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Kontaktní osoba
              </label>
              <input
                type="text"
                value={form.contactPerson}
                onChange={(e) =>
                  setForm({ ...form, contactPerson: e.target.value })
                }
                className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email || ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Telefon
                </label>
                <input
                  type="text"
                  value={form.phone || ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Cena (Kč)
              </label>
              <input
                type="text"
                value={priceDisplay}
                onChange={handlePriceChange}
                onBlur={handlePriceBlur}
                placeholder="1 500 000"
                className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
              />
            </div>

            {/* Datum k zaslání úpravy */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Datum k zaslání úpravy
              </label>
              <input
                type="date"
                value={form.updateDate || ""}
                onChange={(e) => setForm({ ...form, updateDate: e.target.value })}
                className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
              />
            </div>

            {/* Kola výběru */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                Kolo výběru
              </label>
              <div className="flex gap-3">
                {[1, 2, 3].map((round) => (
                  <label
                    key={round}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${form.selectionRound === round
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.selectionRound === round}
                      onChange={() => handleRoundChange(round)}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium">{round}. kolo</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Poznámka
              </label>
              <textarea
                rows={5}
                value={form.notes || ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white resize-y min-h-[80px]"
              />
            </div>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Zrušit
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold shadow-sm transition-colors"
            >
              Uložit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


const BidCard: React.FC<{
  bid: Bid;
  onClick?: () => void;
  onDragStart: (e: React.DragEvent, bidId: string) => void;
  onEdit: (bid: Bid) => void;
  onDelete?: (bidId: string) => void;
  onGenerateInquiry?: (bid: Bid) => void;
  category?: DemandCategory;
}> = ({ bid, onClick, onDragStart, onEdit, onDelete, onGenerateInquiry, category }) => {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, bid.id)}
      onClick={onClick}
      className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-xl shadow-lg p-4 border border-slate-700/50 hover:shadow-xl hover:border-emerald-500/30 transition-all cursor-grab active:cursor-grabbing group"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-white text-sm">
            {bid.companyName}
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(bid);
            }}
            className="text-slate-500 hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
          </button>
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Opravdu chcete odebrat tohoto dodavatele z výběrového řízení?')) {
                  onDelete(bid.id);
                }
              }}
              className="text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
              title="Odebrat z výběrového řízení"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>
        {bid.price && bid.price !== "-" && bid.price !== "?" && (
          <span className="text-xs font-bold bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/30">
            {bid.price}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5 mb-3">
        <div className="flex items-center gap-2 text-slate-400 text-xs">
          <span className="material-symbols-outlined text-[14px]">person</span>
          {bid.contactPerson}
        </div>
        {bid.phone && (
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <span className="material-symbols-outlined text-[14px]">call</span>
            {bid.phone}
          </div>
        )}
        {bid.email && (
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <span className="material-symbols-outlined text-[14px]">mail</span>
            {bid.email}
          </div>
        )}
        {/* Price History - show previous round prices */}
        {bid.priceHistory && Object.keys(bid.priceHistory).length > 1 && (
          <div className="mt-2 pt-2 border-t border-slate-700/50">
            {Object.entries(bid.priceHistory)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([round, price]) => (
                <div key={round} className="flex items-center justify-between text-xs text-slate-500">
                  <span>{round}. kolo:</span>
                  <span className={Number(round) === bid.selectionRound ? "text-emerald-400 font-medium" : ""}>
                    {price}
                  </span>
                </div>
              ))}
          </div>
        )}
        {bid.notes && (
          <p className="text-xs text-slate-500 italic mt-1">"{bid.notes}"</p>
        )}
      </div>

      {bid.tags && bid.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {bid.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded-md border border-slate-600/50"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Generate Inquiry Button for contacted status */}
      {bid.status === "contacted" && onGenerateInquiry && bid.email && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onGenerateInquiry(bid);
          }}
          className="mt-3 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-lg"
        >
          <span className="material-symbols-outlined text-[16px]">mail</span>
          Generovat poptávku
        </button>
      )}
    </div>
  );
};

const CategoryCard: React.FC<{
  category: DemandCategory;
  bidCount: number;
  priceOfferCount: number;
  contractedCount: number;
  sodBidsCount: number;
  onClick: () => void;
  onEdit?: (category: DemandCategory) => void;
  onDelete?: (categoryId: string) => void;
  onToggleComplete?: (category: DemandCategory) => void;
}> = ({ category, bidCount, priceOfferCount, contractedCount, sodBidsCount, onClick, onEdit, onDelete, onToggleComplete }) => {
  const statusColors = {
    open: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
    negotiating:
      "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    closed:
      "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    sod: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  };

  const statusLabels = {
    open: "Poptávání",
    negotiating: "Vyjednávání",
    closed: "Uzavřeno",
    sod: "V Realizaci",
  };

  const status =
    category.status === "sod"
      ? "sod"
      : category.status === "closed"
        ? "closed"
        : category.status === "negotiating"
          ? "negotiating"
          : "open";

  // Formatting Helper - using centralized formatter
  const formatMoneyLocal = formatMoney;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="flex flex-col text-left bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 hover:shadow-xl hover:border-emerald-500/30 hover:shadow-emerald-500/5 transition-all group relative overflow-hidden h-full cursor-pointer"
    >
      <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

      {/* Action buttons */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onToggleComplete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete(category);
            }}
            className={`p-1.5 ${category.status === 'closed' ? 'bg-emerald-500/20 hover:bg-emerald-500/30' : 'bg-slate-700/50 hover:bg-slate-600/50'} rounded-lg transition-colors`}
            title={category.status === 'closed' ? 'Označit jako otevřenou' : 'Označit jako ukončenou'}
          >
            <span className={`material-symbols-outlined text-[16px] ${category.status === 'closed' ? 'text-emerald-400' : 'text-slate-400'}`}>
              {category.status === 'closed' ? 'check_circle' : 'task_alt'}
            </span>
          </button>
        )}
        {onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(category);
            }}
            className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition-colors"
            title="Upravit"
          >
            <span className="material-symbols-outlined text-[16px] text-blue-400">
              edit
            </span>
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(category.id);
            }}
            className="p-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
            title="Smazat"
          >
            <span className="material-symbols-outlined text-[16px] text-red-400">
              delete
            </span>
          </button>
        )}
      </div>

      <div className="flex justify-between w-full items-start mb-2">
        <span
          className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg ${statusColors[status]}`}
        >
          {statusLabels[status]}
        </span>
        <span className="material-symbols-outlined text-slate-600 group-hover:text-emerald-400 transition-colors">
          arrow_forward
        </span>
      </div>

      <h3 className="text-lg font-bold text-white mb-1">
        {category.title}
      </h3>

      {category.deadline &&
        (() => {
          const deadlineDate = new Date(category.deadline);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const daysUntil = Math.ceil(
            (deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
          const isOverdue = daysUntil < 0;
          const isUrgent = daysUntil >= 0 && daysUntil <= 7;

          const colorClass = isOverdue
            ? "text-red-400"
            : isUrgent
              ? "text-orange-400"
              : "text-slate-500";

          return (
            <div
              className={`flex items-center gap-1 text-xs mb-1 ${colorClass}`}
            >
              <span className="material-symbols-outlined text-[14px]">
                event
              </span>
              <span>
                Termín nabídky: {deadlineDate.toLocaleDateString("cs-CZ")}
              </span>
              {isOverdue && <span className="font-bold">(prošlý)</span>}
              {isUrgent && !isOverdue && (
                <span className="font-bold">({daysUntil}d)</span>
              )}
            </div>
          );
        })()}

      {(category.realizationStart || category.realizationEnd) && (
        <div className="flex items-center gap-1 text-xs mb-2 text-purple-400">
          <span className="material-symbols-outlined text-[14px]">
            construction
          </span>
          <span>
            Realizace:{" "}
            {category.realizationStart
              ? new Date(category.realizationStart).toLocaleDateString("cs-CZ")
              : "?"}
            {" - "}
            {category.realizationEnd
              ? new Date(category.realizationEnd).toLocaleDateString("cs-CZ")
              : "?"}
          </span>
        </div>
      )}

      <p className="text-sm text-slate-400 line-clamp-2 mb-4 h-10">
        {category.description}
      </p>

      <div className="flex items-center justify-between w-full mt-auto pt-4 border-t border-slate-700/50">
        <div className="flex flex-col">
          <span className="text-xs text-slate-500">
            {category.winningPrice ? "Vítězná cena" : "Cena SOD (Investor)"}
          </span>
          <span className="text-sm font-semibold text-white">
            {formatMoney(category.winningPrice || category.sodBudget)}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-slate-500">Poptáno</span>
          <div className="flex items-center gap-1 text-sm font-semibold text-white">
            <span className="material-symbols-outlined text-[16px]">
              groups
            </span>
            {bidCount}
          </div>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-slate-500">CN</span>
          <div className="flex items-center gap-1 text-sm font-semibold text-white">
            <span className="material-symbols-outlined text-[16px]">
              description
            </span>
            {priceOfferCount}
          </div>
        </div>
        {category.documents && category.documents.length > 0 && (
          <div className="flex flex-col items-end">
            <span className="text-xs text-slate-500">Dokumenty</span>
            <div className="flex items-center gap-1 text-sm font-semibold text-white">
              <span className="material-symbols-outlined text-[16px]">
                attachment
              </span>
              {category.documents.length}
            </div>
          </div>
        )}
        {/* Contract counter - only show if there are SOD bids */}
        {sodBidsCount > 0 && (
          <div className="flex flex-col items-end">
            <span className="text-xs text-slate-500">Smlouvy</span>
            <div className={`flex items-center gap-1 text-sm font-semibold ${contractedCount === sodBidsCount && sodBidsCount > 0
              ? 'text-yellow-400 animate-pulse'
              : contractedCount > 0
                ? 'text-emerald-400'
                : 'text-slate-400'
              }`}>
              <span className={`material-symbols-outlined text-[16px] ${contractedCount === sodBidsCount && sodBidsCount > 0 ? 'text-yellow-400' : ''
                }`}>
                {contractedCount === sodBidsCount && sodBidsCount > 0 ? 'verified' : 'handshake'}
              </span>
              {contractedCount}/{sodBidsCount}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

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
}

const CreateContactModal: React.FC<{
  initialName: string;
  existingSpecializations: string[];
  statuses: StatusConfig[];
  onClose: () => void;
  onSave: (contact: Subcontractor) => void;
}> = ({ initialName, existingSpecializations, statuses, onClose, onSave }) => {
  const [form, setForm] = useState({
    company: initialName,
    name: "",
    email: "",
    phone: "",
    specializationRaw: "",
    ico: "",
    region: "",
    status: "available",
  });
  const [specializations, setSpecializations] = useState<string[]>([]);

  const handleAddSpec = (spec: string) => {
    const trimmed = spec.trim();
    if (!trimmed) return;
    if (specializations.includes(trimmed)) return;
    setSpecializations([...specializations, trimmed]);
    setForm({ ...form, specializationRaw: "" });
  };

  const handleRemoveSpec = (spec: string) => {
    setSpecializations(specializations.filter(s => s !== spec));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalSpecs = specializations.length > 0 ? specializations : ["Ostatní"];

    const newContact: Subcontractor = {
      id: crypto.randomUUID(),
      company: form.company,
      specialization: finalSpecs,
      contacts: [{
        id: crypto.randomUUID(),
        name: form.name || "-",
        email: form.email || "-",
        phone: form.phone || "-",
        position: "Hlavní kontakt"
      }],
      ico: form.ico || "-",
      region: form.region || "-",
      status: form.status || "available",
      // Mirror legacy fields for compatibility
      name: form.name || "-",
      email: form.email || "-",
      phone: form.phone || "-",
    };
    onSave(newContact);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-700/50 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-700/50 flex justify-between items-center shrink-0">
          <h3 className="text-lg font-bold text-white">
            Nový dodavatel
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Firma / Název *
              </label>
              <input
                required
                type="text"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">
                Specializace / Typ *
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {specializations.map(spec => (
                  <span 
                    key={spec} 
                    className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30"
                  >
                    {spec}
                    <button 
                      type="button" 
                      onClick={() => handleRemoveSpec(spec)}
                      className="hover:text-red-400 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </span>
                ))}
                {specializations.length === 0 && (
                  <span className="text-xs text-slate-500 italic">Přidejte alespoň jednu specializaci</span>
                )}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    list="pipeline-specializations-list"
                    value={form.specializationRaw}
                    onChange={(e) =>
                      setForm({ ...form, specializationRaw: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSpec(form.specializationRaw);
                      }
                      e.stopPropagation();
                    }}
                    className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                    placeholder="Přidat specializaci (Enter)"
                  />
                  <datalist id="pipeline-specializations-list">
                    {existingSpecializations.filter(s => !specializations.includes(s)).map(spec => (
                      <option key={spec} value={spec} />
                    ))}
                  </datalist>
                </div>
                <button
                   type="button"
                   onClick={() => handleAddSpec(form.specializationRaw)}
                   className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-2 rounded-lg transition-colors"
                >
                   <span className="material-symbols-outlined">add</span>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Kontaktní osoba
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Telefon
                </label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  IČO
                </label>
                <input
                  type="text"
                  value={form.ico}
                  onChange={(e) => setForm({ ...form, ico: e.target.value })}
                  className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                  placeholder="12345678"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Region
                </label>
                <input
                  type="text"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                  placeholder="Praha, Brno..."
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Stav
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
              >
                {statuses.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="p-4 bg-slate-800/50 border-t border-slate-700/50 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-slate-300 text-sm font-medium hover:bg-slate-600/50 transition-colors"
            >
              Zrušit
            </button>
            <button
              type="submit"
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl text-sm font-bold shadow-lg transition-all"
            >
              Vytvořit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


export const Pipeline: React.FC<PipelineProps> = ({
  projectId,
  projectDetails,
  bids: initialBids,
  contacts,
  statuses = DEFAULT_STATUSES,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onBidsChange,
  searchQuery = '',
}) => {
  const projectData = projectDetails;
  const [activeCategory, setActiveCategory] = useState<DemandCategory | null>(
    null
  );
  const [demandFilter, setDemandFilter] = useState<'all' | 'open' | 'closed' | 'sod'>('all');
  const [bids, setBids] = useState<Record<string, Bid[]>>(initialBids);
  // const [contacts, setContacts] = useState<Subcontractor[]>(ALL_CONTACTS); // Use prop directly or state if we modify it locally?
  // The component modifies contacts (adding new ones). So we might need state, but initialized from prop.
  // However, App.tsx manages contacts. Ideally we should call a handler to add contact in App.tsx.
  // For now, let's keep local state initialized from prop to minimize refactor,
  // BUT we need to sync back or just rely on the fact that we insert to Supabase and App.tsx might reload?
  // App.tsx doesn't auto-reload contacts on change in child.
  // Let's use the prop for reading, but we need a way to update.
  // The original code had `setContacts`.
  // Let's use a local state initialized from prop for now.
  const [localContacts, setLocalContacts] = useState<Subcontractor[]>(contacts);

  // Track whether the bids change is internal (user action) vs from props
  const isInternalBidsChange = useRef(false);
  // Store pending bids to notify parent after render
  const pendingBidsNotification = useRef<Record<string, Bid[]> | null>(null);

  useEffect(() => {
    setLocalContacts(contacts);
  }, [contacts]);

  useEffect(() => {
    // Only update from props if not an internal change
    if (!isInternalBidsChange.current) {
      setBids(initialBids);
    }
    isInternalBidsChange.current = false;
  }, [initialBids]);

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

  // Reset active category when switching projects
  useEffect(() => {
    setActiveCategory(null);
  }, [projectId]);



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

      // Persist to Supabase
      try {
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

    // Persist to Supabase
    try {
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

      // Persist to Supabase
      try {
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

    if (
      confirm("Opravdu chcete smazat tuto poptávku? Tato akce je nevratná.")
    ) {
      onDeleteCategory(categoryId);
    }
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

    // Persist to Supabase
    try {
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

    // Delete from Supabase
    try {
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

    // Check if using new template system
    if (projectDetails.inquiryLetterLink?.startsWith('template:')) {
      const templateId = projectDetails.inquiryLetterLink.split(':')[1];
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
  const handleEmailLosers = () => {
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

    // Create mailto link with BCC
    const subject = encodeURIComponent(`${projectDetails.title} - ${activeCategory.title} - Výsledek výběrového řízení`);
    const body = encodeURIComponent(
      `Vážený obchodní partnere,\n\n` +
      `děkujeme za Vaši nabídku v rámci výběrového řízení na zakázku "${projectDetails.title}" - ${activeCategory.title}.\n\n` +
      `Po pečlivém zvážení všech nabídek jsme se rozhodli pokračovat s jiným dodavatelem.\n\n` +
      `Věříme, že budeme mít možnost spolupracovat na dalších projektech v budoucnosti.\n\n` +
      `S pozdravem`
    );

    // Open mailto with BCC to all losers
    window.location.href = `mailto:?bcc=${emails.join(',')}&subject=${subject}&body=${body}`;
  };

  const handleSaveNewContact = async (newContact: Subcontractor) => {
    // Optimistic update
    setLocalContacts((prev) => [...prev, newContact]);
    setSelectedSubcontractorIds((prev) => new Set(prev).add(newContact.id));
    setIsCreateContactModalOpen(false);

    // Persist to Supabase
    try {
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
      <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
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
                  onDelete={handleDeleteBid}
                  onGenerateInquiry={handleGenerateInquiry}
                  category={activeCategory}
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
                  onDelete={handleDeleteBid}
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
                  onDelete={handleDeleteBid}
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
                  onDelete={handleDeleteBid}
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
            statuses={statuses}
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
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 min-h-screen">
      <div className="p-6 lg:p-10 overflow-y-auto">
        {/* Filter Buttons and Add Button */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
            <button
              onClick={() => setDemandFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${demandFilter === 'all'
                ? 'bg-slate-700 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              Všechny ({projectData.categories.length})
            </button>
            <button
              onClick={() => setDemandFilter('open')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${demandFilter === 'open'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              Poptávané ({projectData.categories.filter(c => c.status === 'open' || c.status === 'negotiating').length})
            </button>
            <button
              onClick={() => setDemandFilter('closed')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${demandFilter === 'closed'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              Ukončené ({projectData.categories.filter(c => c.status === 'closed').length})
            </button>
            <button
              onClick={() => setDemandFilter('sod')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${demandFilter === 'sod'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
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

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">
              add_home_work
            </span>
            <span className="hidden sm:inline">Nová Poptávka</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...projectData.categories]
            .sort((a, b) => a.title.localeCompare(b.title, 'cs'))
            .filter(cat => {
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
                  const sodBids = catBids.filter(b => b.status === 'sod');
                  const contractedCount = sodBids.filter(b => b.contracted).length;
                  // Check if it has winners and ALL are contracted
                  if (sodBids.length === 0 || sodBids.length !== contractedCount) {
                    return false;
                  }
                } else {
                  return false;
                }
              }
              
              // Then apply search query filter
              if (searchQuery && searchQuery.trim() !== '') {
                const query = searchQuery.toLowerCase();
                const catBids = bids[cat.id] || [];
                const companyNames = catBids.map(b => b.companyName).join(' ').toLowerCase();
                
                // Search in: category title, description, bid company names
                const matches = 
                  cat.title.toLowerCase().includes(query) ||
                  cat.description?.toLowerCase().includes(query) ||
                  companyNames.includes(query);
                
                if (!matches) return false;
              }
              
              return true;
            })
            .map((category) => {
              const categoryBids = bids[category.id] || [];
              const bidCount = categoryBids.length;
              const priceOfferCount = categoryBids.filter(b => b.price && b.price !== '?' && b.price.trim() !== '').length;
              const sodBids = categoryBids.filter(b => b.status === 'sod');
              const sodBidsCount = sodBids.length;
              const contractedCount = sodBids.filter(b => b.contracted).length;

              // Calculate winning price sum
              const winningPrice = sodBids.reduce((sum, bid) => {
                // Parse price assuming it might be formatted text "1 500 000 Kč"
                const numericPrice = typeof bid.price === 'string'
                  ? parseFloat(bid.price.replace(/[^\d]/g, ''))
                  : 0;
                return sum + (isNaN(numericPrice) ? 0 : numericPrice);
              }, 0);

              // Inject winningPrice into category for display (temporary override or extended type)
              const categoryWithPrice = { ...category, winningPrice: winningPrice > 0 ? winningPrice : undefined };

              return (
                <CategoryCard
                  key={category.id}
                  category={categoryWithPrice}
                  bidCount={bidCount}
                  priceOfferCount={priceOfferCount}
                  contractedCount={contractedCount}
                  sodBidsCount={sodBidsCount}
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
            className="flex flex-col items-center justify-center text-center bg-slate-800/30 border-2 border-dashed border-slate-700/50 rounded-2xl p-5 hover:bg-slate-800/50 hover:border-emerald-500/30 transition-all min-h-[200px] group"
          >
            <div className="size-12 rounded-full bg-slate-700/50 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all">
              <span className="material-symbols-outlined text-slate-400 group-hover:text-emerald-400">
                add
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-400 group-hover:text-white transition-colors">
              Vytvořit novou sekci
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Např. Klempířské práce
            </p>
          </button>
        </div>
      </div>

      {/* Create Category Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-700/50 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-700/50 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-white">
                Nová Poptávka / Sekce
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="flex flex-col overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
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
                    className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                    placeholder="Např. Klempířské konstrukce"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
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
                      className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                      placeholder="500 000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
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
                      className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                      placeholder="450 000"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
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
                  <label className="block text-xs font-medium text-slate-400 mb-1">
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
                    className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Termín pro podání cenové nabídky
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
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
                        className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
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
                        className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
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

              <div className="p-4 bg-slate-800/50 border-t border-slate-700/50 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
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
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-700/50 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-700/50 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-white">
                Upravit Poptávku
              </h3>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingCategory(null);
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleEditCategory} className="flex flex-col overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
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
                    className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                    placeholder="Např. Klempířské konstrukce"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
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
                      className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                      placeholder="500 000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
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
                      className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                      placeholder="450 000"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
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
                  <label className="block text-xs font-medium text-slate-400 mb-1">
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
                    className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Termín pro podání cenové nabídky
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
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
                        className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
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
                        className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Předpokládaný termín realizace prací
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-800/50 border-t border-slate-700/50 flex justify-end gap-3 shrink-0">
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
    </div>
  );
};
