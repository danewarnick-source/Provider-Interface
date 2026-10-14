// The monthly MAR printout (pdf-lib, landscape): medication list and the
// month's changes, the grid (half a month per page), signature key, PRN
// log, exceptions, controlled counts and the review page. Built on the
// server only (mar.functions.ts). Pure (no Supabase), node --test.

import { PDFDocument } from "pdf-lib";
import { MUTED, embedFonts, wrapText } from "../clients/strategies-pdf-layout.ts";
import { formatTime12, nameWithStrength } from "./med-display.ts";
import { cellCode, summaryLine, type MarCell } from "./mar-cells.ts";
import type { MarMonthData } from "./mar-data.ts";
import {
  L_CONTENT_W,
  L_MARGIN,
  MarPages,
  SHADE,
  stampFooters,
  type MarPageHeader,
} from "./mar-pdf-layout.ts";
import {
  changeRows,
  countRows,
  exceptionRows,
  medicationListRows,
  prnRows,
  signatureRows,
} from "./mar-pdf-rows.ts";

export const MAR_PDF_SECTIONS = [
  "Medication list",
  "MAR grid",
  "Signature key",
  "PRN log",
  "Exceptions",
  "Controlled counts",
  "Review",
] as const;

export interface MarPdfInput {
  header: MarPageHeader;
  data: MarMonthData;
  /** The sign-off this PDF records, or null for a plain printout. */
  review: { by: string; at: string; notes: string | null } | null;
  printed: string;
}

export const GRID_KEY =
  "R refused · M missed · H held · NA not at home · * late entry · ! medication error · # given by staff without current med training · PRN rows show doses given that day";

function cellText(c: MarCell): string {
  const code = cellCode(c);
  return `${code}${c.late ? "*" : ""}${c.error ? "!" : ""}${c.untrained ? "#" : ""}`;
}

function drawGrid(w: MarPages, data: MarMonthData, from: number, to: number) {
  const days = data.grid.days.slice(from, to);
  const labelW = 170;
  const colW = (L_CONTENT_W - labelW) / days.length;
  const rowH = 16;
  const size = 6;
  const header = () => {
    w.ensure(rowH + 4);
    w.page.drawRectangle({
      x: L_MARGIN,
      y: w.y - rowH,
      width: L_CONTENT_W,
      height: rowH,
      color: SHADE,
    });
    w.draw("Medication and time", L_MARGIN + 2, w.y - 11, 7, true);
    days.forEach((d, i) =>
      w.draw(String(Number(d.slice(8))), L_MARGIN + labelW + i * colW + 2, w.y - 11, 7, true),
    );
    w.y -= rowH;
  };
  header();
  for (const row of data.grid.rows) {
    if (w.ensure(rowH)) header();
    const med = data.meds.find((m) => m.id === row.medId);
    const label = `${med ? nameWithStrength(med) : "Medication"} - ${row.time ? formatTime12(row.time) : "PRN"}${row.oldTime ? " (old time)" : ""}`;
    w.draw(wrapText(label, w.fonts.regular, 7, labelW - 4)[0] ?? "", L_MARGIN + 2, w.y - 10, 7);
    days.forEach((_, i) => {
      const x = L_MARGIN + labelW + i * colW + 1.5;
      const text = row.time
        ? cellText(row.cells[from + i])
        : row.prnCounts[from + i]
          ? String(row.prnCounts[from + i])
          : "";
      const lines = wrapText(text, w.fonts.regular, size, colW - 3).slice(0, 2);
      lines.forEach((line, j) => w.draw(line, x, w.y - 7 - j * 7, size));
    });
    w.y -= rowH;
    w.page.drawLine({
      start: { x: L_MARGIN, y: w.y },
      end: { x: L_MARGIN + L_CONTENT_W, y: w.y },
      thickness: 0.3,
      color: MUTED,
    });
  }
}

