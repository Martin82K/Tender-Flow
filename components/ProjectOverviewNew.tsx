import React from "react";
import type { ProjectDetails } from "../types";
import { useAuth } from "../context/AuthContext";
import {
  formatMoney,
  formatMoneyFull,
  getWinningBidTotal,
  getWinningBids,
} from "@/features/projects/model/projectOverviewNewModel";
import { useProjectOverviewNewController } from "@/features/projects/model/useProjectOverviewNewController";

interface ProjectOverviewProps {
  project: ProjectDetails;
  onUpdate: (updates: Partial<ProjectDetails>) => void;
  variant?: "full" | "compact";
  searchQuery?: string;
  onNavigateToPipeline?: (categoryId: string) => void;
}

export const ProjectOverviewNew: React.FC<ProjectOverviewProps> = ({
  project,
  onUpdate,
  variant = "full",
  searchQuery = "",
  onNavigateToPipeline,
}) => {
  const { user } = useAuth();
  const {
    contract,
    investor,
    plannedCost,
    editingInfo,
    setEditingInfo,
    editingContract,
    setEditingContract,
    editingInvestor,
    setEditingInvestor,
    editingInternal,
    setEditingInternal,
    demandFilter,
    setDemandFilter,
    visibleColumns,
    toggleColumn,
    infoForm,
    setInfoForm,
    contractForm,
    setContractForm,
    investorForm,
    setInvestorForm,
    internalForm,
    setInternalForm,
    totalBudget,
    totalContractedCost,
    completedTasks,
    plannedBalance,
    progress,
    handleSaveInfo,
    handleSaveContract,
    handleSaveInvestor,
    handleSaveInternal,
    addAmendment,
    updateAmendment,
    removeAmendment,
    filteredCategories,
    sodCount,
    openCount,
    closedCount,
    allCount,
    totalSodBudget,
    totalPlanBudget,
    totalWinningBidCost,
    totalSodDiff,
    totalPlanDiff,
  } = useProjectOverviewNewController({
    project,
    onUpdate,
    userId: user?.id,
    searchQuery,
  });

  const formatEditableNumber = (value: number): string =>
    new Intl.NumberFormat("cs-CZ", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value || 0);

  const parseEditableNumber = (value: string): number => {
    const normalized = value
      .replace(/\u00A0/g, " ")
      .replace(/\s/g, "")
      .replace(",", ".")
      .replace(/[^0-9.-]/g, "");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const [compactInvestorSodInput, setCompactInvestorSodInput] = React.useState("");
  const [compactAmendmentPriceInputs, setCompactAmendmentPriceInputs] =
    React.useState<Record<string, string>>({});
  const [compactInternalPlannedCostInput, setCompactInternalPlannedCostInput] =
    React.useState("");

  const amendmentsCount = investor.amendments.length;
  const amendmentsTotal = investor.amendments.reduce(
    (sum, amendment) => sum + (amendment.price || 0),
    0,
  );

  React.useEffect(() => {
    if (!editingInvestor) return;
    setCompactInvestorSodInput(formatEditableNumber(investorForm.sodPrice || 0));
    setCompactAmendmentPriceInputs(
      Object.fromEntries(
        investorForm.amendments.map((amendment) => [
          amendment.id,
          formatEditableNumber(amendment.price || 0),
        ]),
      ),
    );
  }, [editingInvestor, investorForm.sodPrice, investorForm.amendments]);

  React.useEffect(() => {
    if (!editingInternal) return;
    setCompactInternalPlannedCostInput(
      formatEditableNumber(internalForm.plannedCost || 0),
    );
  }, [editingInternal, internalForm.plannedCost]);

  const renderCompactDetails = () => (
    <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-6 shadow-sm">
      <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-xl">
          info
        </span>
        Základní informace o stavbě
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 text-sm">
        {/* 1. Investor & Info */}
        <div className="lg:col-span-1 border-r border-slate-200 dark:border-slate-800/50 pr-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">
              Údaje o stavbě
            </span>
            <button
              onClick={() => setEditingInfo(true)}
              className="text-slate-400 hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">
                edit
              </span>
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-500 text-xs">
                Investor:
              </span>
              <span className="text-slate-900 dark:text-slate-200 font-bold text-xs truncate ml-2">
                {project.investor || "-"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-500 text-xs">
                Lokace:
              </span>
              <span className="text-slate-900 dark:text-slate-200 font-bold text-xs truncate ml-2">
                {project.location || "-"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-500 text-xs">
                Termín:
              </span>
              <span className="text-slate-900 dark:text-slate-200 font-bold text-xs truncate ml-2">
                {project.finishDate || "-"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-500 text-xs">
                Hl. stavbyvedoucí:
              </span>
              <span className="text-slate-900 dark:text-slate-200 font-bold text-xs truncate ml-2">
                {project.siteManager || "-"}
              </span>
            </div>
          </div>
          {editingInfo && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-fadeIn">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
                  Upravit informace
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-500 font-bold mb-1.5 block">
                      Investor
                    </label>
                    <input
                      value={infoForm.investor}
                      onChange={(e) =>
                        setInfoForm({ ...infoForm, investor: e.target.value })
                      }
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-bold mb-1.5 block">
                      Lokace
                    </label>
                    <input
                      value={infoForm.location}
                      onChange={(e) =>
                        setInfoForm({ ...infoForm, location: e.target.value })
                      }
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-bold mb-1.5 block">
                      Termín
                    </label>
                    <input
                      value={infoForm.finishDate}
                      onChange={(e) =>
                        setInfoForm({ ...infoForm, finishDate: e.target.value })
                      }
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-bold mb-1.5 block">
                      Hl. stavbyvedoucí
                    </label>
                    <input
                      value={infoForm.siteManager}
                      onChange={(e) =>
                        setInfoForm({
                          ...infoForm,
                          siteManager: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => setEditingInfo(false)}
                      className="px-4 py-2 text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium transition-colors text-sm"
                    >
                      Zrušit
                    </button>
                    <button
                      onClick={handleSaveInfo}
                      className="px-6 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all active:scale-95 text-sm"
                    >
                      Uložit změny
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. Financials (Investor) */}
        <div className="lg:col-span-1 border-r border-slate-200 dark:border-slate-800/50 pr-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">
              Finance (Investor)
            </span>
            <button
              onClick={() => setEditingInvestor(true)}
              className="text-slate-400 hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">
                edit
              </span>
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-500 text-xs">
                SOD Cena:
              </span>
              <span className="text-slate-900 dark:text-slate-200 font-bold text-xs">
                {formatMoney(investor.sodPrice)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-500 text-xs">
                Počet dodatků:
              </span>
              <span className="text-slate-900 dark:text-slate-200 font-bold text-xs">
                {amendmentsCount}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-500 text-xs">
                Dodatky celkem:
              </span>
              <span className="text-slate-900 dark:text-slate-200 font-bold text-xs">
                {formatMoney(amendmentsTotal)}
              </span>
            </div>
            <div className="h-px bg-slate-200 dark:bg-slate-800 my-1"></div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span className="font-extrabold text-xs">Celkem:</span>
              <span className="font-extrabold text-xs">
                {formatMoney(totalBudget)}
              </span>
            </div>
          </div>
          {editingInvestor && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl animate-fadeIn">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
                  Upravit finance investora
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-500 font-bold mb-1.5 block">
                      Základní cena SOD
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={compactInvestorSodInput}
                      onChange={(e) => {
                        setCompactInvestorSodInput(e.target.value);
                        setInvestorForm({
                          ...investorForm,
                          sodPrice: parseEditableNumber(e.target.value),
                        });
                      }}
                      onBlur={() =>
                        setCompactInvestorSodInput(
                          formatEditableNumber(investorForm.sodPrice || 0),
                        )
                      }
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm text-right tabular-nums focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800">
                    <div className="flex justify-between gap-2">
                      <span className="text-xs text-slate-500">Počet dodatků</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {investorForm.amendments.length}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-xs text-slate-500">Dodatky celkem</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {formatMoney(
                          investorForm.amendments.reduce(
                            (sum, amendment) => sum + (amendment.price || 0),
                            0,
                          ),
                        )}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-bold mb-1.5 block">
                      Dodatky
                    </label>
                    <div className="space-y-2">
                      {investorForm.amendments.map((amendment, idx) => (
                        <div
                          key={amendment.id}
                          className="flex gap-2 items-center"
                        >
                          <input
                            type="text"
                            value={amendment.label}
                            onChange={(e) =>
                              updateAmendment(idx, "label", e.target.value)
                            }
                            className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                            placeholder="Název dodatku"
                          />
                          <input
                            type="text"
                            inputMode="decimal"
                            value={
                              compactAmendmentPriceInputs[amendment.id] ??
                              formatEditableNumber(amendment.price || 0)
                            }
                            onChange={(e) => {
                              setCompactAmendmentPriceInputs((prev) => ({
                                ...prev,
                                [amendment.id]: e.target.value,
                              }));
                              updateAmendment(
                                idx,
                                "price",
                                parseEditableNumber(e.target.value),
                              );
                            }}
                            onBlur={() =>
                              setCompactAmendmentPriceInputs((prev) => ({
                                ...prev,
                                [amendment.id]: formatEditableNumber(
                                  investorForm.amendments[idx]?.price || 0,
                                ),
                              }))
                            }
                            className="w-40 md:w-48 shrink-0 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white text-right tabular-nums"
                          />
                          <button
                            onClick={() => removeAmendment(idx)}
                            className="text-red-500 hover:text-red-600 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              delete
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={addAmendment}
                      className="mt-2 text-xs flex items-center gap-1 text-primary hover:text-primary-dark transition-colors font-medium"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        add
                      </span>
                      Přidat dodatek
                    </button>
                  </div>
                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => setEditingInvestor(false)}
                      className="px-4 py-2 text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium transition-colors text-sm"
                    >
                      Zrušit
                    </button>
                    <button
                      onClick={handleSaveInvestor}
                      className="px-6 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all active:scale-95 text-sm"
                    >
                      Uložit změny
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. Internal Budget */}
        <div className="lg:col-span-1 border-r border-slate-200 dark:border-slate-800/50 pr-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">
              Interní Rozpočet
            </span>
            <button
              onClick={() => setEditingInternal(true)}
              className="text-slate-400 hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">
                edit
              </span>
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-500 text-xs">
                Plán (Cíl):
              </span>
              <span className="text-slate-900 dark:text-slate-200 font-bold text-xs">
                {plannedCost > 0 ? formatMoney(plannedCost) : "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-500 text-xs">
                Zasmluvněno:
              </span>
              <span className="text-slate-900 dark:text-slate-200 font-bold text-xs">
                {formatMoney(totalContractedCost)}
              </span>
            </div>
            <div className="h-px bg-slate-200 dark:bg-slate-800 my-1"></div>
            <div className="flex justify-between">
              <span
                className={`font-extrabold text-xs ${plannedBalance >= 0 ? "text-emerald-500" : "text-rose-500"}`}
              >
                Rezerva:
              </span>
              <span
                className={`font-extrabold text-xs ${plannedBalance >= 0 ? "text-emerald-500" : "text-rose-500"}`}
              >
                {plannedBalance >= 0 ? "+" : ""}
                {formatMoney(plannedBalance)}
              </span>
            </div>
          </div>
          {editingInternal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl animate-fadeIn">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
                  Upravit interní rozpočet
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-500 font-bold mb-1.5 block">
                      Plánovaný náklad (Cíl)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={compactInternalPlannedCostInput}
                      onChange={(e) => {
                        setCompactInternalPlannedCostInput(e.target.value);
                        setInternalForm({
                          ...internalForm,
                          plannedCost: parseEditableNumber(e.target.value),
                        });
                      }}
                      onBlur={() =>
                        setCompactInternalPlannedCostInput(
                          formatEditableNumber(internalForm.plannedCost || 0),
                        )
                      }
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm text-right tabular-nums focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => setEditingInternal(false)}
                      className="px-4 py-2 text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium transition-colors text-sm"
                    >
                      Zrušit
                    </button>
                    <button
                      onClick={handleSaveInternal}
                      className="px-6 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all active:scale-95 text-sm"
                    >
                      Uložit změny
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* 4. Contract Parameters (Restored & Restructured) */}
        <div className="lg:col-span-1 border-r border-slate-200 dark:border-slate-800/50 pr-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">
              Parametry smlouvy
            </span>
            <button
              onClick={() => setEditingContract(true)}
              className="text-slate-400 hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">
                edit
              </span>
            </button>
          </div>
          <div className="space-y-4">
            {/* Subsection 1: Time Parameters */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-extrabold uppercase text-slate-400 dark:text-slate-600 tracking-wider mb-1">
                Časové parametry
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-500 text-xs">
                  Splatnost:
                </span>
                <span className="text-slate-900 dark:text-slate-200 font-bold text-xs truncate ml-2">
                  {contract?.maturity || 0} dní
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-500 text-xs">
                  Záruka:
                </span>
                <span className="text-slate-900 dark:text-slate-200 font-bold text-xs truncate ml-2">
                  {contract?.warranty || 0} měsíců
                </span>
              </div>
            </div>

            <div className="h-px bg-slate-200 dark:bg-slate-800/50"></div>

            {/* Subsection 2: Financial Conditions */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-extrabold uppercase text-slate-400 dark:text-slate-600 tracking-wider mb-1">
                Finanční podmínky
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-500 text-xs">
                  Pozastávka:
                </span>
                <span className="text-slate-900 dark:text-slate-200 font-bold text-xs truncate ml-2">
                  {contract?.retention || "-"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-500 text-xs">
                  Zař. staveniště:
                </span>
                <span className="text-slate-900 dark:text-slate-200 font-bold text-xs truncate ml-2">
                  {contract?.siteFacilities || 0} %
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-500 text-xs">
                  Pojištění:
                </span>
                <span className="text-slate-900 dark:text-slate-200 font-bold text-xs truncate ml-2">
                  {contract?.insurance || 0} %
                </span>
              </div>
            </div>
          </div>
          {editingContract && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl animate-fadeIn">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
                  Upravit parametry smlouvy
                </h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 items-center">
                    <label className="text-xs text-slate-500">
                      Splatnost (dní)
                    </label>
                    <input
                      type="number"
                      value={contractForm.maturity}
                      onChange={(e) =>
                        setContractForm({
                          ...contractForm,
                          maturity: parseInt(e.target.value) || 0,
                        })
                      }
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white text-right"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 items-center">
                    <label className="text-xs text-slate-500">
                      Záruka (měsíců)
                    </label>
                    <input
                      type="number"
                      value={contractForm.warranty}
                      onChange={(e) =>
                        setContractForm({
                          ...contractForm,
                          warranty: parseInt(e.target.value) || 0,
                        })
                      }
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white text-right"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 items-center">
                    <label className="text-xs text-slate-500">Pozastávka</label>
                    <input
                      type="text"
                      value={contractForm.retention}
                      onChange={(e) =>
                        setContractForm({
                          ...contractForm,
                          retention: e.target.value,
                        })
                      }
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white text-right"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 items-center">
                    <label className="text-xs text-slate-500">
                      Zař. staveniště (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={contractForm.siteFacilities}
                      onChange={(e) =>
                        setContractForm({
                          ...contractForm,
                          siteFacilities: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white text-right"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 items-center">
                    <label className="text-xs text-slate-500">
                      Pojištění (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={contractForm.insurance}
                      onChange={(e) =>
                        setContractForm({
                          ...contractForm,
                          insurance: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white text-right"
                    />
                  </div>
                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => setEditingContract(false)}
                      className="px-4 py-2 text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium transition-colors text-sm"
                    >
                      Zrušit
                    </button>
                    <button
                      onClick={handleSaveContract}
                      className="px-6 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all active:scale-95 text-sm"
                    >
                      Uložit změny
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* 4. Progress */}
        <div className="lg:col-span-1">
          <div className="flex justify-between items-center mb-4">
            <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">
              Postup
            </span>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-end mb-1">
              <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-tighter">
                Zasmluvněné subdodávky
              </span>
              <span className="text-primary text-sm font-black">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary-light transition-all duration-1000 ease-out shadow-sm"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              Dokončeno {completedTasks} z {project.categories.length} kategorií
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 w-full bg-slate-50 dark:bg-slate-950 animate-fadeIn">
      {/* Top Row: 4 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 1. Rozpočet (Investor) */}
        <div className="bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-6 relative overflow-hidden group shadow-sm hover:shadow-md transition-all">
          <div className="absolute -top-4 -right-4 size-24 bg-blue-500/5 rounded-full group-hover:scale-125 transition-transform duration-500" />
          <div className="flex flex-col h-full justify-between relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-500">
                <span className="material-symbols-outlined text-2xl">
                  account_balance_wallet
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-extrabold">
                Rozpočet
              </span>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-2">
                {formatMoneyFull(totalBudget)}
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                Celkový příjem od investora
              </p>
            </div>
          </div>
        </div>

        {/* 2. Plánovaný Náklad */}
        <div className="bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-6 relative overflow-hidden group shadow-sm hover:shadow-md transition-all">
          <div className="absolute -top-4 -right-4 size-24 bg-indigo-500/5 rounded-full group-hover:scale-125 transition-transform duration-500" />
          <div className="flex flex-col h-full justify-between relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-500">
                <span className="material-symbols-outlined text-2xl">
                  analytics
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-extrabold">
                Plán nákladů
              </span>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-2">
                {plannedCost > 0 ? formatMoneyFull(plannedCost) : "-"}
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                Interní cílový náklad stavby
              </p>
            </div>
          </div>
        </div>

        {/* 3. Zasmluvněno */}
        <div className="bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-6 relative overflow-hidden group shadow-sm hover:shadow-md transition-all">
          <div className="absolute -top-4 -right-4 size-24 bg-emerald-500/5 rounded-full group-hover:scale-125 transition-transform duration-500" />
          <div className="flex flex-col h-full justify-between relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-500">
                <span className="material-symbols-outlined text-2xl">
                  handshake
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-extrabold">
                Zasmluvněno
              </span>
            </div>
            <div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight leading-none mb-2">
                {formatMoneyFull(totalContractedCost)}
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`size-1.5 rounded-full ${plannedBalance >= 0 ? "bg-emerald-500" : "bg-rose-500"}`}
                ></span>
                <p
                  className={`text-[10px] font-bold ${plannedBalance >= 0 ? "text-emerald-600" : "text-rose-500"}`}
                >
                  Rezerva: {plannedBalance >= 0 ? "+" : ""}
                  {formatMoneyFull(plannedBalance)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Postup Zadávání */}
        <div className="bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-6 relative overflow-hidden group shadow-sm hover:shadow-md transition-all">
          <div className="absolute -top-4 -right-4 size-24 bg-amber-500/5 rounded-full group-hover:scale-125 transition-transform duration-500" />
          <div className="flex flex-col h-full justify-between relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-1.5 rounded-full border-4 border-amber-500/20 border-t-amber-500 size-10 flex items-center justify-center">
                <span className="text-[10px] font-black text-amber-500">
                  {Math.round(
                    (completedTasks / project.categories.length) * 100,
                  )}
                  %
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-extrabold">
                Postup VŘ
              </span>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-2">
                {completedTasks} / {project.categories.length}
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                Hotové subdodavatelské balíčky
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard Grid: Conditional Render */}
      {variant === "compact" ? (
        renderCompactDetails()
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Informace o stavbě */}
          <div className="flex flex-col">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-full">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Informace o stavbě
                </h3>
                {!editingInfo ? (
                  <button
                    onClick={() => setEditingInfo(true)}
                    className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">
                      edit
                    </span>
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveInfo}
                      className="text-emerald-400 hover:text-emerald-300"
                    >
                      <span className="material-symbols-outlined text-sm">
                        check
                      </span>
                    </button>
                    <button
                      onClick={() => setEditingInfo(false)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <span className="material-symbols-outlined text-sm">
                        close
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {!editingInfo ? (
                <div className="space-y-3">
                  {[
                    {
                      label: "Investor",
                      value: project.investor,
                      icon: "corporate_fare",
                      color: "text-blue-500",
                      bg: "bg-blue-500/10",
                    },
                    {
                      label: "Technický dozor",
                      value: project.technicalSupervisor,
                      icon: "visibility",
                      color: "text-violet-500",
                      bg: "bg-violet-500/10",
                    },
                    {
                      label: "Lokace",
                      value: project.location,
                      icon: "location_on",
                      color: "text-emerald-500",
                      bg: "bg-emerald-500/10",
                    },
                    {
                      label: "Termín dokončení",
                      value: project.finishDate,
                      icon: "calendar_today",
                      color: "text-orange-500",
                      bg: "bg-orange-500/10",
                    },
                    {
                      label: "Hlavní stavbyvedoucí",
                      value: project.siteManager,
                      icon: "person",
                      color: "text-cyan-500",
                      bg: "bg-cyan-500/10",
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-slate-100 dark:border-slate-800/50 group-hover:bg-white dark:group-hover:bg-slate-900 transition-all"
                    >
                      <div
                        className={`p-2 ${item.bg} ${item.color} rounded-xl`}
                      >
                        <span className="material-symbols-outlined text-lg">
                          {item.icon}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] uppercase text-slate-400 font-extrabold tracking-widest leading-none mb-1">
                          {item.label}
                        </div>
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-200 truncate">
                          {item.value || "—"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Edit Form for Info */}
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">
                      Investor
                    </label>
                    <input
                      type="text"
                      value={infoForm.investor}
                      onChange={(e) =>
                        setInfoForm({ ...infoForm, investor: e.target.value })
                      }
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">
                      Technický dozor
                    </label>
                    <input
                      type="text"
                      value={infoForm.technicalSupervisor}
                      onChange={(e) =>
                        setInfoForm({
                          ...infoForm,
                          technicalSupervisor: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                    />
                  </div>
                  <div className="h-px bg-slate-800 my-1"></div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">
                      Lokace
                    </label>
                    <input
                      type="text"
                      value={infoForm.location}
                      onChange={(e) =>
                        setInfoForm({ ...infoForm, location: e.target.value })
                      }
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">
                      Termín dokončení
                    </label>
                    <input
                      type="text"
                      value={infoForm.finishDate}
                      onChange={(e) =>
                        setInfoForm({ ...infoForm, finishDate: e.target.value })
                      }
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">
                      Hlavní stavbyvedoucí
                    </label>
                    <input
                      type="text"
                      value={infoForm.siteManager}
                      onChange={(e) =>
                        setInfoForm({
                          ...infoForm,
                          siteManager: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">
                      Stavbyvedoucí
                    </label>
                    <input
                      type="text"
                      value={infoForm.constructionManager}
                      onChange={(e) =>
                        setInfoForm({
                          ...infoForm,
                          constructionManager: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">
                      Stavební technik
                    </label>
                    <input
                      type="text"
                      value={infoForm.constructionTechnician}
                      onChange={(e) =>
                        setInfoForm({
                          ...infoForm,
                          constructionTechnician: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Financials */}
          <div className="flex flex-col gap-6">
            {/* Smlouva s investorem */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400">
                    account_balance_wallet
                  </span>
                  Smlouva s investorem
                </h3>
                {!editingInvestor ? (
                  <button
                    onClick={() => setEditingInvestor(true)}
                    className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">
                      edit
                    </span>
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveInvestor}
                      className="text-emerald-400 hover:text-emerald-300"
                    >
                      <span className="material-symbols-outlined text-sm">
                        check
                      </span>
                    </button>
                    <button
                      onClick={() => setEditingInvestor(false)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <span className="material-symbols-outlined text-sm">
                        close
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {!editingInvestor ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2.5 px-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-slate-800/50">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] font-extrabold uppercase tracking-widest">
                      SOD Základ
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white text-xs">
                      {formatMoneyFull(investor.sodPrice)}
                    </span>
                  </div>

                  {investor.amendments.map((amendment, idx) => (
                    <div
                      key={amendment.id}
                      className="flex justify-between items-center py-2.5 px-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-slate-800/50"
                    >
                      <span className="text-slate-500 dark:text-slate-400 text-[10px] font-extrabold uppercase tracking-widest truncate max-w-[140px]">
                        {amendment.label}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white text-xs">
                        {formatMoneyFull(amendment.price)}
                      </span>
                    </div>
                  ))}

                  <div className="flex justify-between items-center pt-4 px-3">
                    <span className="text-slate-900 dark:text-white text-[11px] font-black uppercase tracking-widest">
                      CELKEM
                    </span>
                    <span className="text-base font-black text-emerald-500">
                      {formatMoneyFull(totalBudget)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">
                      Základní cena SOD
                    </label>
                    <input
                      type="number"
                      value={investorForm.sodPrice}
                      onChange={(e) =>
                        setInvestorForm({
                          ...investorForm,
                          sodPrice: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-2 text-sm text-white font-semibold text-right"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500 mb-1 block">
                      Dodatky
                    </label>
                    {investorForm.amendments.map((amendment, idx) => (
                      <div
                        key={amendment.id}
                        className="flex gap-2 items-center"
                      >
                        <input
                          type="text"
                          value={amendment.label}
                          onChange={(e) =>
                            updateAmendment(idx, "label", e.target.value)
                          }
                          className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-sm text-white"
                          placeholder="Název"
                        />
                        <input
                          type="number"
                          value={amendment.price}
                          onChange={(e) =>
                            updateAmendment(
                              idx,
                              "price",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="w-28 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-sm text-white text-right"
                        />
                        <button
                          onClick={() => removeAmendment(idx)}
                          className="text-red-400 hover:text-red-600"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            delete
                          </span>
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={addAmendment}
                      className="text-xs flex items-center gap-1 text-emerald-400 hover:text-emerald-300 mt-2 font-medium"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        add
                      </span>
                      Přidat dodatek
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Interní Rozpočet */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-400">
                    savings
                  </span>
                  Interní Rozpočet
                </h3>
                {!editingInternal ? (
                  <button
                    onClick={() => setEditingInternal(true)}
                    className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">
                      edit
                    </span>
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveInternal}
                      className="text-emerald-400 hover:text-emerald-300"
                    >
                      <span className="material-symbols-outlined text-sm">
                        check
                      </span>
                    </button>
                    <button
                      onClick={() => setEditingInternal(false)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <span className="material-symbols-outlined text-sm">
                        close
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {!editingInternal ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2.5 px-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-slate-800/50">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] font-extrabold uppercase tracking-widest">
                      Plánovaný náklad
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white text-xs">
                      {plannedCost > 0
                        ? formatMoneyFull(plannedCost)
                        : "Nezadáno"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 px-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-slate-800/50">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] font-extrabold uppercase tracking-widest">
                      Zasmluvněno
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white text-xs">
                      {formatMoneyFull(totalContractedCost)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-4 px-3">
                    <span className="text-slate-900 dark:text-white text-[11px] font-black uppercase tracking-widest">
                      AKTUÁLNÍ REZERVA
                    </span>
                    <span
                      className={`text-base font-black ${plannedBalance >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                    >
                      {plannedBalance >= 0 ? "+" : ""}
                      {formatMoneyFull(plannedBalance)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">
                      Plánovaný náklad (Cíl)
                    </label>
                    <input
                      type="number"
                      value={internalForm.plannedCost}
                      onChange={(e) =>
                        setInternalForm({
                          ...internalForm,
                          plannedCost: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-3 py-2 text-sm text-slate-900 dark:text-white font-semibold text-right focus:border-emerald-500/50 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Contract Parameters */}
          <div className="flex flex-col">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-full">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-400">
                    gavel
                  </span>
                  Parametry smlouvy
                </h3>
                {contract && !editingContract ? (
                  <button
                    onClick={() => setEditingContract(true)}
                    className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">
                      edit
                    </span>
                  </button>
                ) : (
                  contract && (
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveContract}
                        className="text-emerald-400 hover:text-emerald-300"
                      >
                        <span className="material-symbols-outlined text-sm">
                          check
                        </span>
                      </button>
                      <button
                        onClick={() => setEditingContract(false)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <span className="material-symbols-outlined text-sm">
                          close
                        </span>
                      </button>
                    </div>
                  )
                )}
              </div>

              {contract && !editingContract ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2.5 px-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-slate-800/50">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] font-extrabold uppercase tracking-widest">
                      Splatnost
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white text-xs">
                      {contract.maturity} dní
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 px-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-slate-800/50">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] font-extrabold uppercase tracking-widest">
                      Záruka
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white text-xs">
                      {contract.warranty} měsíců
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 px-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-slate-800/50">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] font-extrabold uppercase tracking-widest">
                      Pozastávka
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white text-xs">
                      {contract.retention}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 px-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-slate-800/50">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] font-extrabold uppercase tracking-widest">
                      Zařízení staveniště
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white text-xs">
                      {contract.siteFacilities} %
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 px-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-slate-800/50">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] font-extrabold uppercase tracking-widest">
                      Pojištění
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white text-xs">
                      {contract.insurance} %
                    </span>
                  </div>
                </div>
              ) : contract ? (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2 items-center">
                    <label className="text-xs text-slate-500">
                      Splatnost (dní)
                    </label>
                    <input
                      type="number"
                      value={contractForm.maturity}
                      onChange={(e) =>
                        setContractForm({
                          ...contractForm,
                          maturity: parseInt(e.target.value) || 0,
                        })
                      }
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-sm text-slate-900 dark:text-white text-right"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 items-center">
                    <label className="text-xs text-slate-500">
                      Záruka (měsíců)
                    </label>
                    <input
                      type="number"
                      value={contractForm.warranty}
                      onChange={(e) =>
                        setContractForm({
                          ...contractForm,
                          warranty: parseInt(e.target.value) || 0,
                        })
                      }
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-sm text-slate-900 dark:text-white text-right"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 items-center">
                    <label className="text-xs text-slate-500">Pozastávka</label>
                    <input
                      type="text"
                      value={contractForm.retention}
                      onChange={(e) =>
                        setContractForm({
                          ...contractForm,
                          retention: e.target.value,
                        })
                      }
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-sm text-slate-900 dark:text-white text-right"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 items-center">
                    <label className="text-xs text-slate-500">
                      Zař. staveniště (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={contractForm.siteFacilities}
                      onChange={(e) =>
                        setContractForm({
                          ...contractForm,
                          siteFacilities: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-sm text-slate-900 dark:text-white text-right"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 items-center">
                    <label className="text-xs text-slate-500">
                      Pojištění (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={contractForm.insurance}
                      onChange={(e) =>
                        setContractForm({
                          ...contractForm,
                          insurance: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-sm text-slate-900 dark:text-white text-right"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Demand Categories Overview Table */}
      {project.categories.length > 0 && (
            <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-3xl mt-8 shadow-sm">
              <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-800/50 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl text-primary">
                    <span className="material-symbols-outlined text-2xl">
                      table_chart
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white leading-none mb-1">
                      Přehled Poptávek
                    </h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                      Detailní rozpis balíčků
                    </p>
                  </div>
                </div>

                {/* Filter Buttons */}
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950/50 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => setDemandFilter("all")}
                    className={`px-4 py-2 text-[11px] font-black uppercase tracking-tighter rounded-xl transition-all ${
                      demandFilter === "all"
                        ? "bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Vše ({allCount})
                  </button>
                  <button
                    onClick={() => setDemandFilter("open")}
                    className={`px-4 py-2 text-[11px] font-black uppercase tracking-tighter rounded-xl transition-all ${
                      demandFilter === "open"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Poptávané ({openCount})
                  </button>
                  <button
                    onClick={() => setDemandFilter("closed")}
                    className={`px-4 py-2 text-[11px] font-black uppercase tracking-tighter rounded-xl transition-all ${
                      demandFilter === "closed"
                        ? "bg-teal-500/10 text-teal-600 dark:text-teal-400 ring-1 ring-teal-500/20"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Ukončené ({closedCount})
                  </button>
                  <button
                    onClick={() => setDemandFilter("sod")}
                    className={`px-4 py-2 text-[11px] font-black uppercase tracking-tighter rounded-xl transition-all ${
                      demandFilter === "sod"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Zasmluvněné ({sodCount})
                  </button>

                  {/* Column Visibility Dropdown */}
                  <div className="relative group/columns">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl border border-slate-200 dark:border-slate-800 transition-colors shadow-sm text-[11px] font-black uppercase tracking-tighter">
                      <span className="material-symbols-outlined text-lg">
                        view_column
                      </span>
                      Sloupce
                    </button>

                    <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-3 opacity-0 invisible group-hover/columns:opacity-100 group-hover/columns:visible transition-all z-20">
                      <div className="text-[10px] uppercase font-bold text-slate-400 mb-2 px-2">
                        Zobrazit sloupce
                      </div>
                      <div className="space-y-1">
                        {[
                          { id: "sod", label: "SOD (Cena)" },
                          { id: "plan", label: "Plán" },
                          { id: "pn_vr", label: "Rozdíl (Plán - VŘ)" },
                          { id: "sod_vr", label: "Rozdíl (SOD - VŘ)" },
                          { id: "nabidky", label: "Počet nabídek" },
                          { id: "smlouvy", label: "Smlouvy" },
                        ].map((col) => (
                          <label
                            key={col.id}
                            className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={
                                visibleColumns[
                                  col.id as keyof typeof visibleColumns
                                ]
                              }
                              onChange={() => toggleColumn(col.id as keyof typeof visibleColumns)}
                              className="rounded text-primary focus:ring-primary"
                            />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {col.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto min-h-[300px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-950/20">
                      <th className="py-4 px-6 text-[10px] uppercase font-black text-slate-400 tracking-[0.2em]">
                        Stav
                      </th>
                      <th className="py-4 px-6 text-[10px] uppercase font-black text-slate-400 tracking-[0.2em]">
                        Poptávka
                      </th>

                      {visibleColumns.sod && (
                        <th className="py-4 px-6 text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] text-right">
                          SOD
                        </th>
                      )}
                      {visibleColumns.plan && (
                        <th className="py-4 px-6 text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] text-right">
                          Plán
                        </th>
                      )}

                      <th className="py-4 px-6 text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] text-right">
                        Cena VŘ
                      </th>

                      {visibleColumns.sod_vr && (
                        <th className="py-4 px-6 text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] text-right">
                          SOD - VŘ
                        </th>
                      )}
                      {visibleColumns.pn_vr && (
                        <th className="py-4 px-6 text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] text-right">
                          Plán - VŘ
                        </th>
                      )}

                      {visibleColumns.nabidky && (
                        <th className="py-4 px-6 text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] text-center">
                          Nabídky
                        </th>
                      )}
                      {visibleColumns.smlouvy && (
                        <th className="py-4 px-6 text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] text-center">
                          Smlouvy
                        </th>
                      )}

                      <th className="py-4 px-6 text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] text-center">
                        Dodavatel
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {[...filteredCategories]
                      .sort((a, b) => a.title.localeCompare(b.title, "cs"))
                      .map((cat) => {
                        const catBids = project.bids?.[cat.id] || [];
                        const winningBids = getWinningBids(project, cat.id);
                        const subPrice = getWinningBidTotal(project, cat.id);
                        const diffPlan = cat.planBudget - subPrice; // Plan - VŘ (PN-VŘ)
                        const diffSod = (cat.sodBudget || 0) - subPrice; // SOD - VŘ

                        const hasWinner = winningBids.length > 0;
                        const winnersNames = winningBids
                          .map((w) => w.companyName)
                          .join(", ");
                        const contractedCount = winningBids.filter(
                          (b) => b.contracted,
                        ).length;
                        const totalWinners = winningBids.length; // usually 1, but logic supports more

                        // "Smlouvy" logic:
                        // If hasWinner and ALL winners are contracted -> Green Check
                        // If hasWinner but NOT all contracted -> Orange Exclamation/Clock
                        // Else -> Dash
                        const allContracted =
                          hasWinner && contractedCount === totalWinners;

                        const statusConfig: Record<
                          string,
                          {
                            label: string;
                            bg: string;
                            text: string;
                            dot: string;
                          }
                        > = {
                          open: {
                            label: "Poptávka",
                            bg: "bg-amber-500/10",
                            text: "text-amber-600 dark:text-amber-400",
                            dot: "bg-amber-500",
                          },
                          negotiating: {
                            label: "Jednání",
                            bg: "bg-yellow-500/10",
                            text: "text-yellow-600 dark:text-yellow-400",
                            dot: "bg-yellow-500",
                          },
                          closed: {
                            label: "Uzavřeno",
                            bg: "bg-teal-500/10",
                            text: "text-teal-600 dark:text-teal-400",
                            dot: "bg-teal-500",
                          },
                          sod: {
                            label: "Smluvně",
                            bg: "bg-emerald-500/10",
                            text: "text-emerald-600 dark:text-emerald-400",
                            dot: "bg-emerald-500",
                          },
                        };
                        const status =
                          statusConfig[cat.status] || statusConfig["open"];

                        return (
                          <tr
                            key={cat.id}
                            className="group hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-all cursor-pointer"
                            onClick={() => onNavigateToPipeline?.(cat.id)}
                          >
                            <td className="py-4 px-6">
                              <div
                                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${status.bg} ${status.text} text-[10px] font-black uppercase tracking-tighter border border-current opacity-80 group-hover:opacity-100 transition-opacity`}
                              >
                                <span
                                  className={`size-1.5 rounded-full ${status.dot} animate-pulse`}
                                ></span>
                                {status.label}
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              <div className="font-extrabold text-slate-900 dark:text-white text-sm group-hover:text-primary transition-colors">
                                {cat.title}
                              </div>
                              {!visibleColumns.nabidky && (
                                <div className="text-[10px] text-slate-500 font-medium">
                                  Nabídky: {catBids.length}
                                </div>
                              )}
                            </td>

                            {visibleColumns.sod && (
                              <td className="py-4 px-6 text-right font-bold text-slate-500 dark:text-slate-400 text-xs">
                                {formatMoney(cat.sodBudget)}
                              </td>
                            )}
                            {visibleColumns.plan && (
                              <td className="py-4 px-6 text-right font-bold text-slate-900 dark:text-slate-200 text-xs">
                                {formatMoney(cat.planBudget)}
                              </td>
                            )}

                            <td className="py-4 px-6 text-right font-black text-slate-900 dark:text-white text-sm">
                              {hasWinner ? (
                                formatMoney(subPrice)
                              ) : (
                                <span className="text-slate-300 dark:text-slate-700">
                                  ---
                                </span>
                              )}
                            </td>

                            {visibleColumns.sod_vr && (
                              <td className="py-4 px-6 text-right">
                                {hasWinner ? (
                                  <div
                                    className={`inline-flex items-center gap-1 font-black text-xs ${diffSod >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                                  >
                                    {diffSod >= 0 ? "+" : ""}
                                    {formatMoney(diffSod)}
                                  </div>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-700">
                                    -
                                  </span>
                                )}
                              </td>
                            )}
                            {visibleColumns.pn_vr && (
                              <td className="py-4 px-6 text-right">
                                {hasWinner ? (
                                  <div
                                    className={`inline-flex items-center gap-1 font-black text-xs ${diffPlan >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                                  >
                                    {diffPlan >= 0 ? "+" : ""}
                                    {formatMoney(diffPlan)}
                                  </div>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-700">
                                    -
                                  </span>
                                )}
                              </td>
                            )}

                            {visibleColumns.nabidky && (
                              <td className="py-4 px-6 text-center text-xs font-bold text-slate-600 dark:text-slate-400">
                                {
                                  catBids.filter(
                                    (b) =>
                                      b.status === "offer" ||
                                      b.status === "shortlist" ||
                                      b.status === "sod",
                                  ).length
                                }
                                <span className="text-slate-400 text-[10px] mx-1">
                                  /
                                </span>
                                {cat.subcontractorCount || 0}
                              </td>
                            )}

                            {visibleColumns.smlouvy && (
                              <td className="py-4 px-6 text-center">
                                {hasWinner ? (
                                  <span
                                    className={`text-xs font-bold ${
                                      allContracted
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-amber-600 dark:text-amber-400"
                                    }`}
                                  >
                                    {contractedCount}
                                    <span className="text-slate-400 text-[10px] mx-1">
                                      /
                                    </span>
                                    {totalWinners}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-700">
                                    -
                                  </span>
                                )}
                              </td>
                            )}

                            <td className="py-4 px-6 max-w-[200px] truncate">
                              {hasWinner ? (
                                <div className="flex items-center gap-2">
                                  <div className="size-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500">
                                    {winnersNames.charAt(0)}
                                  </div>
                                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400 truncate">
                                    {winnersNames}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">
                                  Nepřiřazeno
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100/50 dark:bg-slate-900/50 font-black text-slate-900 dark:text-white border-t-2 border-slate-200 dark:border-slate-800">
                      <td
                        colSpan={2}
                        className="py-6 px-8 text-right text-[11px] uppercase tracking-widest text-slate-500"
                      >
                        Celková bilance
                      </td>

                      {visibleColumns.sod && (
                        <td className="py-6 px-6 text-right text-xs text-slate-400">
                          {formatMoney(totalSodBudget)}
                        </td>
                      )}
                      {visibleColumns.plan && (
                        <td className="py-6 px-6 text-right text-xs text-slate-600 dark:text-slate-300">
                          {formatMoney(totalPlanBudget)}
                        </td>
                      )}

                      <td className="py-6 px-6 text-right text-sm">
                        {formatMoney(totalWinningBidCost)}
                      </td>

                      {visibleColumns.sod_vr && (
                        <td className="py-6 px-6 text-right">
                          <span
                            className={`text-sm ${totalSodDiff >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                          >
                            {totalSodDiff >= 0 ? "+" : ""}
                            {formatMoney(totalSodDiff)}
                          </span>
                        </td>
                      )}

                      {visibleColumns.pn_vr && (
                        <td className="py-6 px-6 text-right">
                          <span
                            className={`text-sm ${totalPlanDiff >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                          >
                            {totalPlanDiff >= 0 ? "+" : ""}
                            {formatMoney(totalPlanDiff)}
                          </span>
                        </td>
                      )}

                      {/* Spacer for other columns */}
                      {visibleColumns.nabidky && <td></td>}
                      {visibleColumns.smlouvy && <td></td>}

                      <td className="py-6 px-6"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
      )}
    </div>
  );
};
