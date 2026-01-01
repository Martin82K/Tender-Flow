import React, { useEffect, useMemo, useState } from "react";
import { DemandCategory, TenderPlanItem } from "../types";
import { supabase } from "../services/supabase";

type Zoom = "month" | "week";

type Row = {
  id: string;
  groupKey: string;
  label: string;
  subLabel?: string;
  indent: 0 | 1;
  kind: "bar" | "milestone";
  start: Date;
  end: Date;
  deadline?: Date | null;
  color: "blue" | "emerald" | "slate";
};

const normalizeKey = (value: string) => value.trim().toLowerCase();

const parseIsoDate = (value: string | undefined | null): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

const diffDays = (a: Date, b: Date) => {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
};

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

const startOfWeekMonday = (d: Date) => {
  const day = d.getDay(); // 0=Sun
  const delta = day === 0 ? -6 : 1 - day;
  return addDays(d, delta);
};

const fmtDay = new Intl.DateTimeFormat("cs-CZ", { day: "2-digit", month: "2-digit" });
const fmtDate = new Intl.DateTimeFormat("cs-CZ", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtMonth = new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric" });

const daysInMonth = (d: Date) => endOfMonth(d).getDate();

const clampRange = (start: Date, end: Date): { start: Date; end: Date } => {
  if (end.getTime() < start.getTime()) return { start: end, end: start };
  return { start, end };
};

const formatRangeLabel = (start: Date, end: Date) => {
  const s = fmtDate.format(start);
  const e = fmtDate.format(end);
  return s === e ? s : `${s} – ${e}`;
};

const buildRows = (categories: DemandCategory[], tenderPlans: TenderPlanItem[], includeRealization: boolean): Row[] => {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const categoryByName = new Map(categories.map((c) => [normalizeKey(c.title), c]));

  const groups = new Map<
    string,
    {
      title: string;
      tender?: { start?: Date | null; end?: Date | null; deadline?: Date | null; source: "plan" | "category" };
      realization?: { start: Date; end: Date };
    }
  >();

  const ensureGroup = (key: string, title: string) => {
    const existing = groups.get(key);
    if (existing) return existing;
    const created = { title, tender: undefined as any, realization: undefined as any };
    groups.set(key, created);
    return created;
  };

  for (const item of tenderPlans) {
    const from = parseIsoDate(item.dateFrom);
    const to = parseIsoDate(item.dateTo);
    const byId = item.categoryId ? categoryById.get(item.categoryId) : undefined;
    const byName = categoryByName.get(normalizeKey(item.name));
    const category = byId ?? byName;

    const groupKey = category?.id ?? normalizeKey(item.name);
    const group = ensureGroup(groupKey, category?.title ?? item.name);

    const fallbackDeadline = parseIsoDate(category?.deadline);
    group.tender = {
      start: from,
      end: to,
      deadline: fallbackDeadline,
      source: "plan",
    };

    if (includeRealization && category) {
      const rStart = parseIsoDate(category.realizationStart);
      const rEnd = parseIsoDate(category.realizationEnd);
      if (rStart && rEnd) group.realization = clampRange(rStart, rEnd);
    }
  }

  for (const category of categories) {
    const groupKey = category.id;
    const group = ensureGroup(groupKey, category.title);
    const deadline = parseIsoDate(category.deadline);
    if (!group.tender && deadline) {
      group.tender = { start: null, end: null, deadline, source: "category" };
    }

    if (includeRealization) {
      const rStart = parseIsoDate(category.realizationStart);
      const rEnd = parseIsoDate(category.realizationEnd);
      if (rStart && rEnd) group.realization = clampRange(rStart, rEnd);
    }
  }

  const rows: Row[] = [];

  for (const [groupKey, group] of groups.entries()) {
    const tender = group.tender;
    if (tender) {
      const start = tender.start ?? tender.end ?? tender.deadline ?? null;
      const end = tender.end ?? tender.start ?? tender.deadline ?? null;
      if (start && end) {
        const clamped = clampRange(start, end);
        const isMilestone = clamped.start.getTime() === clamped.end.getTime();
        rows.push({
          id: `${groupKey}:tender`,
          groupKey,
          label: group.title,
          subLabel: tender.source === "category" ? "Termín (z VŘ)" : "Plán VŘ",
          indent: 0,
          kind: isMilestone ? "milestone" : "bar",
          start: clamped.start,
          end: clamped.end,
          deadline: tender.deadline ?? null,
          color: "blue",
        });
      }
    }

    if (group.realization) {
      rows.push({
        id: `${groupKey}:realization`,
        groupKey,
        label: group.title,
        subLabel: "Realizace",
        indent: 1,
        kind: "bar",
        start: group.realization.start,
        end: group.realization.end,
        color: "emerald",
      });
    }
  }

  rows.sort((a, b) => a.start.getTime() - b.start.getTime() || a.label.localeCompare(b.label, "cs"));
  return rows;
};

const buildAxis = (rangeStart: Date, rangeEnd: Date, zoom: Zoom) => {
  const segments: { key: string; label: string; days: number }[] = [];
  if (zoom === "week") {
    let cursor = startOfWeekMonday(rangeStart);
    const end = startOfWeekMonday(rangeEnd);
    while (cursor.getTime() <= end.getTime()) {
      segments.push({ key: cursor.toISOString(), label: fmtDay.format(cursor), days: 7 });
      cursor = addDays(cursor, 7);
    }
    return segments;
  }

  let cursor = startOfMonth(rangeStart);
  const endCursor = startOfMonth(rangeEnd);
  while (cursor.getTime() <= endCursor.getTime()) {
    segments.push({ key: cursor.toISOString(), label: fmtMonth.format(cursor), days: daysInMonth(cursor) });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return segments;
};

export const ProjectSchedule: React.FC<{ projectId: string; categories: DemandCategory[] }> = ({ projectId, categories }) => {
  const [tenderPlans, setTenderPlans] = useState<TenderPlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [includeRealization, setIncludeRealization] = useState(true);
  const [zoom, setZoom] = useState<Zoom>("month");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("tender_plans")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: true });

        if (cancelled) return;
        if (error) {
          console.error("Error loading tender plans:", error);
          setTenderPlans([]);
          return;
        }

        const mapped = (data || []).map((row: any) => ({
          id: row.id,
          name: row.name,
          dateFrom: row.date_from || "",
          dateTo: row.date_to || "",
          categoryId: row.category_id || undefined,
        }));
        setTenderPlans(mapped);
      } catch (err) {
        if (!cancelled) {
          console.error("Unexpected error loading tender plans:", err);
          setTenderPlans([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const rows = useMemo(() => buildRows(categories, tenderPlans, includeRealization), [categories, tenderPlans, includeRealization]);

  const { rangeStart, rangeEnd } = useMemo(() => {
    const dates = rows.flatMap((r) => [r.start, r.end]);
    if (dates.length === 0) {
      const today = startOfDay(new Date());
      return { rangeStart: addDays(startOfWeekMonday(today), -7), rangeEnd: addDays(today, 21) };
    }
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    const paddedStart = addDays(startOfMonth(min), -7);
    const paddedEnd = addDays(endOfMonth(max), 7);
    return { rangeStart: paddedStart, rangeEnd: paddedEnd };
  }, [rows]);

  const dayWidth = zoom === "month" ? 6 : 16;
  const totalDays = Math.max(1, diffDays(rangeStart, rangeEnd) + 1);
  const chartWidth = totalDays * dayWidth;

  const axis = useMemo(() => buildAxis(rangeStart, rangeEnd, zoom), [rangeStart, rangeEnd, zoom]);

  const todayX = useMemo(() => {
    const today = startOfDay(new Date());
    const x = diffDays(rangeStart, today) * dayWidth;
    return x;
  }, [rangeStart, dayWidth]);

  const gridBg = useMemo(() => {
    const step = dayWidth;
    return {
      backgroundImage: `repeating-linear-gradient(to right, rgba(148,163,184,0.18) 0, rgba(148,163,184,0.18) 1px, transparent 1px, transparent ${step}px)`,
    } as React.CSSProperties;
  }, [dayWidth]);

  const leftWidth = 320;

  return (
    <div className="p-6 lg:p-10 flex flex-col gap-6 overflow-y-auto h-full bg-slate-50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 min-h-screen">
      <div className="max-w-6xl mx-auto w-full flex flex-col gap-6">
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
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl shadow-xl overflow-hidden">
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
              <div className="overflow-auto max-h-[68vh]">
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
                      {todayX >= 0 && todayX <= chartWidth && (
                        <div
                          className="absolute top-0 bottom-0 w-px bg-rose-500/70 pointer-events-none"
                          style={{ left: todayX }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Rows */}
                  <div className="relative">
                    <div className="absolute inset-y-0 pointer-events-none" style={{ left: leftWidth, width: chartWidth }}>
                      <div className="absolute inset-0 opacity-40" style={gridBg} />
                      {todayX >= 0 && todayX <= chartWidth && (
                        <div className="absolute top-0 bottom-0 w-px bg-rose-500/60" style={{ left: todayX }} />
                      )}
                    </div>

                    {rows.map((row) => {
                      const fromX = diffDays(rangeStart, row.start) * dayWidth;
                      const toX = diffDays(rangeStart, row.end) * dayWidth;
                      const left = Math.min(fromX, toX);
                      const width = Math.max(2, Math.abs(toX - fromX) + dayWidth);
                      const colorClass =
                        row.color === "emerald"
                          ? "bg-emerald-500/70 border-emerald-300/40"
                          : row.color === "slate"
                            ? "bg-slate-500/60 border-slate-300/30"
                            : "bg-blue-500/70 border-blue-300/40";

                      const labelText = row.indent === 1 ? "Realizace" : row.label;
                      const metaText = row.indent === 1 ? formatRangeLabel(row.start, row.end) : formatRangeLabel(row.start, row.end);

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
                              {row.kind === "milestone" ? (
                                <div
                                  className="absolute top-1/2 -translate-y-1/2 size-3 rotate-45 bg-blue-500/80 border border-blue-200/50 shadow-sm"
                                  style={{ left }}
                                  title={fmtDay.format(row.start)}
                                />
                              ) : (
                                <div
                                  className={`absolute top-1/2 -translate-y-1/2 h-3 rounded-full border ${colorClass} shadow-sm`}
                                  style={{ left, width }}
                                  title={`${fmtDay.format(row.start)} – ${fmtDay.format(row.end)}`}
                                />
                              )}
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
      </div>
    </div>
  );
};
