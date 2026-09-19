/** Decimal strings are authoritative; money is rounded per priced leaf, never per group. */
export function decimal(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim().replace(/[\s\u00a0]/g, '').replace(',', '.');
  if (!/^[+-]?\d+(?:\.\d{1,18})?$/.test(text) || text.length > 48) throw new Error('Neplatné desetinné číslo.');
  const [whole, fraction = ''] = text.replace(/^\+/, '').split('.');
  const result = `${BigInt(whole)}${fraction.replace(/0+$/, '') ? `.${fraction.replace(/0+$/, '')}` : ''}`;
  return whole.startsWith('-') && BigInt(whole) === 0n && /[1-9]/.test(fraction) ? `-${result}` : result;
}
const parts = (value: string): [bigint, number] => {
  const normalized = decimal(value); if (normalized === null) throw new Error('Chybí číslo.');
  const [whole, fraction = ''] = normalized.split('.');
  return [BigInt(whole + fraction), fraction.length];
};
const power = (n: number) => 10n ** BigInt(n);
function render(value: bigint, scale: number): string {
  const abs = (value < 0n ? -value : value).toString().padStart(scale + 1, '0');
  return `${value < 0n ? '-' : ''}${scale ? `${abs.slice(0, -scale)}.${abs.slice(-scale)}` : abs}`;
}
function round(value: bigint, from: number, to: number): bigint {
  if (from <= to) return value * power(to - from);
  const divisor = power(from - to); const sign = value < 0n ? -1n : 1n;
  return (value / divisor) + ((value * sign % divisor) * 2n >= divisor ? sign : 0n);
}
export function money(value: string): string { const [n, s] = parts(value); return render(round(n, s, 2), 2); }
export function multiplyMoney(a: string, b: string): string {
  const [an, as] = parts(a); const [bn, bs] = parts(b); return render(round(an * bn, as + bs, 2), 2);
}
export function sumMoney(values: Array<string | null>): string {
  return render(values.reduce((sum, value) => sum + (value === null ? 0n : BigInt(money(value).replace('.', ''))), 0n), 2);
}
export function compareDecimal(a: string, b: string): number {
  const [an, as] = parts(a); const [bn, bs] = parts(b); const difference = an * power(bs) - bn * power(as);
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}
export const normalizeSearch = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('cs');
export interface ColumnFilter { search?: string; selected?: string[]; min?: string; max?: string }
export type BudgetFilters = Record<string, ColumnFilter>;
export interface FilterableItem { [key: string]: unknown }
export function cellValues(item: FilterableItem, column: string): string[] {
  if (column === '$all') return ['code','description','unit','tenders','tags'].flatMap(key => cellValues(item,key));
  const v = item[column]; return Array.isArray(v) ? (v.length ? v.map(String) : ['']) : [v === null || v === undefined ? '' : String(v)];
}
function matches(item: FilterableItem, column: string, filter: ColumnFilter): boolean {
  const values = cellValues(item, column);
  return (!filter.search || values.some(v => normalizeSearch(v).includes(normalizeSearch(filter.search!))))
    && (filter.selected === undefined || values.some(v => filter.selected!.includes(v)))
    && (!filter.min || values.some(v => v !== '' && compareDecimal(v, filter.min!) >= 0))
    && (!filter.max || values.some(v => v !== '' && compareDecimal(v, filter.max!) <= 0));
}
export function filterItems<T extends FilterableItem>(items: T[], filters: BudgetFilters): T[] {
  return items.filter(item => Object.entries(filters).every(([column, filter]) => matches(item, column, filter)));
}
export function uniqueValues<T extends FilterableItem>(items: T[], column: string, filters: BudgetFilters): string[] {
  const other = Object.fromEntries(Object.entries(filters).filter(([key]) => key !== column));
  return [...new Set(filterItems(items, other).flatMap(item => cellValues(item, column)))].sort((a, b) => a.localeCompare(b, 'cs'));
}
export function validateAllocation(quantity: string, allocations: string[]): void {
  const [q, qs] = parts(quantity); const parsed = allocations.map(parts); const scale = Math.max(qs, ...parsed.map(p => p[1]));
  const available = q * power(scale - qs);
  const used = parsed.reduce((sum, [n, s]) => {
    if ((q >= 0n && n < 0n) || (q < 0n && n > 0n)) throw new Error('Alokace musí mít stejné znaménko jako množství.');
    return sum + n * power(scale - s);
  }, 0n);
  if (available >= 0n ? used > available : used < available) throw new Error('Součet alokací přesahuje množství položky.');
}
/** Bounded recursive descent, fixed 12-digit arithmetic, no JavaScript or Excel execution. */
export function evaluateExpression(expression: string, figures: Record<string, string>): string {
  if (expression.length > 2000) throw new Error('Výraz je příliš dlouhý.');
  const tokens = expression.replace(/,/g, '.').match(/\d+(?:\.\d+)?|[A-Za-z_][A-Za-z_0-9]*|[()+*/-]|\S/g) ?? [];
  let index = 0; let depth = 0; const scale = 12; const factor = power(scale);
  const value = (text: string) => { const [n, s] = parts(text); return round(n, s, scale); };
  const primary = (): bigint => {
    if (++depth > 40) throw new Error('Výraz je příliš složitý.');
    const token = tokens[index++]; let result: bigint;
    if (token === '(') { result = add(); if (tokens[index++] !== ')') throw new Error('Chybí závorka.'); }
    else if (token === '-' || token === '+') result = (token === '-' ? -1n : 1n) * primary();
    else if (/^\d+(\.\d+)?$/.test(token ?? '')) result = value(token);
    else if (token && Object.hasOwn(figures, token)) result = value(figures[token]);
    else throw new Error(`Neznámý výraz nebo figura: ${token ?? ''}`);
    depth--; return result;
  };
  const product = (): bigint => {
    let result = primary();
    while (tokens[index] === '*' || tokens[index] === '/') {
      const op = tokens[index++]; const right = primary();
      if (op === '/' && right === 0n) throw new Error('Dělení nulou.');
      result = op === '*' ? result * right / factor : result * factor / right;
      if (result.toString().length > 48) throw new Error('Výsledek přesahuje limit.');
    }
    return result;
  };
  const add = (): bigint => { let result = product(); while (tokens[index] === '+' || tokens[index] === '-') { const op = tokens[index++]; const right = product(); result = op === '+' ? result + right : result - right; } return result; };
  const result = add(); if (index !== tokens.length) throw new Error('Nepodporovaný výraz.');
  return decimal(render(result, scale))!;
}
export function formatBudgetNumber(value: string | null | undefined, monetary = false): string {
  if(value===null||value===undefined)return '';
  const normalized=monetary?money(value):decimal(value)!;
  const [whole,fraction]=normalized.split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g,'\u00a0')+(fraction?`,${fraction}`:'');
}
