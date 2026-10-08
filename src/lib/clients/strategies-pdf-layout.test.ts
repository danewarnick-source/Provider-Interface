import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";
import {
  CONTENT_W,
  PdfCursor,
  embedFonts,
  factsGrid,
  pdfSafe,
  stampPageNumbers,
  titleBlock,
  wrapText,
} from "./strategies-pdf-layout.ts";

describe("strategies-pdf-layout", () => {
  it("pdfSafe keeps Latin-1 and WinAnsi punctuation, swaps arrows and drops the rest", () => {
    assert.equal(pdfSafe("Café – “ok” → next\t🍝"), "Café – “ok” - next ?");
  });

  it("wrapText splits on width and keeps paragraphs", async () => {
    const pdf = await PDFDocument.create();
    const { regular } = await embedFonts(pdf);
    const lines = wrapText(`${"word ".repeat(60)}\nnext`, regular, 10, CONTENT_W);
    assert.ok(lines.length >= 3);
    assert.equal(lines.at(-1), "next");
    for (const l of lines) assert.ok(regular.widthOfTextAtSize(l, 10) <= CONTENT_W);
  });

  it("titleBlock and factsGrid move the cursor down; page numbers stamp every page", async () => {
    const pdf = await PDFDocument.create();
    const fonts = await embedFonts(pdf);
    const c = new PdfCursor(pdf, fonts, "Header");
    const top = c.y;
    titleBlock(c, "Provider", "Title");
    const afterTitle = c.y;
    assert.ok(afterTitle < top);
    factsGrid(c, [
      ["A", "1"],
      ["B", "2"],
      ["C", "a very long value ".repeat(20)],
    ]);
    assert.ok(c.y <= afterTitle - 60, "two rows of facts");
    for (let i = 0; i < 80; i++) c.text(`Line ${i}`);
    stampPageNumbers(pdf, fonts.regular);
    assert.ok(pdf.getPageCount() > 1);
  });
});
