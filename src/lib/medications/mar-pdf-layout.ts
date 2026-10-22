// Landscape page writer for the MAR PDF (pdf-lib): every page opens with the
// agency, client, DOB, Medicaid ID, month and allergies; sections start on a
// new page; tables wrap their cells and repeat the header row after a page
// break. Pure (no Supabase), node --test.

import { rgb, type PDFDocument, type PDFPage } from "pdf-lib";
import {
  ACCENT,
  INK,
  MUTED,
  RULE,
  pdfSafe,
  wrapText,
  type Fonts,
} from "../clients/strategies/strategies-pdf-layout.ts";

export const L_W = 792;
export const L_H = 612;
export const L_MARGIN = 32;
export const L_CONTENT_W = L_W - L_MARGIN * 2;
const BOTTOM = L_MARGIN + 16;
export const SHADE = rgb(0.94, 0.95, 0.97);

export interface MarPageHeader {
  provider: string;
  client: string;
  dob: string;
  medicaidId: string;
  month: string;
  allergies: string;
}

export interface Column {
  label: string;
  /** Share of the content width; columns are scaled to fill it. */
  width: number;
}

export class MarPages {
  page!: PDFPage;
  y = 0;
  readonly fonts: Fonts;
  private pdf: PDFDocument;
  private header: MarPageHeader;
  private section = "";

  constructor(pdf: PDFDocument, fonts: Fonts, header: MarPageHeader) {
    this.pdf = pdf;
    this.fonts = fonts;
    this.header = header;
  }

  /** New page with the client header and the section title. */
  newPage(section = this.section) {
    this.section = section;
    this.page = this.pdf.addPage([L_W, L_H]);
    const h = this.header;
    let y = L_H - L_MARGIN - 10;
    this.draw(
      `${h.provider} - Medication Administration Record - ${h.month}`,
      L_MARGIN,
      y,
      11,
      true,
      ACCENT,
    );
    y -= 13;
    const facts = `Client: ${h.client}    DOB: ${h.dob}    Medicaid ID: ${h.medicaidId}    Allergies: ${h.allergies}`;
    const line = wrapText(facts, this.fonts.regular, 8, L_CONTENT_W)[0] ?? "";
    this.draw(line, L_MARGIN, y, 8, false, INK);
    y -= 6;
    this.page.drawLine({
      start: { x: L_MARGIN, y },
      end: { x: L_W - L_MARGIN, y },
      thickness: 1,
      color: ACCENT,
    });
    y -= 16;
    if (section) this.draw(section, L_MARGIN, y, 12, true, ACCENT);
    this.y = y - 8;
  }

  draw(s: string, x: number, y: number, size: number, bold = false, color = INK) {
    this.page.drawText(pdfSafe(s), {
      x,
      y,
      size,
      font: bold ? this.fonts.bold : this.fonts.regular,
      color,
    });
  }

  /** Room for `h` points, else a new page in the same section. */
  ensure(h: number): boolean {
    if (this.y - h >= BOTTOM) return false;
    this.newPage();
    return true;
  }

  note(s: string, size = 9, color = MUTED) {
    for (const line of wrapText(s, this.fonts.regular, size, L_CONTENT_W)) {
      this.ensure(size + 4);
      this.y -= size + 4;
      this.draw(line, L_MARGIN, this.y, size, false, color);
    }
  }

  /** A wrapped table; `empty` is printed when there are no rows. */
  table(columns: Column[], rows: string[][], empty: string, size = 7.5) {
    const total = columns.reduce((a, c) => a + c.width, 0);
    const widths = columns.map((c) => (c.width / total) * L_CONTENT_W);
    const lead = size + 2.5;
    const drawHeader = () => {
      this.ensure(lead + 6);
      this.page.drawRectangle({
        x: L_MARGIN,
        y: this.y - lead - 2,
        width: L_CONTENT_W,
        height: lead + 4,
        color: SHADE,
      });
      let x = L_MARGIN + 2;
      this.y -= lead;
      columns.forEach((c, i) => {
        this.draw(c.label, x, this.y, size, true, ACCENT);
        x += widths[i];
      });
      this.y -= 4;
    };
    drawHeader();
    if (!rows.length) {
      this.note(empty, size + 1);
      return;
    }
    for (const row of rows) {
      const cells = row.map((v, i) =>
        wrapText(v ?? "", this.fonts.regular, size, Math.max(10, widths[i] - 4)),
      );
      const height = Math.max(1, ...cells.map((c) => c.length)) * lead + 3;
      if (this.ensure(height)) drawHeader();
      let x = L_MARGIN + 2;
      cells.forEach((lines, i) => {
        lines.forEach((line, j) => this.draw(line, x, this.y - lead * (j + 1), size));
        x += widths[i];
      });
      this.y -= height;
      this.page.drawLine({
        start: { x: L_MARGIN, y: this.y + 1 },
        end: { x: L_W - L_MARGIN, y: this.y + 1 },
        thickness: 0.3,
        color: RULE,
      });
    }
  }
}

/** "Page 1 of 9 · Confidential" at the foot of every page. */
export function stampFooters(pdf: PDFDocument, fonts: Fonts, printed: string) {
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const label = `Page ${i + 1} of ${pages.length}`;
    const w = fonts.regular.widthOfTextAtSize(label, 7);
    p.drawText(label, {
      x: L_W - L_MARGIN - w,
      y: L_MARGIN - 6,
      size: 7,
      font: fonts.regular,
      color: MUTED,
    });
    p.drawText(pdfSafe(`${printed} - Confidential`), {
      x: L_MARGIN,
      y: L_MARGIN - 6,
      size: 7,
      font: fonts.regular,
      color: MUTED,
    });
  });
}
