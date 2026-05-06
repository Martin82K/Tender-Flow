/**
 * Robustní parsování desetinného čísla — toleruje české i anglické formáty,
 * běžné i non-breaking mezery, narrow no-break space (Intl) a měnové symboly.
 * Vrací `null` pokud vstup není platné číslo.
 */
export const parseDecimal = (value: string | number | null | undefined): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const raw = String(value).trim();
    if (!raw) return null;

    let cleaned = raw.replace(/[\s\u00A0\u202F\u2007]/g, '');
    cleaned = cleaned.replace(/[^\d.,+\-]/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '+') return null;

    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');

    if (hasComma && hasDot) {
        const lastComma = cleaned.lastIndexOf(',');
        const lastDot = cleaned.lastIndexOf('.');
        const decimalSep = lastComma > lastDot ? ',' : '.';
        const thousandSep = decimalSep === ',' ? '.' : ',';
        cleaned = cleaned.split(thousandSep).join('');
        if (decimalSep === ',') cleaned = cleaned.replace(',', '.');
    } else if (hasComma) {
        cleaned = cleaned.replace(',', '.');
    }

    const num = Number.parseFloat(cleaned);
    return Number.isFinite(num) ? num : null;
};

/**
 * Formátuje desetinné číslo v českém formátu s desetinnou čárkou a mezerami mezi tisíci.
 */
export const formatDecimal = (
    value: number | null | undefined,
    options?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
): string => {
    if (value === null || value === undefined || !Number.isFinite(value)) return '';
    return new Intl.NumberFormat('cs-CZ', {
        minimumFractionDigits: options?.minimumFractionDigits ?? 0,
        maximumFractionDigits: options?.maximumFractionDigits ?? 2,
    }).format(value as number);
};

/**
 * Formátuje procenta v českém formátu.
 */
export const formatPercentValue = (
    value: number | null | undefined,
    options?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
): string => {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    return `${formatDecimal(value, { maximumFractionDigits: 2, ...options })} %`;
};
