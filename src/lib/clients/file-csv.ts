// CSV export of clients with missing Client file items (org matrix).

import { neutralizeCsvFormula } from "../csv-safe.ts";

export type ClientFileMissingCsvRow = {
  full_name: string;
  service_codes: string[];
  missing: number;
  due_soon: number;
  on_file: number;
  missing_items: Array<{ title: string; due_at: string | null }>;
};

function csvCell(value: string): string {
  const safe = neutralizeCsvFormula(value);
  return `"${safe.replace(/"/g, '""')}"`;
}

export function missingClientFileCsv(rows: ClientFileMissingCsvRow[]): string {
  const header = ["Client", "Service codes", "Missing", "Due soon", "On file", "Missing items"];
  const lines = [
    header.map(csvCell).join(","),
    ...rows.map((r) =>
      [
        r.full_name,
        r.service_codes.join(" "),
        String(r.missing),
        String(r.due_soon),
        String(r.on_file),
        r.missing_items.map((i) => i.title).join("; "),
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  return lines.join("\n");
}
