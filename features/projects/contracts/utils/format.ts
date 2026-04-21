const CURRENCY_FALLBACKS: Record<string, string> = {
  'KČ': 'CZK',
  'KC': 'CZK',
};

const normalizeCurrency = (currency?: string): string => {
  if (!currency) return 'CZK';
  const upper = currency.trim().toUpperCase();
  if (CURRENCY_FALLBACKS[upper]) return CURRENCY_FALLBACKS[upper];
  if (/^[A-Z]{3}$/.test(upper)) return upper;
  return 'CZK';
};

export const formatMoney = (value: number | null | undefined, currency = 'CZK'): string => {
  const amount = Number.isFinite(value) ? (value as number) : 0;
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: normalizeCurrency(currency),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (value?: string | null): string => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('cs-CZ');
};

export const formatPercent = (value?: number | null): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('cs-CZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value as number)} %`;
};

export const daysUntil = (value?: string | null): number | null => {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

export const addMonthsIso = (startIso?: string | null, months?: number | null): string | null => {
  if (!startIso || !months) return null;
  const date = new Date(startIso);
  if (Number.isNaN(date.getTime())) return null;
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
};
