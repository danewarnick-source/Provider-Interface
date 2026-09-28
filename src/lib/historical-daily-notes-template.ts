// Canonical template for the historical daily-notes import.
// Five fixed columns, in this exact order, one header row. This shape is
// the ONLY accepted input for the daily-notes import wizard — there is no
// header-guessing or column-mapping fallback.
import writeXlsxFile from "write-excel-file/browser";
import Papa from "papaparse";

export const TEMPLATE_HEADERS = [
  "Staff Name",
  "Client Name",
  "Date",
  "Narrative",
  "Goals Addressed",
] as const;

export type TemplateColumn = (typeof TEMPLATE_HEADERS)[number];

// The only column allowed to be blank per row.
export const OPTIONAL_COLUMN: TemplateColumn = "Goals Addressed";

const EXAMPLE_ROW: Record<TemplateColumn, string> = {
  "Staff Name": "Jane Doe",
  "Client Name": "John Smith",
  "Date": "2026-05-14",
  "Narrative":
    "Example row — delete before importing. John had a calm morning, ate breakfast independently, and went on a community outing to the library.",
  "Goals Addressed": "Independent meal prep; Community outing",
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
  return writeXlsxFile(data, { sheet: "Daily Notes" }).toBlob();
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
        "This file doesn't match the historical daily-notes template. Download the template above and fill it in — the five columns must be exactly, in this order: " +
        TEMPLATE_HEADERS.join(", ") +
        ". Only \"Goals Addressed\" is allowed to be blank.",
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
