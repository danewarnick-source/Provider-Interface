/**
 * Shared spreadsheet-import cell rules (team members and clients): header
 * matching, dates, yes/no, lists and finding the header row. Pure; the file
 * reading and templates live in files.ts.
 */

/** "Date of Birth (M/D/YYYY)" → "date_of_birth_m_d_yyyy". */
export function slugCell(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function cellText(v: unknown): string {
  return String(v ?? "").trim();
}

export function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function monthNumber(name: string): number {
  return MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;
}

function fullYear(y: string): number {
  return y.length === 2 ? 2000 + Number(y) : Number(y);
}

function validYmd(y: number, mo: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return dt.toISOString().slice(0, 10);
}

/** Excel's day 1 is 1900-01-01 (with the 1900 leap-year bug, hence the 1899-12-30 epoch). */
function excelSerialToYmd(n: number): string | null {
  if (!Number.isFinite(n) || n < 1000 || n > 2958465) return null;
  const utc = Date.UTC(1899, 11, 30) + Math.floor(n) * 86_400_000;
  return new Date(utc).toISOString().slice(0, 10);
}

/**
 * Dates: YYYY-MM-DD (or /), M/D/YYYY (or - .), M/D/YY (→ 20YY), "Sep 1, 2026",
 * "1 Sep 2026" and Excel serial numbers. Anything else comes back trimmed so
 * review can flag it.
 */
export function normalizeImportDate(raw: unknown): string {
  if (typeof raw === "number") return excelSerialToYmd(raw) ?? String(raw);
  const t = String(raw ?? "").trim();
  if (!t) return "";
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(t);
  if (m) return validYmd(+m[1], +m[2], +m[3]) ?? t;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})$/.exec(t);
  if (m) return validYmd(fullYear(m[3]), +m[1], +m[2]) ?? t;
  m = /^([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/i.exec(t);
  if (m && monthNumber(m[1])) return validYmd(+m[3], monthNumber(m[1]), +m[2]) ?? t;
  m = /^(\d{1,2})\s+([a-z]{3,9})\.?,?\s+(\d{4})$/i.exec(t);
  if (m && monthNumber(m[2])) return validYmd(+m[3], monthNumber(m[2]), +m[1]) ?? t;
  if (/^\d+(\.\d+)?$/.test(t)) return excelSerialToYmd(Number(t)) ?? t;
  return t;
}

/** yes/no → boolean; blank → false; anything else → null (flagged). */
export function parseYesNo(raw: unknown): boolean | null {
  const t = slugCell(raw);
  if (!t) return false;
  if (["yes", "y", "true", "1", "x"].includes(t)) return true;
  if (["no", "n", "false", "0"].includes(t)) return false;
  return null;
}

/** "DSI; hhs ;; DSI" → ["DSI", "HHS"] (upper-cased, no blanks, no repeats). */
export function splitCodeList(raw: unknown): string[] {
  const out: string[] = [];
  for (const part of cellText(raw).split(";")) {
    const code = part.trim().toUpperCase();
    if (code && !out.includes(code)) out.push(code);
  }
  return out;
}

export function newRowId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Rows above the header (a title, a "how to fill this in" note) are skipped. */
export const HEADER_SCAN_ROWS = 10;

export type GridColumns<C extends string> = {
  columnFor: (raw: unknown) => C | null;
  isHeader: (cells: readonly unknown[]) => boolean;
  /** Column order when no header row is found; null means a header is required. */
  pasteOrder: readonly C[] | null;
};

export type ReadGrid<C extends string> = {
  records: Array<Partial<Record<C, unknown>>>;
  ignoredColumns: string[];
  headerFound: boolean;
};

/**
 * Grid → one record per data row. The header is the first of the first
 * HEADER_SCAN_ROWS non-blank rows that isHeader accepts; rows above it are
 * skipped. Two cells mapping to the same column are joined with a space.
 */
export function readGrid<C extends string>(
  grid: ReadonlyArray<readonly unknown[]>,
  cols: GridColumns<C>,
): ReadGrid<C> {
  const lines = grid.filter((cells) => cells.some((c) => cellText(c)));
  const at = lines.slice(0, HEADER_SCAN_ROWS).findIndex((cells) => cols.isHeader(cells));
  if (at < 0 && !cols.pasteOrder) return { records: [], ignoredColumns: [], headerFound: false };
  const header = at >= 0 ? lines[at] : [];
  const columns: Array<C | null> =
    at >= 0 ? header.map((h) => cols.columnFor(h)) : [...(cols.pasteOrder ?? [])];
  const ignoredColumns =
    at >= 0 ? header.filter((h, i) => cellText(h) && !columns[i]).map((h) => cellText(h)) : [];
  const records = lines.slice(at + 1).map((cells) => {
    const parts: Partial<Record<C, unknown>> = {};
    cells.forEach((value, i) => {
      const col = columns[i];
      if (!col || !cellText(value)) return;
      parts[col] = parts[col] ? `${cellText(parts[col])} ${cellText(value)}` : value;
    });
    return parts;
  });
  return { records, ignoredColumns, headerFound: at >= 0 };
}
