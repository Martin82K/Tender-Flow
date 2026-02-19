import React from "react";
import type { DemandCategory } from "../types";
import {
  diffDaysUtc,
  formatDayLabel,
  formatRangeLabel,
} from "@/features/projects/model/projectScheduleModel";
import { useProjectScheduleController } from "@/features/projects/model/useProjectScheduleController";
import {
  exportScheduleToPDF,
  exportScheduleToXLSX,
  exportScheduleWithTimelineToXLSX,
} from "../services/scheduleExportService";

export const ProjectSchedule: React.FC<{ projectId: string; projectTitle?: string; categories: DemandCategory[] }> = ({ projectId, projectTitle, categories }) => {
  const {
    isLoading,
    includeRealization,
    setIncludeRealization,
    zoom,
    setZoom,
    isEditMode,
    setIsEditMode,
    editModal,
    setEditModal,
    rows,
    rangeStart,
    rangeEnd,
    dayWidth,
    chartWidth,
    axis,
    todayX,
    gridBg,
    leftWidth,
    scrollRef,
    canScroll,
    showExportMenu,
    setShowExportMenu,
    exportMenuRef,
    isRowEditable,
    openEditModal,
    closeEditModal,
    saveEditModal,
  } = useProjectScheduleController({
    projectId,
    categories,
  });

  return (
    <div className="p-4 lg:p-6 flex flex-col gap-4 flex-1 min-h-0 bg-slate-50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="w-full flex flex-col gap-4 flex-1 min-h-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-purple-400 text-2xl">bar_chart</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Harmonogram</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Gantt navázaný na výběrová řízení a jejich termíny</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditMode((v) => !v)}
              className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all ${isEditMode
                ? "bg-amber-500/15 border-amber-500/25 text-amber-200"
                : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900"
                }`}
              title={includeRealization ? "Edituje Realizaci" : "Edituje VŘ"}
            >
              <span className="material-symbols-outlined text-[16px] align-[-3px] mr-1">edit</span>
              Editace
            </button>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/30 p-1 rounded-xl border border-slate-200 dark:border-slate-700/50">
              <button
                type="button"
                onClick={() => setZoom("month")}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${zoom === "month"
                  ? "bg-primary text-white shadow-lg"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700/50"
                  }`}
              >
                Měsíce
              </button>
              <button
                type="button"
                onClick={() => setZoom("week")}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${zoom === "week"
                  ? "bg-primary text-white shadow-lg"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700/50"
                  }`}
              >
                Týdny
              </button>
              <button
                type="button"
                onClick={() => setZoom("day")}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${zoom === "day"
                  ? "bg-primary text-white shadow-lg"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700/50"
                  }`}
              >
                Dny
              </button>
            </div>

            <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/60 text-xs font-bold text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={includeRealization}
                onChange={(e) => setIncludeRealization(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary/30"
              />
              Realizace
            </label>

            {/* Export button */}
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setShowExportMenu((v) => !v)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/60 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px] align-[-3px]">download</span>
                Export
                <span className="material-symbols-outlined text-[14px] align-[-2px]">expand_more</span>
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false);
                      const exportRows = rows.map((r) => ({
                        label: r.label,
                        subLabel: r.subLabel,
                        start: r.start,
                        end: r.end,
                        kind: r.kind,
                      }));
                      exportScheduleToXLSX(
                        exportRows,
                        projectTitle || 'Harmonogram',
                        rangeStart,
                        rangeEnd,
                        includeRealization ? 'realization' : 'tender'
                      );
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">table_chart</span>
                    Export XLSX
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false);
                      const exportRows = rows.map((r) => ({
                        label: r.label,
                        subLabel: r.subLabel,
                        start: r.start,
                        end: r.end,
                        kind: r.kind,
                      }));
                      exportScheduleToPDF(
                        exportRows,
                        projectTitle || 'Harmonogram',
                        rangeStart,
                        rangeEnd,
                        includeRealization ? 'realization' : 'tender'
                      );
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                    Export PDF
                  </button>
                  <div className="border-t border-slate-200 dark:border-slate-700/50" />
                  <button
                    type="button"
                    onClick={async () => {
                      setShowExportMenu(false);
                      const exportRows = rows.map((r) => ({
                        label: r.label,
                        subLabel: r.subLabel,
                        start: r.start,
                        end: r.end,
                        kind: r.kind,
                      }));
                      await exportScheduleWithTimelineToXLSX(
                        exportRows,
                        projectTitle || 'Harmonogram',
                        rangeStart,
                        rangeEnd,
                        includeRealization ? 'realization' : 'tender',
                        zoom
                      );
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">insert_chart</span>
                    Export XLSX s grafem
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {isEditMode && (
          <div className="px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-200 text-xs font-semibold">
            {includeRealization ? "Editace: klikněte na pruh Realizace a upravte skutečné termíny." : "Editace: klikněte na pruh VŘ a upravte plánované termíny."}
          </div>
        )}

        <div className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl shadow-xl overflow-hidden flex flex-col flex-1 min-h-0">
          {isLoading ? (
            <div className="px-6 py-12 text-center">
              <span className="material-symbols-outlined text-slate-600 text-5xl mb-3 block animate-spin">progress_activity</span>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Načítám harmonogram…</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <span className="material-symbols-outlined text-slate-500 text-5xl mb-3 block">calendar_month</span>
              <p className="text-slate-700 dark:text-slate-200 text-sm font-semibold">Zatím tu nejsou žádné termíny</p>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                Doplněním termínů v <span className="font-bold">Plán VŘ</span> nebo v detailu <span className="font-bold">Výběrových řízení</span> se Gantt automaticky naplní.
              </p>
            </div>
          ) : (
            <div className="relative">
              {canScroll.left && (
                <button
                  type="button"
                  onClick={() => scrollRef.current?.scrollBy({ left: -Math.max(240, (scrollRef.current?.clientWidth ?? 0) * 0.8), behavior: "smooth" })}
                  className="absolute z-30 top-1/2 -translate-y-1/2 rounded-full border border-slate-200/60 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/80 backdrop-blur px-2 py-2 shadow-lg hover:bg-white dark:hover:bg-slate-900 transition-colors"
                  style={{ left: leftWidth + 8 }}
                  title="Posunout vlevo"
                >
                  <span className="material-symbols-outlined text-slate-700 dark:text-slate-200 text-[18px]">chevron_left</span>
                </button>
              )}
              {canScroll.right && (
                <button
                  type="button"
                  onClick={() => scrollRef.current?.scrollBy({ left: Math.max(240, (scrollRef.current?.clientWidth ?? 0) * 0.8), behavior: "smooth" })}
                  className="absolute z-30 top-1/2 -translate-y-1/2 rounded-full border border-slate-200/60 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/80 backdrop-blur px-2 py-2 shadow-lg hover:bg-white dark:hover:bg-slate-900 transition-colors right-3"
                  title="Posunout vpravo"
                >
                  <span className="material-symbols-outlined text-slate-700 dark:text-slate-200 text-[18px]">chevron_right</span>
                </button>
              )}

              <div ref={scrollRef} className="overflow-x-auto overflow-y-auto flex-1 min-h-0" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                <div className="min-w-max">
                  {/* Axis header */}
                  <div className="flex sticky top-0 z-20 bg-white dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800">
                    <div
                      className="shrink-0 px-5 py-3 text-xs font-bold text-slate-500 dark:text-slate-400"
                      style={{ width: leftWidth }}
                    >
                      Výběrové řízení
                    </div>
                    <div className="relative" style={{ width: chartWidth }}>
                      <div className="flex">
                        {axis.map((seg) => (
                          <div
                            key={seg.key}
                            className="px-2 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-slate-800"
                            style={{ width: seg.days * dayWidth }}
                          >
                            {seg.label}
                          </div>
                        ))}
                      </div>
                      <div className="absolute inset-0 pointer-events-none opacity-60" style={gridBg} />
                      {todayX.x >= 0 && todayX.x <= chartWidth && (
                        <div
                          className="absolute top-0 bottom-0 w-px bg-rose-500/70 pointer-events-none"
                          style={{ left: todayX.x }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Date flag below axis header */}
                  {todayX.x >= 0 && todayX.x <= chartWidth && (
                    <div className="relative h-0" style={{ left: leftWidth, width: chartWidth }}>
                      <div
                        className="absolute top-1 pointer-events-none z-10"
                        style={{ left: Math.max(6, Math.min(chartWidth - 100, todayX.x - 45)) }}
                      >
                        <div className="px-2 py-1 rounded-lg bg-rose-500/15 border border-rose-500/25 text-[10px] font-bold text-rose-300 backdrop-blur">
                          Dnes: {todayX.label}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Rows */}
                  <div className="relative">
                    <div className="absolute inset-y-0 pointer-events-none" style={{ left: leftWidth, width: chartWidth }}>
                      <div className="absolute inset-0 opacity-40" style={gridBg} />
                      {todayX.x >= 0 && todayX.x <= chartWidth && (
                        <div className="absolute top-0 bottom-0 w-px bg-rose-500/60" style={{ left: todayX.x }} />
                      )}
                    </div>

                    {rows.map((row) => {
                      const hasRange = !!row.start && !!row.end;
                      const fromX = hasRange ? diffDaysUtc(rangeStart, row.start!) * dayWidth : 0;
                      const toX = hasRange ? diffDaysUtc(rangeStart, row.end!) * dayWidth : 0;
                      const left = Math.min(fromX, toX);
                      const width = Math.max(2, Math.abs(toX - fromX) + dayWidth);
                      const colorClass =
                        row.color === "emerald"
                          ? "bg-emerald-500/70 border-emerald-300/40"
                          : row.color === "slate"
                            ? "bg-slate-500/60 border-slate-300/30"
                            : "bg-blue-500/70 border-blue-300/40";

                      const labelText = row.label;
                      const metaText = row.subLabel
                        ? `${row.subLabel}: ${hasRange ? formatRangeLabel(row.start!, row.end!) : "—"}`
                        : hasRange
                          ? formatRangeLabel(row.start!, row.end!)
                          : "—";
                      const editable = isRowEditable(row);

                      return (
                        <div
                          key={row.id}
                          className="flex border-b border-slate-100 dark:border-slate-800/60 last:border-b-0"
                        >
                          <div
                            className="sticky left-0 z-10 shrink-0 px-5 py-3 bg-white dark:bg-slate-900/90"
                            style={{ width: leftWidth }}
                          >
                            <div className={`flex items-start gap-2 ${row.indent === 1 ? "pl-5" : ""}`}>
                              {row.indent === 1 && (
                                <span className="material-symbols-outlined text-slate-400 text-[18px] mt-[1px]">subdirectory_arrow_right</span>
                              )}
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{labelText}</div>
                                {metaText ? (
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{metaText}</div>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <div className="relative py-3" style={{ width: chartWidth }}>
                            <div className="relative h-8">
                              {row.kind === "milestone" && hasRange ? (
                                <div
                                  className="absolute top-1/2 -translate-y-1/2 size-3 rotate-45 bg-blue-500/80 border border-blue-200/50 shadow-sm"
                                  style={{ left: left + dayWidth / 2 }}
                                  title={formatDayLabel(row.start)}
                                />
                              ) : row.kind === "bar" && hasRange ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!editable) return;
                                    openEditModal(row);
                                  }}
                                  className={`absolute top-1/2 -translate-y-1/2 h-3 rounded-full border ${colorClass} shadow-sm ${editable ? "cursor-pointer hover:brightness-110" : "cursor-default"
                                    }`}
                                  style={{ left, width }}
                                  title={`${formatDayLabel(row.start)} – ${formatDayLabel(row.end)}${editable ? " (klikněte pro úpravu)" : ""}`}
                                />
                              ) : editable ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    openEditModal(row);
                                  }}
                                  className={`absolute top-1/2 -translate-y-1/2 h-7 px-3 rounded-xl border border-dashed text-xs font-bold shadow-sm ${editable
                                    ? "border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15 cursor-pointer"
                                    : "border-slate-300/40 dark:border-slate-700/40 bg-slate-100/60 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 cursor-default"
                                    }`}
                                  style={{ left: 12 }}
                                  title={editable ? "Klikněte pro nastavení termínu" : "Bez termínu"}
                                >
                                  {editable ? "Nastavit" : "Bez termínu"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {editModal.isOpen && editModal.row && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-200/30 dark:border-slate-700/50 bg-white dark:bg-slate-950 shadow-2xl overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">Upravit {editModal.row.subLabel}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{editModal.row.label}</div>
                  </div>
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    aria-label="Zavřít"
                  >
                    <span className="material-symbols-outlined text-slate-500">close</span>
                  </button>
                </div>
              </div>

              <div className="px-6 py-5 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Od</span>
                    <input
                      type="date"
                      value={editModal.start}
                      onChange={(e) => setEditModal((p) => ({ ...p, start: e.target.value }))}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm"
                      disabled={editModal.isSaving}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Do</span>
                    <input
                      type="date"
                      value={editModal.end}
                      onChange={(e) => setEditModal((p) => ({ ...p, end: e.target.value }))}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm"
                      disabled={editModal.isSaving}
                    />
                  </label>
                </div>

                {editModal.row.record.type === "category_deadline" && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    U termínu z VŘ se ukládá jedno datum (Od = Do) do pole <span className="font-bold">Termín nabídky</span>.
                  </div>
                )}

                {editModal.error ? (
                  <div className="px-3 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 text-xs font-semibold">
                    {editModal.error}
                  </div>
                ) : null}
              </div>

              <div className="px-6 py-5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950/60">
                <button
                  type="button"
                  onClick={() => {
                    setEditModal((p) => ({ ...p, start: "", end: "" }));
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  disabled={editModal.isSaving}
                >
                  Vymazat
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    disabled={editModal.isSaving}
                  >
                    Zrušit
                  </button>
                  <button
                    type="button"
                    onClick={saveEditModal}
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold shadow-lg transition-colors disabled:opacity-60"
                    disabled={editModal.isSaving}
                  >
                    {editModal.isSaving ? "Ukládám…" : "Uložit"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
