// Renders the support strategies document (strategies-doc.ts) as a PDF with
// pdf-lib: title block, the details table, each goal with its supports and
// strategy bullets, services needing no strategy, and the footer notes.
// Pure (no Supabase), node --test.

import { PDFDocument } from "pdf-lib";
import type { StrategiesDoc } from "./strategies-doc.ts";
import { NO_STRATEGY_TEXT } from "./strategies-doc.ts";
import {
  ACCENT,
  MUTED,
  PdfCursor,
  embedFonts,
  factsGrid,
  pdfSafe,
  stampPageNumbers,
  titleBlock,
} from "./strategies-pdf-layout.ts";

export async function renderStrategiesPdf(doc: StrategiesDoc): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafe(`${doc.title} - ${doc.client}`));
  pdf.setCreator("Provider Interface");
  const fonts = await embedFonts(pdf);
  const c = new PdfCursor(
    pdf,
    fonts,
    `${doc.provider} · ${doc.title} · ${doc.client} · Confidential`,
  );

  titleBlock(c, doc.provider, doc.title);
  factsGrid(c, [
    ["Client", doc.client],
    ["Service provider", doc.provider],
    ["PCSP plan year", doc.planYear],
    ["Support coordinator", doc.coordinator],
    ["Date prepared", doc.prepared],
    ["Approved", doc.approved],
  ]);

  // Goals and supports
  doc.goals.forEach((g, gi) => {
    c.gap(8);
    c.ensure(60);
    c.text(`Goal ${gi + 1}`, { size: 8, bold: true, color: MUTED });
    c.text(g.goal, { size: 12, bold: true, color: ACCENT, lead: 16 });
    for (const s of g.supports) {
      c.gap(6);
      c.ensure(50);
      c.text(s.support, { size: 10.5, bold: true, indent: 8 });
      if (s.details.trim())
        c.text(`Support details: ${s.details}`, { size: 9, color: MUTED, indent: 8 });
      c.text(`Service codes: ${s.codes.join(", ") || "None"}`, {
        size: 9,
        color: MUTED,
        indent: 8,
      });
      c.gap(2);
      c.text("Support strategies", { size: 8, bold: true, color: MUTED, indent: 8 });
      if (s.bullets.length) for (const b of s.bullets) c.bullet(b, 14);
      else c.text(NO_STRATEGY_TEXT, { size: 10, color: MUTED, indent: 14 });
    }
  });
  if (!doc.goals.length) c.text("No support needs a strategy in this plan year.", { color: MUTED });

  if (doc.notNeeded.length) {
    c.gap(10);
    c.rule();
    c.text("Services without a separate strategy", {
      size: 12,
      bold: true,
      color: ACCENT,
      lead: 16,
    });
    for (const n of doc.notNeeded) {
      c.bullet(`${n.support || "Support"} (${n.codes.join(", ")}): ${n.reason}`, 6, 9.5);
    }
  }

  if (doc.approvalNote) {
    c.gap(10);
    c.text("Approved with supports lacking a strategy", { size: 9, bold: true, color: MUTED });
    c.text(doc.approvalNote, { size: 9.5 });
  }

  c.gap(12);
  c.rule();
  for (const line of doc.footer) c.text(line, { size: 8, color: MUTED, lead: 11 });

  stampPageNumbers(pdf, fonts.regular);
  return pdf.save();
}

/** Bytes as base64 (Worker-safe), for returning from a server function. */
export function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
