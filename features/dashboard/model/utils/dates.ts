const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function toUtcStartOfDay(value: Date | string): Date | null {
  const d = typeof value === "string" ? new Date(value) : value;
  if (!d || Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function dateDiffDays(target: Date | string, from: Date | string): number | null {
  const a = toUtcStartOfDay(target);
  const b = toUtcStartOfDay(from);
  if (!a || !b) return null;
  return Math.round((a.getTime() - b.getTime()) / MS_PER_DAY);
}

export function formatIsoDate(date: Date): string {
  const d = toUtcStartOfDay(date);
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  const base = toUtcStartOfDay(date);
  if (!base) return date;
  return new Date(base.getTime() + days * MS_PER_DAY);
}
