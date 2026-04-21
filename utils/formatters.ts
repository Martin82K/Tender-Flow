/**
 * Centrální knihovna pro formátování čísel
 * Používá české formátování s oddělovači tisíců
 */

/**
 * Formátuje číslo jako měnu v Kč s oddělovači tisíců
 * @example formatMoney(1000000) => "1 000 000 Kč"
 */
export const formatMoney = (value: number): string => {
    if (value === undefined || value === null || isNaN(value)) return '-';
    return new Intl.NumberFormat('cs-CZ', { 
        style: 'currency', 
        currency: 'CZK', 
        maximumFractionDigits: 0 
    }).format(value);
};

/**
 * Zkrácený formát pro velké částky (1M = 1 000 000)
 * @example formatMoneyShort(1500000) => "1.5M Kč"
 */
export const formatMoneyShort = (value: number): string => {
    if (value === undefined || value === null || isNaN(value)) return '-';
    if (value >= 1000000) {
        return (
            new Intl.NumberFormat('cs-CZ', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
            }).format(value / 1000000) + 'M Kč'
        );
    }
    if (value >= 1000) {
        return Math.round(value / 1000) + 'k Kč';
    }
    return formatMoney(value);
};

/**
 * Formátuje číslo s oddělovači tisíců (bez měny)
 * @example formatNumber(1000000) => "1 000 000"
 */
export const formatNumber = (value: number): string => {
    if (value === undefined || value === null || isNaN(value)) return '-';
    return new Intl.NumberFormat('cs-CZ', { 
        maximumFractionDigits: 0 
    }).format(value);
};

/**
 * Formátuje číslo pro zobrazení ve vstupních polích s mezerami mezi tisíci
 * @example formatInputNumber(1000000) => "1 000 000"
 */
export const formatInputNumber = (value: number | string): string => {
    const num = typeof value === 'string' ? parseFloat(value.replace(/\s/g, '')) : value;
    if (isNaN(num)) return '';
    return formatNumber(num);
};

/**
 * Parsuje číslo ze stringu s oddělovači tisíců
 * @example parseFormattedNumber("1 000 000") => 1000000
 */
export const parseFormattedNumber = (value: string): number => {
    const parsed = parseDecimal(value);
    return parsed ?? 0;
};

/**
 * Robustní parsování desetinného čísla — toleruje české i anglické formáty,
 * běžné i non-breaking mezery, narrow no-break space (Intl) a měnové symboly.
 * Vrací `null` pokud vstup není platné číslo (na rozdíl od `parseFormattedNumber`,
 * který vrací 0 — použij ten jen když opravdu chceš fallback).
 *
 * @example parseDecimal("1 234,56") => 1234.56
 * @example parseDecimal("1.234,56 Kč") => 1234.56
 * @example parseDecimal("1,234.56") => 1234.56
 * @example parseDecimal("") => null
 */
export const parseDecimal = (value: string | number | null | undefined): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const raw = String(value).trim();
    if (!raw) return null;

    // Odstranit všechny whitespace (běžná, nbsp U+00A0, narrow nbsp U+202F, figure space U+2007)
    // + ponechat jen číslice, oddělovače, znaménko
    let cleaned = raw.replace(/[\s\u00A0\u202F\u2007]/g, '');
    // Odstranit měnové a procentní symboly a písmenné suffixy (Kč, EUR, CZK…)
    cleaned = cleaned.replace(/[^\d.,+\-]/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '+') return null;

    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');

    if (hasComma && hasDot) {
        // Vícerozličné oddělovače: poslední je desetinný, ostatní jsou tisícové
        const lastComma = cleaned.lastIndexOf(',');
        const lastDot = cleaned.lastIndexOf('.');
        const decimalSep = lastComma > lastDot ? ',' : '.';
        const thousandSep = decimalSep === ',' ? '.' : ',';
        cleaned = cleaned.split(thousandSep).join('');
        if (decimalSep === ',') cleaned = cleaned.replace(',', '.');
    } else if (hasComma) {
        // Jen čárka — předpoklad: desetinná čárka (český formát)
        cleaned = cleaned.replace(',', '.');
    }
    // Jen tečka nebo žádný separator: ponechat

    const num = Number.parseFloat(cleaned);
    return Number.isFinite(num) ? num : null;
};

/**
 * Formátuje desetinné číslo v českém formátu s desetinnou čárkou a mezerami mezi tisíci.
 * @example formatDecimal(1234.5) => "1 234,5"
 * @example formatDecimal(1234.5, { minimumFractionDigits: 2 }) => "1 234,50"
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
 * Formátuje procenta v českém formátu (desetinná čárka).
 * @example formatPercentValue(7.5) => "7,5 %"
 */
export const formatPercentValue = (
    value: number | null | undefined,
    options?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
): string => {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    return `${formatDecimal(value, { maximumFractionDigits: 2, ...options })} %`;
};

/**
 * Formátuje číslo pro osy grafů
 * @example formatChartAxis(1500000) => "1.5M"
 */
export const formatChartAxis = (value: number): string => {
    if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
        return `${Math.round(value / 1000)}k`;
    }
    return value.toString();
};
