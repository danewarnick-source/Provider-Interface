// Page layout helpers for the support strategies PDF (pdf-lib): a cursor that
// wraps text, starts new pages with the running header, and stamps page
// numbers at the end. Pure (no Supabase), node --test.

import { rgb, type PDFDocument, type PDFFont, type PDFPage } from "pdf-lib";

export const PAGE_W = 612;
export const PAGE_H = 792;
export const MARGIN = 54;
export const CONTENT_W = PAGE_W - MARGIN * 2;
const TOP = PAGE_H - MARGIN - 22; // below the running header
const BOTTOM = MARGIN + 18; // above the page number

export const INK = rgb(0.08, 0.09, 0.12);
export const MUTED = rgb(0.4, 0.43, 0.48);
export const RULE = rgb(0.82, 0.84, 0.88);
export const ACCENT = rgb(0.1, 0.17, 0.28);

const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

/** Text the standard fonts can encode (others become "?"; arrows become "-"). */
export function pdfSafe(s: string): string {
  return Array.from(String(s ?? ""))
    .map((ch) => {
      if (ch === "\t") return " ";
      if (ch === "→") return "-";
      const c = ch.codePointAt(0) ?? 0;
      if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_ANSI_EXTRA.includes(ch)) {
        return ch;
      }
      return "?";
    })
    .join("");
}

/** Splits text into lines no wider than `width` at `size`. */
export function wrapText(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of pdfSafe(text).split(/\r?\n/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width || !line) line = next;
      else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

export type Fonts = { regular: PDFFont; bold: PDFFont };

/** A top-to-bottom writer across pages. */
export class PdfCursor {
  page!: PDFPage;
  y = TOP;
  private pdf: PDFDocument;
  private header: string;
  readonly fonts: Fonts;
  constructor(pdf: PDFDocument, fonts: Fonts, header: string) {
    this.pdf = pdf;
    this.fonts = fonts;
    this.header = header;
    this.newPage();
  }

  newPage() {
    this.page = this.pdf.addPage([PAGE_W, PAGE_H]);
    const y = PAGE_H - MARGIN;
    this.page.drawText(pdfSafe(this.header), {
      x: MARGIN,
      y,
      size: 8,
      font: this.fonts.regular,
      color: MUTED,
    });
    this.page.drawLine({
      start: { x: MARGIN, y: y - 6 },
      end: { x: PAGE_W - MARGIN, y: y - 6 },
      thickness: 0.5,
      color: RULE,
    });
    this.y = TOP;
  }

  /** Room for `h` points on this page, else a new page. */
  ensure(h: number) {
    if (this.y - h < BOTTOM) this.newPage();
  }

  gap(h: number) {
    this.y -= h;
  }

  /** Wrapped text at `x` offset (from the margin); returns lines drawn. */
  text(
    s: string,
    o: { size?: number; bold?: boolean; color?: typeof INK; indent?: number; lead?: number } = {},
  ): number {
    const size = o.size ?? 10;
    const font = o.bold ? this.fonts.bold : this.fonts.regular;
    const indent = o.indent ?? 0;
    const lead = o.lead ?? size * 1.35;
    const lines = wrapText(s, font, size, CONTENT_W - indent);
    for (const line of lines) {
      this.ensure(lead);
      this.y -= lead;
      this.page.drawText(line, {
        x: MARGIN + indent,
        y: this.y,
        size,
        font,
        color: o.color ?? INK,
      });
    }
    return lines.length;
  }

  /** A bullet point: marker at `indent`, wrapped text hanging after it. */
  bullet(s: string, indent = 14, size = 10) {
    const lead = size * 1.35;
    const lines = wrapText(s, this.fonts.regular, size, CONTENT_W - indent - 12);
    lines.forEach((line, i) => {
      this.ensure(lead);
      this.y -= lead;
      if (i === 0) {
        this.page.drawText("•", {
          x: MARGIN + indent,
          y: this.y,
          size,
          font: this.fonts.bold,
          color: ACCENT,
        });
      }
      this.page.drawText(line, {
        x: MARGIN + indent + 12,
        y: this.y,
        size,
        font: this.fonts.regular,
        color: INK,
      });
    });
  }

  rule(color = RULE, thickness = 0.5) {
    this.ensure(8);
    this.y -= 6;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_W - MARGIN, y: this.y },
      thickness,
      color,
    });
    this.y -= 4;
  }
}

/** "Page 1 of 3" at the foot of every page. */
export function stampPageNumbers(pdf: PDFDocument, font: PDFFont) {
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const label = `Page ${i + 1} of ${pages.length}`;
    const w = font.widthOfTextAtSize(label, 8);
    p.drawText(label, { x: PAGE_W - MARGIN - w, y: MARGIN - 8, size: 8, font, color: MUTED });
  });
}
