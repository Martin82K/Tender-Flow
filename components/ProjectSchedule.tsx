import React, { useEffect, useMemo, useRef, useState } from "react";
import { DemandCategory, TenderPlanItem } from "../types";
import { supabase } from "../services/supabase";

type Zoom = "month" | "week";

type Row = {
  id: string;
  groupKey: string;
  record:
    | { type: "tender_plan"; id: string }
    | { type: "category_deadline"; categoryId: string }
    | { type: "tender_plan_new"; categoryId: string; name: string }
    | { type: "category_realization"; categoryId: string };
  label: string;
  subLabel?: string;
  indent: 0 | 1;
  kind: "bar" | "milestone" | "empty";
  start: Date | null;
  end: Date | null;
  deadline?: Date | null;
  color: "blue" | "emerald" | "slate";
};

const normalizeKey = (value: string) => value.trim().toLowerCase();

const parseIsoDate = (value: string | undefined | null): Date | null => {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const dayIndexUtc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS_PER_DAY;
const diffDaysUtc = (a: Date, b: Date) => dayIndexUtc(b) - dayIndexUtc(a);

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

const toIsoDateLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatRangeLabel = (start: Date, end: Date) => {
  const s = fmtDate.format(start);
  const e = fmtDate.format(end);
  return s === e ? s : `${s} – ${e}`;
};

const buildRows = (categories: DemandCategory[], tenderPlans: TenderPlanItem[], includeRealization: boolean): Row[] => {
  if (includeRealization) {
    const entries = categories.map((category) => {
      const rStart = parseIsoDate(category.realizationStart);
      const rEnd = parseIsoDate(category.realizationEnd);
      const hasRange = !!rStart || !!rEnd;
      const start = hasRange ? rStart ?? rEnd! : null;
      const end = hasRange ? rEnd ?? rStart! : null;
      const range = start && end ? clampRange(start, end) : null;
      const sortTime = range ? Math.min(range.start.getTime(), range.end.getTime()) : Number.POSITIVE_INFINITY;
      return { category, range, sortTime };
    });

    entries.sort((a, b) => a.sortTime - b.sortTime || a.category.title.localeCompare(b.category.title, "cs"));

    return entries.map(({ category, range }) => {
      if (range) {
        return {
          id: `${category.id}:realization`,
          groupKey: category.id,
          record: { type: "category_realization", categoryId: category.id },
          label: category.title,
          subLabel: "Realizace",
          indent: 0,
          kind: range.start.getTime() === range.end.getTime() ? "milestone" : "bar",
          start: range.start,
          end: range.end,
          color: "emerald",
        } satisfies Row;
      }

      return {
        id: `${category.id}:realization`,
        groupKey: category.id,
        record: { type: "category_realization", categoryId: category.id },
        label: category.title,
        subLabel: "Realizace",
        indent: 0,
        kind: "empty",
        start: null,
        end: null,
        color: "slate",
      } satisfies Row;
    });
  }

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const categoryByName = new Map(categories.map((c) => [normalizeKey(c.title), c]));

  const groups = new Map<
    string,
    {
      title: string;
      tender?: {
        id?: string;
        start?: Date | null;
        end?: Date | null;
        deadline?: Date | null;
        source: "plan" | "category";
      };
    }
  >();

  const ensureGroup = (key: string, title: string) => {
    const existing = groups.get(key);
    if (existing) return existing;
    const created = { title, tender: undefined as any };
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
      id: item.id,
      start: from,
      end: to,
      deadline: fallbackDeadline,
      source: "plan",
    };
  }

  for (const category of categories) {
    const groupKey = category.id;
    const group = ensureGroup(groupKey, category.title);
    const deadline = parseIsoDate(category.deadline);
    if (!group.tender && deadline) group.tender = { start: null, end: null, deadline, source: "category" };
  }

  const groupEntries = Array.from(groups.entries()).map(([groupKey, group]) => {
    const dates: Date[] = [];
    if (group.tender?.start) dates.push(group.tender.start);
    if (group.tender?.end) dates.push(group.tender.end);
    if (group.tender?.deadline) dates.push(group.tender.deadline);
    const sortTime = dates.length ? Math.min(...dates.map((d) => d.getTime())) : Number.POSITIVE_INFINITY;
    return { groupKey, group, sortTime };
  });

  groupEntries.sort((a, b) => a.sortTime - b.sortTime || a.group.title.localeCompare(b.group.title, "cs"));

  const rows: Row[] = [];

  for (const entry of groupEntries) {
    const { groupKey, group } = entry;
    const tender = group.tender;
    const start = tender?.start ?? tender?.end ?? tender?.deadline ?? null;
    const end = tender?.end ?? tender?.start ?? tender?.deadline ?? null;

    if (start && end) {
      const clamped = clampRange(start, end);
      const isMilestone = clamped.start.getTime() === clamped.end.getTime();
      rows.push({
        id: `${groupKey}:tender`,
        groupKey,
        record:
          tender?.source === "plan" && tender.id
            ? { type: "tender_plan", id: tender.id }
            : tender?.source === "category"
              ? { type: "category_deadline", categoryId: groupKey }
              : { type: "tender_plan_new", categoryId: groupKey, name: group.title },
        label: group.title,
        subLabel: "VŘ",
        indent: 0,
        kind: isMilestone ? "milestone" : "bar",
        start: clamped.start,
        end: clamped.end,
        deadline: tender?.deadline ?? null,
        color: "blue",
      });
      continue;
    }

    rows.push({
      id: `${groupKey}:tender`,
      groupKey,
      record: { type: "tender_plan_new", categoryId: groupKey, name: group.title },
      label: group.title,
      subLabel: "VŘ",
      indent: 0,
      kind: "empty",
      start: null,
      end: null,
      color: "slate",
    });
  }

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
  const [localCategories, setLocalCategories] = useState<DemandCategory[]>(categories);
  const [isLoading, setIsLoading] = useState(true);
  const [includeRealization, setIncludeRealization] = useState(true);
  const [zoom, setZoom] = useState<Zoom>("month");
  const [isEditMode, setIsEditMode] = useState(false);
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    row: Row | null;
    start: string;
    end: string;
    isSaving: boolean;
    error?: string | null;
  }>({ isOpen: false, row: null, start: "", end: "", isSaving: false, error: null });

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScroll, setCanScroll] = useState({ left: false, right: false });

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

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

  const rows = useMemo(() => buildRows(localCategories, tenderPlans, includeRealization), [localCategories, tenderPlans, includeRealization]);

  const { rangeStart, rangeEnd } = useMemo(() => {
    const dates = rows.flatMap((r) => (r.start && r.end ? [r.start, r.end] : []));
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
  const totalDays = Math.max(1, diffDaysUtc(rangeStart, rangeEnd) + 1);
  const chartWidth = totalDays * dayWidth;

  const axis = useMemo(() => buildAxis(rangeStart, rangeEnd, zoom), [rangeStart, rangeEnd, zoom]);

  const todayX = useMemo(() => {
    const today = startOfDay(new Date());
    const x = diffDaysUtc(rangeStart, today) * dayWidth + dayWidth / 2;
    return { x, label: fmtDate.format(today) };
  }, [rangeStart, dayWidth]);

  const gridBg = useMemo(() => {
    const step = dayWidth;
    return {
      backgroundImage: `repeating-linear-gradient(to right, rgba(148,163,184,0.18) 0, rgba(148,163,184,0.18) 1px, transparent 1px, transparent ${step}px)`,
    } as React.CSSProperties;
  }, [dayWidth]);

  const leftWidth = 320;

  const isRowEditable = (row: Row) => {
    if (!isEditMode) return false;
    if (includeRealization) return row.record.type === "category_realization";
    return row.record.type === "tender_plan" || row.record.type === "tender_plan_new" || row.record.type === "category_deadline";
  };

  const openEditModal = (row: Row) => {
    const start = row.start ? toIsoDateLocal(row.start) : "";
    const end = row.end ? toIsoDateLocal(row.end) : "";
    setEditModal({ isOpen: true, row, start, end, isSaving: false, error: null });
  };

  const closeEditModal = () => setEditModal({ isOpen: false, row: null, start: "", end: "", isSaving: false, error: null });

  const saveEditModal = async () => {
    if (!editModal.row) return;
    const row = editModal.row;
    const start = editModal.start.trim();
    const end = editModal.end.trim();

    const startDate = parseIsoDate(start) ?? null;
    const endDate = parseIsoDate(end) ?? null;
    if (start && !startDate) {
      setEditModal((p) => ({ ...p, error: "Neplatné datum Od." }));
      return;
    }
    if (end && !endDate) {
      setEditModal((p) => ({ ...p, error: "Neplatné datum Do." }));
      return;
    }
    if (!start && !end) {
      // allowed: clears the schedule for this row
    } else if (!start || !end) {
      setEditModal((p) => ({ ...p, error: "Vyplňte prosím Od i Do (nebo obě smažte)." }));
      return;
    }

    setEditModal((p) => ({ ...p, isSaving: true, error: null }));

    try {
      if (row.record.type === "category_realization") {
        const categoryId = row.record.categoryId;
        const nextStart = start || null;
        const nextEnd = end || null;

        setLocalCategories((prev) =>
          prev.map((c) =>
            c.id === categoryId ? { ...c, realizationStart: nextStart ?? undefined, realizationEnd: nextEnd ?? undefined } : c
          )
        );

        const { error } = await supabase
          .from("demand_categories")
          .update({ realization_start: nextStart, realization_end: nextEnd })
          .eq("id", categoryId);
        if (error) throw error;
      } else if (row.record.type === "tender_plan") {
        const planId = row.record.id;
        const nextFrom = start || null;
        const nextTo = end || null;

        setTenderPlans((prev) =>
          prev.map((p) => (p.id === planId ? { ...p, dateFrom: nextFrom ?? "", dateTo: nextTo ?? "" } : p))
        );

        const { error } = await supabase
          .from("tender_plans")
          .update({ date_from: nextFrom, date_to: nextTo })
          .eq("id", planId);
        if (error) throw error;
      } else if (row.record.type === "tender_plan_new") {
        const newId = `tp_${Date.now()}`;
        const nextFrom = start || null;
        const nextTo = end || null;

        const newItem: TenderPlanItem = {
          id: newId,
          name: row.record.name,
          dateFrom: nextFrom ?? "",
          dateTo: nextTo ?? "",
          categoryId: row.record.categoryId,
        };

        setTenderPlans((prev) => [...prev, newItem]);

        const { error } = await supabase.from("tender_plans").insert({
          id: newId,
          project_id: projectId,
          name: row.record.name,
          date_from: nextFrom,
          date_to: nextTo,
          category_id: row.record.categoryId,
        });
        if (error) throw error;
      } else if (row.record.type === "category_deadline") {
        const categoryId = row.record.categoryId;
        if (!start || !end || start !== end) {
          setEditModal((p) => ({ ...p, isSaving: false, error: "U termínu z VŘ nastavte prosím jedno datum (Od = Do)." }));
          return;
        }

        setLocalCategories((prev) => prev.map((c) => (c.id === categoryId ? { ...c, deadline: start } : c)));
        const { error } = await supabase.from("demand_categories").update({ deadline: start }).eq("id", categoryId);
        if (error) throw error;
      }

      closeEditModal();
    } catch (err: any) {
      console.error("Error saving schedule:", err);
      setEditModal((p) => ({ ...p, isSaving: false, error: err?.message ?? "Nepodařilo se uložit změny." }));
    }
  };

  useEffect(() => {
    const update = () => {
      const el = scrollRef.current;
      if (!el) return;
      const left = el.scrollLeft > 4;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
      setCanScroll({ left, right });
    };

    update();
    const el = scrollRef.current;
    el?.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el?.removeEventListener("scroll", update as any);
      window.removeEventListener("resize", update);
    };
  }, [chartWidth, rows.length, zoom]);

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

              <div ref={scrollRef} className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
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
                        <>
                          <div
                            className="absolute top-0 bottom-0 w-px bg-rose-500/70 pointer-events-none"
                            style={{ left: todayX.x }}
                          />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Rows */}
                  <div className="relative">
                    <div className="absolute inset-y-0 pointer-events-none" style={{ left: leftWidth, width: chartWidth }}>
                      <div className="absolute inset-0 opacity-40" style={gridBg} />
                      {todayX.x >= 0 && todayX.x <= chartWidth && (
                        <>
                          <div className="absolute top-0 bottom-0 w-px bg-rose-500/60" style={{ left: todayX.x }} />
                          <div
                            className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                            style={{ left: Math.max(6, Math.min(chartWidth - 90, todayX.x + 8)) }}
                          >
                            <div className="px-2 py-1 rounded-lg bg-rose-500/15 border border-rose-500/25 text-[10px] font-bold text-rose-300 backdrop-blur">
                              Dnes: {todayX.label}
                            </div>
                          </div>
                        </>
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
                                  title={fmtDay.format(row.start)}
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
                                  title={`${fmtDay.format(row.start)} – ${fmtDay.format(row.end)}${editable ? " (klikněte pro úpravu)" : ""}`}
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
