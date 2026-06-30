export const formatBudgetCurrency = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return "0 Kč";
  return `${value.toLocaleString("cs-CZ", {
    maximumFractionDigits: 2,
  })} Kč`;
};

export const parseBudgetNumber = (value: string): number | null => {
  const normalized = value
    .trim()
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(",", ".");

  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const sanitizeBudgetFileSegment = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "vyberove_rizeni";
