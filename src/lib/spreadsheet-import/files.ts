/**
 * Shared spreadsheet-import files (team members and clients): paste / CSV /
 * Excel → grid, and the downloadable CSV and Excel templates (an example row,
 * a "How to fill this in" sheet and optional list dropdowns).
 */
import Papa from "papaparse";
import * as XLSX from "xlsx";

function splitPasteLine(line: string): string[] {
  if (line.includes("\t")) return line.split("\t");
  const parsed = Papa.parse<string[]>(line, { header: false, skipEmptyLines: true });
  const row = parsed.data?.[0];
  return Array.isArray(row) ? row.map((c) => String(c ?? "")) : [line];
}

/** Pasted rows or CSV text → grid (tab- or comma-separated). */
export function gridFromText(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map(splitPasteLine);
}

/** CSV or Excel bytes → grid. Excel keeps raw cell values so serial dates stay numbers. */
export function gridFromWorkbook(buf: ArrayBuffer): unknown[][] {
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
}

export async function gridFromFile(file: File): Promise<unknown[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv" || name.endsWith(".txt")) {
    return gridFromText(await file.text());
  }
  return gridFromWorkbook(await file.arrayBuffer());
}

/** CSV template: optional note line(s) above the header, then the example row. */
export function templateCsv(
  headers: readonly string[],
  example: readonly string[],
  noteLines: readonly string[] = [],
): string {
  const body = Papa.unparse({ fields: [...headers], data: [[...example]] });
  if (!noteLines.length) return body;
  return [...noteLines.map((n) => Papa.unparse([[n]])), body].join("\r\n");
}

export type TemplateDropdown = {
  /** Index of the column on the first sheet. */
  column: number;
  /** Column letter on the Lists sheet. */
  listColumn: string;
  count: number;
  title: string;
};

export type XlsxTemplate = {
  sheetName: string;
  headers: readonly string[];
  example: readonly string[];
  /** "How to fill this in": one [column, what to type] line per row. */
  notes: ReadonlyArray<readonly [string, string]>;
  /** Lists sheet (first row = titles) for the dropdowns. */
  lists?: string[][];
  dropdowns?: readonly TemplateDropdown[];
  maxRows: number;
};

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A-Z then AA… for a 0-based column index. */
export function columnLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/**
 * Excel template: the data sheet with the example row, then "How to fill this
 * in", then (when given) a Lists sheet that the dropdowns point at (no
 * 255-character inline limit).
 */
export async function buildXlsxTemplate(t: XlsxTemplate): Promise<Uint8Array> {
  const ws = XLSX.utils.aoa_to_sheet([[...t.headers], [...t.example]]);
  ws["!cols"] = t.headers.map((h, i) => ({
    wch: Math.max(h.length, String(t.example[i] ?? "").length, 14),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, t.sheetName);
  if (t.lists) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(t.lists), "Lists");
  const notes = XLSX.utils.aoa_to_sheet([
    ["Column", "What to type"],
    ...t.notes.map((n) => [...n]),
  ]);
  notes["!cols"] = [{ wch: 28 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, notes, "How to fill this in");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

  const validations = (t.dropdowns ?? [])
    .filter((d) => d.count > 0)
    .map((d) => {
      const col = columnLetter(d.column);
      return (
        `<dataValidation type="list" allowBlank="1" showErrorMessage="1" ` +
        `errorTitle="${xmlEscape(d.title)}" error="${xmlEscape(`Choose a ${d.title.toLowerCase()} from the list.`)}" ` +
        `sqref="${col}2:${col}${t.maxRows + 1}">` +
        `<formula1>Lists!$${d.listColumn}$2:$${d.listColumn}$${d.count + 1}</formula1></dataValidation>`
      );
    });
  if (!validations.length) return new Uint8Array(out);

  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(out);
  const sheetPath = "xl/worksheets/sheet1.xml";
  const file = zip.file(sheetPath);
  if (!file) throw new Error("Excel template is missing a worksheet.");
  const xml = await file.async("string");
  if (!xml.includes("</worksheet>")) throw new Error("Excel template worksheet is incomplete.");
  const block = `<dataValidations count="${validations.length}">${validations.join("")}</dataValidations>`;
  // dataValidations sits before pageMargins in the worksheet schema order.
  const at = xml.includes("<pageMargins") ? "<pageMargins" : "</worksheet>";
  zip.file(sheetPath, xml.replace(at, `${block}${at}`));
  return zip.generateAsync({ type: "uint8array" });
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(text: string, name: string): void {
  downloadBlob(new Blob([text], { type: "text/csv" }), name);
}

export function downloadXlsx(bytes: Uint8Array, name: string): void {
  downloadBlob(
    new Blob([bytes.buffer as ArrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    name,
  );
}
