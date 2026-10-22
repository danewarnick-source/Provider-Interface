// Renders the progress summary document (progress-summary-doc.ts) as a PDF
// with the support strategies PDF layout (strategies-pdf-layout.ts): title
// block (with the agency logo when there is one), the details table, the
// draft mark, each goal with its supports and progress, the incidents
// paragraph, general notes and the sign-off. The source records (evidence,
// incident reports) are never printed. Pure (no Supabase), node --test.

import { PDFDocument } from "pdf-lib";
import {
  ACCENT,
  MARGIN,
  MUTED,
  PAGE_H,
  PAGE_W,
  PdfCursor,
  embedFonts,
  factsGrid,
  pdfSafe,
  stampPageNumbers,
  titleBlock,
} from "./clients/strategies-pdf-layout.ts";
import { NO_PROGRESS_TEXT, incidentsParagraph, type SummaryDoc } from "./progress-summary-doc.ts";

export type PdfLogo = { bytes: Uint8Array; type: "png" | "jpg" };

export async function renderSummaryPdf(
  doc: SummaryDoc,
  o: { clientName: string; logo?: PdfLogo | null } = { clientName: "" },
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafe(`${doc.title} - ${o.clientName}`));
  pdf.setCreator("Provider Interface");
  const fonts = await embedFonts(pdf);
  const c = new PdfCursor(
    pdf,
    fonts,
    `${doc.provider} · ${doc.title} · ${o.clientName} · Confidential`,
  );

  if (o.logo) {
    try {
      const img =
        o.logo.type === "png" ? await pdf.embedPng(o.logo.bytes) : await pdf.embedJpg(o.logo.bytes);
      const s = img.scaleToFit(110, 40);
      c.page.drawImage(img, {
        x: PAGE_W - MARGIN - s.width,
        y: PAGE_H - MARGIN - 22 - s.height,
        ...s,
      });
    } catch {
      // An unreadable logo never blocks the document.
    }
  }

  titleBlock(c, doc.provider, doc.title);
  if (doc.draftMark) {
    c.text(doc.draftMark.toUpperCase(), { size: 9, bold: true, color: ACCENT });
    c.gap(4);
  }
  factsGrid(c, doc.facts);

  doc.goals.forEach((g, gi) => {
    c.gap(8);
    c.ensure(60);
    c.text(`Goal ${gi + 1}`, { size: 8, bold: true, color: MUTED });
    c.text(g.goal, { size: 12, bold: true, color: ACCENT, lead: 16 });
    for (const s of g.supports) {
      c.gap(4);
      c.ensure(40);
      c.text(`Support: ${s.support}`, { size: 10.5, bold: true, indent: 8 });
      if (s.details) c.text(`Support details: ${s.details}`, { size: 9, color: MUTED, indent: 8 });
    }
    c.gap(4);
    c.text("Progress / summary of services", { size: 8, bold: true, color: MUTED, indent: 8 });
    c.text(g.progress || NO_PROGRESS_TEXT, { size: 10, indent: 8 });
  });

  c.gap(10);
  c.rule();
  c.text("Incidents", { size: 12, bold: true, color: ACCENT, lead: 16 });
  c.text(incidentsParagraph(doc), { size: 10 });

  c.gap(10);
  c.rule();
  c.text("General notes", { size: 12, bold: true, color: ACCENT, lead: 16 });
  c.text(doc.general.notes || "None.", { size: 10, color: doc.general.notes ? undefined : MUTED });

  if (doc.signoff.length) {
    c.gap(12);
    c.rule();
    for (const line of doc.signoff) c.text(line, { size: 8.5, color: MUTED, lead: 12 });
  }

  stampPageNumbers(pdf, fonts.regular);
  return pdf.save();
}
