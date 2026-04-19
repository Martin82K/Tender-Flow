import { describe, expect, it } from 'vitest';
import { formatDecimal, formatPercentValue, parseDecimal } from '@/utils/formatters';

describe('parseDecimal', () => {
  it('parsuje český formát s čárkou', () => {
    expect(parseDecimal('1 234,56')).toBe(1234.56);
  });

  it('parsuje non-breaking a narrow no-break space', () => {
    expect(parseDecimal('1\u00A0234\u202F567,89')).toBe(1234567.89);
  });

  it('parsuje anglický formát s tečkou', () => {
    expect(parseDecimal('1,234.56')).toBe(1234.56);
  });

  it('parsuje německý formát (tečka jako tisícovka, čárka jako desetinná)', () => {
    expect(parseDecimal('1.234,56')).toBe(1234.56);
  });

  it('akceptuje jen tečku jako desetinnou', () => {
    expect(parseDecimal('1234.56')).toBe(1234.56);
  });

  it('akceptuje jen čárku jako desetinnou', () => {
    expect(parseDecimal('1234,56')).toBe(1234.56);
  });

  it('odstraní měnu a procentní symbol', () => {
    expect(parseDecimal('1 234,56 Kč')).toBe(1234.56);
    expect(parseDecimal('42,5 %')).toBe(42.5);
  });

  it('zvládne záporná čísla', () => {
    expect(parseDecimal('-1 234,56')).toBe(-1234.56);
  });

  it('vrátí null pro prázdný / neparsovatelný vstup', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal(null)).toBeNull();
    expect(parseDecimal(undefined)).toBeNull();
  });

  it('vrátí číslo přímo pro number vstup', () => {
    expect(parseDecimal(42.5)).toBe(42.5);
    expect(parseDecimal(Number.NaN)).toBeNull();
  });
});

describe('formatDecimal', () => {
  it('formátuje s mezerami mezi tisíci a čárkou', () => {
    expect(formatDecimal(1234567.89)).toBe('1\u00A0234\u00A0567,89');
  });

  it('respektuje minimumFractionDigits', () => {
    expect(formatDecimal(100, { minimumFractionDigits: 2 })).toBe('100,00');
  });

  it('zaokrouhluje podle maximumFractionDigits', () => {
    expect(formatDecimal(1.2345, { maximumFractionDigits: 2 })).toBe('1,23');
  });

  it('vrátí prázdný string pro null/undefined/NaN', () => {
    expect(formatDecimal(null)).toBe('');
    expect(formatDecimal(undefined)).toBe('');
    expect(formatDecimal(Number.NaN)).toBe('');
  });
});

describe('formatPercentValue', () => {
  it('formátuje procenta s českou čárkou', () => {
    expect(formatPercentValue(7.5)).toBe('7,5 %');
    expect(formatPercentValue(100)).toBe('100 %');
  });

  it('vrátí pomlčku pro neplatné', () => {
    expect(formatPercentValue(null)).toBe('—');
    expect(formatPercentValue(undefined)).toBe('—');
  });
});

describe('roundtrip parse → format', () => {
  it('zachovává hodnotu přes format a parse', () => {
    const value = 1234567.89;
    const formatted = formatDecimal(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const parsed = parseDecimal(formatted);
    expect(parsed).toBe(value);
  });
});
