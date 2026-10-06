import { test } from "node:test";
import assert from "node:assert/strict";
import { itemsToLines, pdfToLayout } from "./layout.ts";

test("items on the same row join by column, rows top to bottom", () => {
  const lines = itemsToLines([
    { str: "value", x: 24 * 4.4, y: 700.5, w: 20 },
    { str: "Label:", x: 2 * 4.4, y: 700, w: 20 },
    { str: "Next", x: 0, y: 688, w: 10 },
    { str: "  ", x: 50, y: 688, w: 1 },
  ]);
  assert.deepEqual(lines.map((l) => l.text), ["  Label:                value", "Next"]);
});

test("touching items get one space between them", () => {
  assert.equal(itemsToLines([{ str: "A", x: 0, y: 1, w: 1 }, { str: "B", x: 0, y: 1, w: 1 }])[0].text, "A B");
});

test("pdfToLayout reads each page's text items", async () => {
  const fake = {
    getDocumentProxy: async () => ({
      numPages: 1,
      getPage: async () => ({
        getTextContent: async () => ({ items: [{ str: "Hi", transform: [1, 0, 0, 1, 0, 10], width: 5 }, { type: "marked" }] }),
      }),
    }),
  };
  assert.deepEqual(await pdfToLayout(new Uint8Array(), fake), [{ index: 1, lines: [{ y: 10, text: "Hi" }] }]);
});
