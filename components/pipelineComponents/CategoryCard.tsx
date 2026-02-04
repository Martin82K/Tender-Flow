/**
 * CategoryCard Component
 * Card representing a demand category in the pipeline grid.
 * Extracted from Pipeline.tsx for better modularity.
 */

import React from "react";
import { DemandCategory } from "../../types";
import { formatMoney } from "../../utils/formatters";

export interface CategoryCardProps {
  category: DemandCategory;
  bidCount: number;
  priceOfferCount: number;
  contractedCount: number;
  sodBidsCount: number;
  onClick: () => void;
  onEdit?: (category: DemandCategory) => void;
  onDelete?: (categoryId: string) => void;
  onToggleComplete?: (category: DemandCategory) => void;
}

const statusColors = {
  open: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  negotiating: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  closed: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  sod: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
};

const statusLabels = {
  open: "Poptávání",
  negotiating: "Vyjednávání",
  closed: "Uzavřeno",
  sod: "V Realizaci",
};

export const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  bidCount,
  priceOfferCount,
  contractedCount,
  sodBidsCount,
  onClick,
  onEdit,
  onDelete,
  onToggleComplete,
}) => {
  const status =
    category.status === "sod"
      ? "sod"
      : category.status === "closed"
        ? "closed"
        : category.status === "negotiating"
          ? "negotiating"
          : "open";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="flex flex-col text-left bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-5 hover:shadow-lg dark:hover:shadow-xl hover:border-emerald-500/30 transition-all group relative overflow-hidden h-full cursor-pointer"
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
            className={`p-1.5 ${category.status === "closed" ? "bg-emerald-500/20 hover:bg-emerald-500/30" : "bg-slate-700/50 hover:bg-slate-600/50"} rounded-lg transition-colors`}
            title={
              category.status === "closed"
                ? "Označit jako otevřenou"
                : "Označit jako ukončenou"
            }
          >
            <span
              className={`material-symbols-outlined text-[16px] ${category.status === "closed" ? "text-emerald-400" : "text-slate-400"}`}
            >
              {category.status === "closed" ? "check_circle" : "task_alt"}
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

      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
        {category.title}
      </h3>

      {category.deadline &&
        (() => {
          const deadlineDate = new Date(category.deadline);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const daysUntil = Math.ceil(
            (deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
          );
          const isOverdue = daysUntil < 0;
          const isUrgent = daysUntil >= 0 && daysUntil <= 7;
          const colorClass = isOverdue
            ? "text-red-400"
            : isUrgent
              ? "text-orange-400"
              : "text-orange-400";

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
              {isOverdue && status !== "closed" && status !== "sod" && (
                <span className="font-bold">(prošlý)</span>
              )}
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

      <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 h-10">
        {category.description}
      </p>

      <div className="flex items-center justify-between w-full mt-auto pt-4 border-t border-slate-200 dark:border-slate-700/50">
        <div className="flex flex-col">
          <span className="text-xs text-slate-500">
            {category.winningPrice ? "Vítězná cena" : "Cena SOD (Investor)"}
          </span>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            {formatMoney(category.winningPrice || category.sodBudget)}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-slate-500">Poptáno</span>
          <div className="flex items-center gap-1 text-sm font-semibold text-slate-900 dark:text-white">
            <span className="material-symbols-outlined text-[16px]">
              groups
            </span>
            {bidCount}
          </div>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-slate-500">CN</span>
          <div className="flex items-center gap-1 text-sm font-semibold text-slate-900 dark:text-white">
            <span className="material-symbols-outlined text-[16px]">
              description
            </span>
            {priceOfferCount}
          </div>
        </div>
        {category.documents && category.documents.length > 0 && (
          <div className="flex flex-col items-end">
            <span className="text-xs text-slate-500">Dokumenty</span>
            <div className="flex items-center gap-1 text-sm font-semibold text-slate-900 dark:text-white">
              <span className="material-symbols-outlined text-[16px]">
                attachment
              </span>
              {category.documents.length}
            </div>
          </div>
        )}
        {sodBidsCount > 0 && (
          <div className="flex flex-col items-end">
            <span className="text-xs text-slate-500">Smlouvy</span>
            <div
              className={`flex items-center gap-1 text-sm font-semibold ${
                contractedCount === sodBidsCount && sodBidsCount > 0
                  ? "text-yellow-400 animate-pulse"
                  : contractedCount > 0
                    ? "text-emerald-400"
                    : "text-slate-400"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[16px] ${
                  contractedCount === sodBidsCount && sodBidsCount > 0
                    ? "text-yellow-400"
                    : ""
                }`}
              >
                {contractedCount === sodBidsCount && sodBidsCount > 0
                  ? "verified"
                  : "handshake"}
              </span>
              {contractedCount}/{sodBidsCount}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
