import type { DemandCategory, TenderPlanItem } from "@/types";

export type Zoom = "month" | "week" | "day";

export type Row = {
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

export const parseIsoDate = (value: string | undefined | null): Date | null => {
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

export const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const addDays = (d: Date, days: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const dayIndexUtc = (d: Date) =>
  Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS_PER_DAY;

export const diffDaysUtc = (a: Date, b: Date) => dayIndexUtc(b) - dayIndexUtc(a);

export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

export const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

export const startOfWeekMonday = (d: Date) => {
  const day = d.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  return addDays(d, delta);
};

const fmtDay = new Intl.DateTimeFormat("cs-CZ", { day: "2-digit", month: "2-digit" });
const fmtDate = new Intl.DateTimeFormat("cs-CZ", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const fmtMonth = new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric" });

export const formatDayLabel = (d: Date) => fmtDay.format(d);
export const formatDateLabel = (d: Date) => fmtDate.format(d);

const daysInMonth = (d: Date) => endOfMonth(d).getDate();

const clampRange = (start: Date, end: Date): { start: Date; end: Date } => {
  if (end.getTime() < start.getTime()) return { start: end, end: start };
  return { start, end };
};

export const toIsoDateLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const formatRangeLabel = (start: Date, end: Date) => {
  const s = fmtDate.format(start);
  const e = fmtDate.format(end);
  return s === e ? s : `${s} – ${e}`;
};

export const buildRows = (
  categories: DemandCategory[],
  tenderPlans: TenderPlanItem[],
  includeRealization: boolean,
): Row[] => {
  if (includeRealization) {
    const entries = categories.map((category) => {
      const rStart = parseIsoDate(category.realizationStart);
      const rEnd = parseIsoDate(category.realizationEnd);
      const hasRange = !!rStart || !!rEnd;
      const start = hasRange ? rStart ?? rEnd! : null;
      const end = hasRange ? rEnd ?? rStart! : null;
      const range = start && end ? clampRange(start, end) : null;
      const sortTime = range
        ? Math.min(range.start.getTime(), range.end.getTime())
        : Number.POSITIVE_INFINITY;
      return { category, range, sortTime };
    });

    entries.sort(
      (a, b) =>
        a.sortTime - b.sortTime ||
        a.category.title.localeCompare(b.category.title, "cs"),
    );

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
    if (!group.tender && deadline) {
      group.tender = { start: null, end: null, deadline, source: "category" };
    }
  }

  const groupEntries = Array.from(groups.entries()).map(([groupKey, group]) => {
    const dates: Date[] = [];
    if (group.tender?.start) dates.push(group.tender.start);
    if (group.tender?.end) dates.push(group.tender.end);
    if (group.tender?.deadline) dates.push(group.tender.deadline);
    const sortTime = dates.length
      ? Math.min(...dates.map((d) => d.getTime()))
      : Number.POSITIVE_INFINITY;
    return { groupKey, group, sortTime };
  });

  groupEntries.sort(
    (a, b) =>
      a.sortTime - b.sortTime || a.group.title.localeCompare(b.group.title, "cs"),
  );

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

export const buildAxis = (rangeStart: Date, rangeEnd: Date, zoom: Zoom) => {
  const segments: { key: string; label: string; days: number }[] = [];

  if (zoom === "day") {
    let cursor = startOfDay(rangeStart);
    const end = startOfDay(rangeEnd);
    const dayFormatter = new Intl.DateTimeFormat("cs-CZ", {
      day: "2-digit",
      month: "2-digit",
    });
    while (cursor.getTime() <= end.getTime()) {
      segments.push({
        key: cursor.toISOString(),
        label: dayFormatter.format(cursor),
        days: 1,
      });
      cursor = addDays(cursor, 1);
    }
    return segments;
  }

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
    segments.push({
      key: cursor.toISOString(),
      label: fmtMonth.format(cursor),
      days: daysInMonth(cursor),
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return segments;
};

export const calculateChartRange = (rows: Row[]) => {
  const dates = rows.flatMap((r) => (r.start && r.end ? [r.start, r.end] : []));
  if (dates.length === 0) {
    const today = startOfDay(new Date());
    return {
      rangeStart: addDays(startOfWeekMonday(today), -7),
      rangeEnd: addDays(today, 21),
    };
  }

  const min = new Date(Math.min(...dates.map((d) => d.getTime())));
  const max = new Date(Math.max(...dates.map((d) => d.getTime())));
  const paddedStart = addDays(startOfMonth(min), -7);
  const paddedEnd = addDays(endOfMonth(max), 7);
  const today = startOfDay(new Date());
  const todayStart = addDays(startOfMonth(today), -7);
  const todayEnd = addDays(endOfMonth(today), 7);

  return {
    rangeStart: new Date(Math.min(paddedStart.getTime(), todayStart.getTime())),
    rangeEnd: new Date(Math.max(paddedEnd.getTime(), todayEnd.getTime())),
  };
};