export async function renderMarPdf(input: MarPdfInput): Promise<Uint8Array> {
  const { data } = input;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`MAR ${input.header.month} - ${input.header.client}`);
  pdf.setCreator("Provider Interface");
  const fonts = await embedFonts(pdf);
  const w = new MarPages(pdf, fonts, input.header);

  w.newPage("Medication list");
  w.table(
    [
      { label: "Medication", width: 16 },
      { label: "Dose", width: 8 },
      { label: "Route", width: 7 },
      { label: "Times", width: 10 },
      { label: "For", width: 12 },
      { label: "Prescriber", width: 10 },
      { label: "Start", width: 6 },
      { label: "Stop", width: 6 },
      { label: "PRN rules", width: 15 },
      { label: "Flags", width: 10 },
    ],
    medicationListRows(data),
    "No medications this month.",
  );
  w.y -= 12;
  w.ensure(30);
  w.draw("Changes made during the month", L_MARGIN, (w.y -= 12), 10, true);
  w.y -= 4;
  w.table(
    [
      { label: "Date", width: 6 },
      { label: "Medication", width: 16 },
      { label: "Change", width: 9 },
      { label: "Details", width: 40 },
      { label: "By", width: 12 },
    ],
    changeRows(data),
    "No changes this month.",
  );

  const half = Math.ceil(data.grid.days.length / 2);
  for (const [from, to] of [
    [0, half],
    [half, data.grid.days.length],
  ]) {
    w.newPage(`MAR grid (days ${from + 1}-${to})`);
    w.note(summaryLine(data.grid.summary), 8);
    w.y -= 4;
    drawGrid(w, data, from, to);
    w.note(GRID_KEY, 7);
  }

  w.newPage("Signature key");
  w.table(
    [
      { label: "Initials", width: 6 },
      { label: "Full name", width: 20 },
      { label: "Title", width: 20 },
    ],
    signatureRows(data),
    "No doses were logged this month.",
    9,
  );

  w.newPage("PRN log");
  w.table(
    [
      { label: "Date", width: 5 },
      { label: "Time", width: 5 },
      { label: "Medication", width: 13 },
      { label: "Dose", width: 7 },
      { label: "Reason", width: 13 },
      { label: "Tried first", width: 10 },
      { label: "Helped?", width: 6 },
      { label: "Follow-up", width: 9 },
      { label: "Count before", width: 7 },
      { label: "Count after", width: 7 },
      { label: "Staff", width: 10 },
    ],
    prnRows(data),
    "No as-needed doses this month.",
  );

  w.newPage("Exceptions");
  w.table(
    [
      { label: "Date", width: 5 },
      { label: "Time", width: 5 },
      { label: "Medication", width: 14 },
      { label: "What", width: 9 },
      { label: "Details", width: 45 },
    ],
    exceptionRows(data),
    "No refused, missed or held doses, errors, late entries or corrections this month.",
  );

  w.newPage("Controlled counts");
  w.table(
    [
      { label: "Date", width: 5 },
      { label: "Time", width: 5 },
      { label: "Medication", width: 16 },
      { label: "Count before", width: 7 },
      { label: "Count after", width: 7 },
      { label: "Expected before", width: 8 },
      { label: "Expected after", width: 8 },
      { label: "Flag", width: 5 },
      { label: "Staff", width: 12 },
    ],
    countRows(data),
    "No controlled doses or counts this month.",
  );

  w.newPage("Review");
  const r = input.review;
  const line = (label: string, value: string) => {
    w.y -= 22;
    w.draw(`${label}:`, L_MARGIN, w.y, 10, true);
    w.draw(value || "_______________________________", L_MARGIN + 110, w.y, 10);
  };
  line("Reviewed by", r?.by ?? "");
  line("Date", r?.at ?? "");
  line("Signature", r ? `Signed electronically by ${r.by}` : "");
  if (r?.notes) {
    w.y -= 10;
    w.note(`Notes: ${r.notes}`, 9);
  }
  w.y -= 14;
  w.note(summaryLine(data.grid.summary), 9);

  stampFooters(pdf, fonts, input.printed);
  return pdf.save();
}
