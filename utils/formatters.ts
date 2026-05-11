export {
    formatDecimal,
    formatPercentValue,
    parseDecimal,
    parseFormattedNumber,
} from '@/shared/formatting/decimalFormatters';

import { formatDecimal, parseDecimal } from '@/shared/formatting/decimalFormatters';

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
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
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
    return formatDecimal(value);
};

/**
 * Formátuje číslo pro zobrazení ve vstupních polích s mezerami mezi tisíci
 * @example formatInputNumber(1000000) => "1 000 000"
 */
export const formatInputNumber = (value: number | string): string => {
    const num = typeof value === 'string' ? parseDecimal(value) : value;
    if (num === null || isNaN(num)) return '';
    return formatDecimal(num, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
