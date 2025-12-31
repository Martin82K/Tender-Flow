export type A1Address = { row: number; col: number };

export const colToNumber = (letters: string): number => {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) throw new Error(`Invalid column letter: ${letters}`);
    n = n * 26 + (code - 64);
  }
  return n;
};

export const numberToCol = (n: number): string => {
  if (n <= 0) throw new Error(`Invalid column number: ${n}`);
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

export const parseA1 = (addr: string): A1Address => {
  const m = /^([A-Za-z]+)(\d+)$/.exec(addr.trim());
  if (!m) throw new Error(`Invalid A1 address: ${addr}`);
  return { col: colToNumber(m[1]), row: Number(m[2]) };
};

export const formatA1 = ({ row, col }: A1Address): string => `${numberToCol(col)}${row}`;

export const parseA1Range = (range: string): { s: A1Address; e: A1Address } => {
  const parts = range.split(":");
  if (parts.length !== 2) throw new Error(`Invalid A1 range: ${range}`);
  const a = parseA1(parts[0]);
  const b = parseA1(parts[1]);
  return {
    s: { row: Math.min(a.row, b.row), col: Math.min(a.col, b.col) },
    e: { row: Math.max(a.row, b.row), col: Math.max(a.col, b.col) },
  };
};

export const formatA1Range = (s: A1Address, e: A1Address): string => `${formatA1(s)}:${formatA1(e)}`;

