// "Print medication list": the client's active medications on one page
// (pdf-lib, the shared layout from strategies-pdf-layout.ts) for school, a
// day program or the ER. Pure (no Supabase), node --test.

import { PDFDocument } from "pdf-lib";
import {
  ACCENT,
  MUTED,
  PdfCursor,
  embedFonts,
  factsGrid,
  pdfSafe,
  stampPageNumbers,
  titleBlock,
} from "../clients/strategies/strategies-pdf-layout.ts";
import { howTakenLabel } from "./med-rules.ts";
import {
  medStatus,
  nameWithStrength,
  sortMedications,
  whenGivenLabel,
  type DisplayMed,
} from "./med-display.ts";

export type MedListMed = DisplayMed & {
  dosage?: string | null;
  route?: string | null;
  purpose?: string | null;
  side_effects?: string | null;
  prescriber?: string | null;
  start_date?: string | null;
  prn_instructions?: string | null;
  prn_min_hours?: number | string | null;
  prn_max_per_day?: number | null;
};

export interface MedListContext {
  provider: string;
  client: string;
  dob: string | null;
  allergies: readonly string[];
  swallowingRisk: string;
  printedBy: string;
  /** "Oct 14, 2026 3:05 PM" in the agency's time zone. */
  printedAt: string;
}

const orNone = (v: string | null | undefined, none = "Not on file") => v?.trim() || none;

/** The PRN rule line, or null for a scheduled med. */
export function prnRule(m: MedListMed): string | null {
  if (!m.is_prn) return null;
  const parts = [orNone(m.prn_instructions, "As needed")];
  if (m.prn_min_hours != null && m.prn_min_hours !== "")
    parts.push(`at least ${m.prn_min_hours} hours apart`);
  if (m.prn_max_per_day != null) parts.push(`no more than ${m.prn_max_per_day} in 24 hours`);
  return parts.join("; ");
}

/** Label/value lines for one medication (shared by the PDF and its test). */
export function medListLines(m: MedListMed): Array<readonly [string, string]> {
  const lines: Array<readonly [string, string]> = [
    ["Dose", orNone(m.dosage)],
    ["Route", orNone(m.route)],
    ["When", whenGivenLabel(m)],
    ["For", orNone(m.purpose)],
    ["Watch for", orNone(m.side_effects)],
    ["How they take it", howTakenLabel(m.how_taken)],
  ];
  const prn = prnRule(m);
  if (prn) lines.push(["PRN", prn]);
  lines.push(["Prescriber", orNone(m.prescriber)]);
  lines.push(["Started", orNone(m.start_date?.slice(0, 10))]);
  return lines;
}

/** Only meds that are active today (paused and stopped are left off). */
export function printableMeds<T extends MedListMed>(meds: readonly T[]): T[] {
  return sortMedications(meds.filter((m) => medStatus(m) === "active"));
}

export function medListFilename(client: string): string {
  const safe = `${client} medication list`
    .replace(/[^\w\s-]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 90);
  return `${safe || "medication-list"}.pdf`;
}

export async function renderMedListPdf(
  meds: readonly MedListMed[],
  ctx: MedListContext,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafe(`Medication list - ${ctx.client}`));
  pdf.setCreator("Provider Interface");
  const fonts = await embedFonts(pdf);
  const c = new PdfCursor(
    pdf,
    fonts,
    `${ctx.provider} · Medication list · ${ctx.client} · Confidential`,
  );

  titleBlock(c, ctx.provider, "Medication list");
  factsGrid(c, [
    ["Client", ctx.client],
    ["Date of birth", orNone(ctx.dob)],
    ["Allergies", ctx.allergies.length ? ctx.allergies.join(", ") : "None on file"],
    ["Swallowing risk", ctx.swallowingRisk],
  ]);

  const list = printableMeds(meds);
  if (!list.length) c.text("No active medications on file.", { size: 10, color: MUTED });
  for (const m of list) {
    c.gap(4);
    c.ensure(60);
    c.text(nameWithStrength(m), { size: 11, bold: true, color: ACCENT, lead: 15 });
    for (const [label, value] of medListLines(m))
      c.text(`${label}: ${value}`, { size: 9, lead: 12 });
    c.rule();
  }

  c.gap(6);
  c.text(`Printed ${ctx.printedAt} by ${ctx.printedBy}.`, { size: 8, color: MUTED });
  c.text("Check every medication against the pharmacy label.", { size: 8, color: MUTED });
  stampPageNumbers(pdf, fonts.regular);
  return pdf.save();
}
