// Turns a PDF into pages of text lines that keep their column positions.
// USTEPS PCSPs use two-column "Label:  value" rows and tables, so the reader
// needs to know WHERE on the line each word sits, not just the words.
// Runs server-side with unpdf (see import.functions.ts).

export type LayoutLine = { y: number; text: string };
export type LayoutPage = { index: number; lines: LayoutLine[] };

type Item = { str: string; x: number; y: number; w: number };

const CHAR_W = 4.4; // points per character column at the PCSP's ~9pt font

export function itemsToLines(items: Item[]): LayoutLine[] {
  const rows: { y: number; items: Item[] }[] = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const row = rows.find((r) => Math.abs(r.y - it.y) < 2.5);
    if (row) row.items.push(it);
    else rows.push({ y: it.y, items: [it] });
  }
  rows.sort((a, b) => b.y - a.y); // PDF y grows upward
  return rows.map((r) => {
    r.items.sort((a, b) => a.x - b.x);
    let line = "";
    for (const it of r.items) {
      const col = Math.max(0, Math.round(it.x / CHAR_W));
      if (line.length < col) line += " ".repeat(col - line.length);
      else if (line.length && !line.endsWith(" ")) line += " ";
      line += it.str;
    }
    return { y: r.y, text: line.replace(/\s+$/, "") };
  });
}

type TextItem = { str?: unknown; transform?: number[]; width?: number };
type PdfDoc = {
  numPages: number;
  getPage: (i: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }> }>;
};
export type UnpdfLike = { getDocumentProxy: (bytes: Uint8Array) => Promise<unknown> };

export async function pdfToLayout(bytes: Uint8Array, unpdf: UnpdfLike): Promise<LayoutPage[]> {
  const doc = (await unpdf.getDocumentProxy(bytes)) as PdfDoc;
  const pages: LayoutPage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const items: Item[] = (tc.items as TextItem[])
      .filter((t) => typeof t.str === "string" && Array.isArray(t.transform))
      .map((t) => ({ str: t.str as string, x: t.transform![4], y: t.transform![5], w: t.width ?? 0 }));
    pages.push({ index: i, lines: itemsToLines(items) });
  }
  return pages;
}
