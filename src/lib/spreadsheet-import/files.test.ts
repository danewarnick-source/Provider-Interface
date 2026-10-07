import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildXlsxTemplate,
  columnLetter,
  gridFromText,
  gridFromWorkbook,
  templateCsv,
} from "./files.ts";

describe("spreadsheet files", () => {
  it("column letters past Z", () => {
    assert.deepEqual([0, 25, 26, 27].map(columnLetter), ["A", "Z", "AA", "AB"]);
  });

  it("CSV template puts notes above the header and quotes commas", () => {
    const csv = templateCsv(["Name", "Codes"], ["Pat", "SLH; DSI"], ["Note, with comma"]);
    assert.deepEqual(gridFromText(csv), [
      ["Note, with comma"],
      ["Name", "Codes"],
      ["Pat", "SLH; DSI"],
    ]);
  });

  it("Excel template: data sheet first, then Lists, then How to fill this in", async () => {
    const bytes = await buildXlsxTemplate({
      sheetName: "Data",
      headers: ["Name", "Home"],
      example: ["Pat", "Maple"],
      notes: [["Name", "Required."]],
      lists: [["Homes"], ["Maple"]],
      dropdowns: [{ column: 1, listColumn: "A", count: 1, title: "Home" }],
      maxRows: 10,
    });
    assert.deepEqual(gridFromWorkbook(bytes.buffer as ArrayBuffer), [
      ["Name", "Home"],
      ["Pat", "Maple"],
    ]);
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(bytes);
    const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    assert.match(sheet, /sqref="B2:B11"/);
    const book = await zip.file("xl/workbook.xml")!.async("string");
    assert.match(book, /name="Data".*name="Lists".*name="How to fill this in"/s);
  });
});
