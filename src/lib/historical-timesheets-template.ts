// Canonical template for the historical timesheets import.
// Six fixed columns, in this exact order, one header row. This shape is
// the ONLY accepted input for the import wizard — there is no free-form
// column-mapping fallback.
import writeXlsxFile from "write-excel-file/browser";
import Papa from "papaparse";

export const TEMPLATE_HEADERS = [
  "Staff Name",
  "Client Name",
  "Clock In",
  "Clock Out",
  "Service Code",
  "Notes",
] as const;

export type TemplateColumn = (typeof TEMPLATE_HEADERS)[number];

const EXAMPLE_ROW: Record<TemplateColumn, string> = {
  "Staff Name": "Jane Doe",
  "Client Name": "John Smith",
  "Clock In": "2026-05-14 08:00",
  "Clock Out": "2026-05-14 12:30",
  "Service Code": "SLH",
  "Notes": "Example row — delete before importing",
};

export function buildTemplateCsv(): string {
  return Papa.unparse({
    fields: [...TEMPLATE_HEADERS],
    data: [EXAMPLE_ROW],
  });
}

export async function buildTemplateXlsxBlob(): Promise<Blob> {
  const data = [
    TEMPLATE_HEADERS.map((h) => ({ value: h, fontWeight: "bold" as const })),
    TEMPLATE_HEADERS.map((h) => ({ value: EXAMPLE_ROW[h] ?? "" })),
  ];
  return writeXlsxFile(data, { sheet: "Timesheets" }).toBlob();
}

/** Case-insensitive, trimmed header match against TEMPLATE_HEADERS in order. */
export function validateTemplateHeaders(
  headers: string[],
): { ok: true } | { ok: false; message: string } {
  const norm = (s: string) => s.trim().toLowerCase();
  const got = headers.map(norm);
  const want = TEMPLATE_HEADERS.map(norm);
  if (got.length !== want.length || want.some((w, i) => got[i] !== w)) {
    return {
      ok: false,
      message:
        "This file doesn't match the historical timesheets template. Download the template above and fill it in — the six columns must be exactly: " +
        TEMPLATE_HEADERS.join(", ") + ".",
    };
  }
  return { ok: true };
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
